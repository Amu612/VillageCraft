import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';
import { TerrainManager } from './Terrain.js';
import { GISLoader } from './GISLoader.js';

// --- CENTRALIZED STATE MANAGEMENT ---
const WORLD_SIZE = 800;
const BUILD_COSTS = { streetLight: 20, house: 30, customModel: 40, tree: 10, roadBase: 5 };
let ROAD_WIDTH = 6;
let currentRoadType = 'street';

const gameState = { budget: 50000, happiness: 75, energy: 1000 };
let currentTool = null; // 'road', 'build', 'bulldoze', 'upgrade', null
let placementMode = 'house';

// --- MODEL CACHE ---
const loadedModels = { house: null, streetLight: null };

function preloadModels() {
    const loader = new GLTFLoader();
    loader.load('./models/brickhouse.glb', (gltf) => {
        loadedModels.house = gltf.scene;
        console.log("Preloaded house model successfully");
    }, undefined, (err) => console.warn("Failed to preload house GLB", err));

    loader.load('./models/street_lamp.glb', (gltf) => {
        loadedModels.streetLight = gltf.scene;
        console.log("Preloaded street light model successfully");
    }, undefined, (err) => console.warn("Failed to preload street light GLB", err));
}

// --- OBJECT ARRAYS ---
let roadObjects = [];
let buildingObjects = [];
let roadNodes = []; // { id, pos, connectedRoads: [] }

// --- ACTION MANAGER (UNDO/REDO SYSTEM) ---
const actionHistory = {
    undoStack: [],
    redoStack: [],
    execute(action) {
        action.do();
        this.undoStack.push(action);
        this.redoStack = [];
        updateUI();
    },
    undo() {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        action.undo();
        this.redoStack.push(action);
        updateUI();
    },
    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        action.do();
        this.undoStack.push(action);
        updateUI();
    }
};

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 180, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("canvas-container").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05;

// Lighting (3D depth & shadows)
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(200, 400, 200);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambLight);

// Ground plane (Fallback)
const groundGeo = new THREE.PlaneGeometry(5000, 5000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5a3d, roughness: 1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// --- TERRAIN ---
let terrain = null;
const terrainManager = new TerrainManager(scene);

async function initThreeMap() {
    terrainManager.worldSize = WORLD_SIZE;
    preloadModels();

    try {
        terrain = await terrainManager.loadTerrain('./assets/heightmap.png', './assets/texture.png');
    } catch (e) {
        console.warn("Primary terrain load failed, using ground plane fallback", e);
    }
    
    if (!terrain) terrain = ground;
    
    // Load 3D Map Buildings
    const gis = new GISLoader(scene, terrainManager);
    gis.loadBuildings('./assets/buildings.geojson');
    
    updateUI();
    showGuidance("Select a tool from the left panel to begin construction");
}

// --- SOUNDS ---
const sfxClick = document.getElementById('sfx-click');
const sfxBuild = document.getElementById('sfx-build');
const sfxError = document.getElementById('sfx-error');

function playSound(type) {
    if (type === 'click' && sfxClick) { sfxClick.currentTime = 0; sfxClick.play().catch(()=>{}); }
    if (type === 'build' && sfxBuild) { sfxBuild.currentTime = 0; sfxBuild.play().catch(()=>{}); }
    if (type === 'error' && sfxError) { sfxError.currentTime = 0; sfxError.play().catch(()=>{}); }
}

// --- COLLISION DETECTION ---
function checkCollision(testMesh) {
    testMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(testMesh);
    box.expandByScalar(-0.5); 

    for (const obj of buildingObjects) {
        if (obj === testMesh) continue;
        const otherBox = new THREE.Box3().setFromObject(obj);
        if (box.intersectsBox(otherBox)) return true;
    }
    return false;
}

// --- RENDERING TEXTURES & ROAD GEOMETRY ---
function getRoadMaterial(type, length) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (type === 'street') {
        ctx.fillStyle = '#444444'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#ffffff'; 
        for (let i = 0; i < 256; i += 32) ctx.fillRect(124, i, 8, 16);
    } else if (type === 'highway') {
        ctx.fillStyle = '#222222'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(118, 0, 6, 256); ctx.fillRect(132, 0, 6, 256);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(10, 0, 6, 256); ctx.fillRect(240, 0, 6, 256);
    } else { // dirt
        ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 600; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#54341a' : '#82552e';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, Math.max(1, length / 10));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: (type === 'dirt' ? 1.0 : 0.8), side: THREE.DoubleSide });
    return mat;
}

function createRoadGeometry(spline, width = ROAD_WIDTH) {
    const numPoints = 60;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    const halfW = width / 2;
    const splineLength = spline.getLength();

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const pt = spline.getPoint(t);
        const tangent = spline.getTangent(t).normalize();

        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const leftPt = pt.clone().addScaledVector(side, -halfW);
        const rightPt = pt.clone().addScaledVector(side, halfW);

        leftPt.y = terrainManager.getHeightAt(leftPt.x, leftPt.z) + 0.35;
        rightPt.y = terrainManager.getHeightAt(rightPt.x, rightPt.z) + 0.35;

        vertices.push(leftPt.x, leftPt.y, leftPt.z);
        vertices.push(rightPt.x, rightPt.y, rightPt.z);

        const vCoord = t * Math.max(1, splineLength / 12);
        uvs.push(0, vCoord);
        uvs.push(1, vCoord);

        if (i < numPoints) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

// --- INTERACTION LOGIC ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersection(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const targetObj = (terrain && terrain !== ground) ? terrain : ground;
    const intersects = raycaster.intersectObject(targetObj, true);
    if (intersects.length > 0) return intersects[0].point;

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const rayPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, rayPoint)) {
        rayPoint.y = terrainManager.getHeightAt(rayPoint.x, rayPoint.z);
        return rayPoint;
    }
    return null;
}

function getObjectIntersection(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const candidates = [...buildingObjects, ...roadObjects];
    const intersects = raycaster.intersectObjects(candidates, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && obj.parent.type !== 'Scene' && !obj.userData?.category) {
            obj = obj.parent;
        }
        if (obj.userData && obj.userData.category) return obj;
    }
    return null;
}

function findOrCreateNode(point, threshold = 8) {
    let closest = null;
    let minDist = threshold;
    
    for (const node of roadNodes) {
        const d = node.pos.distanceTo(point);
        if (d < minDist) {
            minDist = d;
            closest = node;
        }
    }

    if (closest) return closest;
    
    const newNode = {
        id: Date.now() + Math.random(),
        pos: point.clone(),
        connectedRoads: [],
        mesh: new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffff00, visible: false }))
    };
    newNode.mesh.position.copy(newNode.pos);
    scene.add(newNode.mesh);
    roadNodes.push(newNode);
    return newNode;
}

function snapToNode(point, threshold = 12) {
    let closest = null;
    let minDist = threshold;
    for (const node of roadNodes) {
        const d = node.pos.distanceTo(point);
        if (d < minDist) {
            minDist = d;
            closest = node.pos.clone();
        }
    }
    buildingObjects.forEach(b => {
        const d = b.position.distanceTo(point);
        if (d < minDist) {
            minDist = d;
            closest = b.position.clone();
        }
    });

    return closest || point;
}

// --- CURVE HELPER ---
function getSplinePath(start, mid, end, segments = 20) {
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        const p = curve.getPoint(i / segments);
        p.y = terrainManager.getHeightAt(p.x, p.z) + 0.3;
        pts.push(p);
    }
    return new THREE.CatmullRomCurve3(pts);
}

// --- TOOL STATES ---
let isDrawingRoad = false;
let roadStartPos = null;
let roadEndPos = null;
let roadControlPos = null;
let roadPreviewMesh = null;
let roadCostPreviewAmount = 0;
let buildPreviewObj = null;
let hasCollision = false;

let startMarker = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8, visible: false }));
scene.add(startMarker);
let endMarker = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8, visible: false }));
scene.add(endMarker);

// --- EVENTS ---
window.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".glass-panel") || e.button !== 0 || !currentTool) return;
    
    const point = getIntersection(e);
    if (!point) return;

    if (currentTool) {
        controls.enabled = false;
    }

    if (currentTool === 'road') {
        isDrawingRoad = true;
        roadStartPos = snapToNode(point);
        roadEndPos = roadStartPos.clone();
        roadControlPos = roadStartPos.clone();
        startMarker.position.copy(roadStartPos);
        startMarker.visible = true;
        showGuidance("Drag mouse to extend road... Release to complete");
    } 
    else if (currentTool === 'build' && placementMode) {
        if (hasCollision) {
            playSound('error');
            showGuidance("Invalid placement (Collision with another structure)!");
            controls.enabled = true;
            return;
        }
        const cost = BUILD_COSTS[placementMode] || 10;
        if (gameState.budget >= cost) {
            const targetPoint = snapToNode(point);
            actionHistory.execute({
                type: 'build',
                cost: cost,
                pos: targetPoint.clone(),
                structType: placementMode,
                meshRef: null,
                do() { this.meshRef = placeStructure(this.pos, this.structType, this.cost); },
                undo() { gameState.budget += this.cost; scene.remove(this.meshRef); buildingObjects = buildingObjects.filter(b => b !== this.meshRef); }
            });

            // Reset active tool so only ONE object is placed at a time
            currentTool = null;
            updateToolUI();
            showGuidance("Object placed successfully! Select a tool to build again");
        } else {
            playSound('error'); pulseRed(document.getElementById('coinCount').parentElement);
            showGuidance("Not enough budget to build!");
        }
        controls.enabled = true;
    }
    else if (currentTool === 'bulldoze') {
        const target = getObjectIntersection(e);
        if (target) {
            const cost = target.userData.cost || 20;
            actionHistory.execute({
                type: 'delete',
                cost: cost,
                meshRef: target,
                category: target.userData.category || 'building',
                do() {
                    gameState.budget += Math.floor(this.cost / 2);
                    scene.remove(this.meshRef);
                    if (this.category === 'road') roadObjects = roadObjects.filter(r => r !== this.meshRef);
                    else buildingObjects = buildingObjects.filter(b => b !== this.meshRef);
                    playSound('build');
                },
                undo() {
                    gameState.budget -= Math.floor(this.cost / 2);
                    scene.add(this.meshRef);
                    if (this.category === 'road') roadObjects.push(this.meshRef);
                    else buildingObjects.push(this.meshRef);
                }
            });
            showGuidance("Demolished structure! Budget reclaimed.");
        } else {
            showGuidance("Click an object to demolish it.");
        }
        controls.enabled = true;
    }
    else if (currentTool === 'upgrade') {
        const target = getObjectIntersection(e);
        if (target && target.userData.category === 'road') {
            const upgradeCost = 50;
            if (gameState.budget >= upgradeCost) {
                actionHistory.execute({
                    type: 'upgrade',
                    cost: upgradeCost,
                    target: target,
                    oldType: target.userData.type,
                    newType: currentRoadType,
                    do() {
                        gameState.budget -= this.cost;
                        this.target.userData.type = this.newType;
                        this.target.material = getRoadMaterial(this.newType, 50);
                        playSound('build');
                    },
                    undo() {
                        gameState.budget += this.cost;
                        this.target.userData.type = this.oldType;
                        this.target.material = getRoadMaterial(this.oldType, 50);
                    }
                });
                showGuidance(`Road upgraded to ${currentRoadType}!`);
            } else {
                playSound('error');
                showGuidance("Not enough budget for upgrade!");
            }
        } else {
            showGuidance("Click a road to upgrade it.");
        }
        controls.enabled = true;
    }
});

window.addEventListener("pointermove", (e) => {
    const point = getIntersection(e);
    if (!point) return;

    if (isDrawingRoad && roadStartPos) {
        roadEndPos = snapToNode(point);
        roadControlPos.lerpVectors(roadStartPos, roadEndPos, 0.5);
        const dist = roadStartPos.distanceTo(roadEndPos);
        
        if (dist > 2) {
            const spline = getSplinePath(roadStartPos, roadControlPos, roadEndPos);
            const geo = createRoadGeometry(spline, ROAD_WIDTH);
            
            if (!roadPreviewMesh) {
                roadPreviewMesh = new THREE.Mesh(geo, getRoadMaterial(currentRoadType, dist));
                roadPreviewMesh.material.opacity = 0.7;
                roadPreviewMesh.material.transparent = true;
                scene.add(roadPreviewMesh);
            } else {
                roadPreviewMesh.geometry.dispose();
                roadPreviewMesh.geometry = geo;
                roadPreviewMesh.material = getRoadMaterial(currentRoadType, dist);
                roadPreviewMesh.material.opacity = 0.7;
                roadPreviewMesh.material.transparent = true;
            }
            
            roadCostPreviewAmount = Math.floor(dist) * BUILD_COSTS.roadBase;
            document.getElementById("roadCostPreview").innerText = `${roadCostPreviewAmount} 💰 (${Math.floor(dist)}m)`;
            
            if (roadCostPreviewAmount > gameState.budget) {
                roadPreviewMesh.material.color.setHex(0xff0000);
            }
        }
        endMarker.position.copy(roadEndPos);
        endMarker.visible = true;
    }
    
    // Ghost Preview for Build Tool
    if (currentTool === 'build' && placementMode) {
        if (!buildPreviewObj || buildPreviewObj.userData.type !== placementMode) {
            if (buildPreviewObj) scene.remove(buildPreviewObj);
            const geo = placementMode === 'tree' ? new THREE.CylinderGeometry(2, 2, 6) : new THREE.BoxGeometry(6, 6, 6);
            buildPreviewObj = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 }));
            buildPreviewObj.userData.type = placementMode;
            scene.add(buildPreviewObj);
        }
        const target = snapToNode(point);
        buildPreviewObj.position.copy(target);
        
        const box = new THREE.Box3().setFromObject(buildPreviewObj);
        buildPreviewObj.position.y += (target.y - box.min.y);

        hasCollision = checkCollision(buildPreviewObj);
        const cost = BUILD_COSTS[placementMode] || 10;
        if (cost > gameState.budget || hasCollision) buildPreviewObj.material.color.setHex(0xff0000);
        else buildPreviewObj.material.color.setHex(0x00ffcc);
    } else if (buildPreviewObj) {
        scene.remove(buildPreviewObj);
        buildPreviewObj = null;
    }
});

window.addEventListener("pointerup", (e) => {
    controls.enabled = true;

    if (isDrawingRoad && roadStartPos && roadEndPos) {
        isDrawingRoad = false;
        startMarker.visible = false;
        endMarker.visible = false;

        const dist = roadStartPos.distanceTo(roadEndPos);
        if (roadCostPreviewAmount <= gameState.budget && dist > 2) {
            const startNode = findOrCreateNode(roadStartPos);
            const endNode = findOrCreateNode(roadEndPos);
            const cost = roadCostPreviewAmount;
            const mid = roadControlPos.clone();

            actionHistory.execute({
                type: 'road',
                start: startNode, end: endNode, mid: mid, cost: cost, meshRef: null,
                do() { this.meshRef = buildFinalRoad(this.start, this.mid, this.end, this.cost); },
                undo() { 
                    gameState.budget += this.cost; 
                    scene.remove(this.meshRef); 
                    roadObjects = roadObjects.filter(r => r !== this.meshRef);
                    this.start.connectedRoads = this.start.connectedRoads.filter(r => r !== this.meshRef);
                    this.end.connectedRoads = this.end.connectedRoads.filter(r => r !== this.meshRef);
                    checkJunction(this.start); checkJunction(this.end);
                }
            });
            playSound('build');

            // Reset active tool so only ONE road segment is placed at a time
            currentTool = null;
            updateToolUI();
            showGuidance("Road segment placed! Select a tool to build again");
        } else {
            playSound('error');
        }
        
        if (roadPreviewMesh) { scene.remove(roadPreviewMesh); roadPreviewMesh = null; }
        document.getElementById("roadCostPreview").innerText = `0 💰 (0m)`;
        roadStartPos = null; roadEndPos = null;
    }
});

// --- ROAD CONSTRUCTION ---
function buildFinalRoad(startNode, mid, endNode, cost) {
    gameState.budget -= cost;
    const dist = startNode.pos.distanceTo(endNode.pos);
    const spline = getSplinePath(startNode.pos, mid, endNode.pos);
    const geo = createRoadGeometry(spline, ROAD_WIDTH);
    const mat = getRoadMaterial(currentRoadType, dist);
    
    const road = new THREE.Mesh(geo, mat);
    road.castShadow = true; road.receiveShadow = true;
    road.userData = { category: 'road', type: currentRoadType, width: ROAD_WIDTH, cost: cost, startNode, endNode, mid };
    
    scene.add(road);
    roadObjects.push(road);
    startNode.connectedRoads.push(road);
    endNode.connectedRoads.push(road);
    
    checkJunction(startNode);
    checkJunction(endNode);
    
    updateUI();
    return road;
}

function checkJunction(node) {
    if (node.connectedRoads.length >= 3) {
        if (!node.junctionMesh) {
            node.junctionMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(ROAD_WIDTH * 0.8, ROAD_WIDTH * 0.8, 0.4, 32),
                new THREE.MeshStandardMaterial({ color: 0x333333 })
            );
            scene.add(node.junctionMesh);
        }
        node.junctionMesh.position.copy(node.pos);
        node.junctionMesh.position.y += 0.35;
        node.junctionMesh.visible = true;
    } else if (node.junctionMesh) {
        node.junctionMesh.visible = false;
    }
}

// --- STRUCTURE PLACEMENT ---
function placeStructure(pos, type, cost) {
    gameState.budget -= cost;
    playSound('build');
    updateUI();

    const group = new THREE.Group();
    group.position.copy(pos);
    group.userData = { category: 'building', type, cost };

    if (type === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 6, 8), new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }));
        trunk.position.y = 3;
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 }));
        canopy.position.y = 8;
        group.add(trunk, canopy);
    } else if (type === 'house' && loadedModels.house) {
        const model = loadedModels.house.clone();
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredSize = 12;
        const scaleFactor = maxDim > 0 ? (desiredSize / maxDim) : 1;

        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        model.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
        group.add(model);
    } else if (type === 'streetLight' && loadedModels.streetLight) {
        const model = loadedModels.streetLight.clone();
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredSize = 10;
        const scaleFactor = maxDim > 0 ? (desiredSize / maxDim) : 1;

        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        model.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
        group.add(model);
    } else {
        const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(8, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.4, metalness: 0.1 })
        );
        boxMesh.position.y = 4;
        const roofMesh = new THREE.Mesh(
            new THREE.ConeGeometry(7, 4, 4),
            new THREE.MeshStandardMaterial({ color: 0x9a031e, roughness: 0.5 })
        );
        roofMesh.rotation.y = Math.PI / 4;
        roofMesh.position.y = 10;
        group.add(boxMesh, roofMesh);
    }

    group.scale.set(0.1, 0.1, 0.1);
    scene.add(group);
    animateGrowth(group);
    buildingObjects.push(group);

    return group;
}

function animateGrowth(obj) {
    let s = 0.1;
    const interval = setInterval(() => {
        s += 0.1;
        if (s >= 1) { s = 1; clearInterval(interval); }
        obj.scale.set(s, s, s);
    }, 20);
}

// UI Triggers
function setBuildMode(type) {
    currentTool = 'build';
    placementMode = type;
    updateToolUI();
    playSound('click');
}

window.buildHouse = () => setBuildMode('house');
window.buildStreetLight = () => setBuildMode('streetLight');
window.buildCustomModel = () => setBuildMode('customModel');
window.buildTree = () => setBuildMode('tree');

// Direct Event Listeners for HTML build items
document.getElementById("btn-build-house")?.addEventListener("click", () => setBuildMode('house'));
document.getElementById("btn-build-light")?.addEventListener("click", () => setBuildMode('streetLight'));
document.getElementById("PlantTree")?.addEventListener("click", () => setBuildMode('tree'));
document.getElementById("btn-build-box")?.addEventListener("click", () => setBuildMode('customModel'));

function pulseRed(elem) {
    if (!elem) return;
    elem.style.textShadow = "0 0 15px red";
    setTimeout(() => elem.style.textShadow = "", 500);
}

function showGuidance(text) {
    const g = document.getElementById("hud-guidance");
    if (g) {
        g.innerText = text;
        g.classList.add('visible');
    }
}

function updateToolUI() {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (currentTool) {
        const btn = document.getElementById(`tool-${currentTool}`);
        if (btn) btn.classList.add('active');
    }
    
    if (buildPreviewObj) { scene.remove(buildPreviewObj); buildPreviewObj = null; }
    if (roadPreviewMesh) { scene.remove(roadPreviewMesh); roadPreviewMesh = null; }
    isDrawingRoad = false;
    
    const rightPanel = document.getElementById('hud-right');
    if (currentTool === 'bulldoze') document.body.style.cursor = 'cell';
    else if (currentTool) document.body.style.cursor = 'crosshair';
    else document.body.style.cursor = 'default';

    if (!currentTool) {
        rightPanel.classList.remove('active');
        showGuidance("Select a tool from the left panel to begin construction");
    } else if (currentTool === 'road') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'block';
        document.getElementById('prop-build').style.display = 'none';
        showGuidance("Click and drag on the map to construct roads");
    } else if (currentTool === 'build') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'none';
        document.getElementById('prop-build').style.display = 'block';
        showGuidance(`Click on the map to place ${placementMode}`);
    } else if (currentTool === 'bulldoze') {
        rightPanel.classList.remove('active');
        showGuidance("Click any structure or road on the map to demolish it");
    } else if (currentTool === 'upgrade') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'block';
        document.getElementById('prop-build').style.display = 'none';
        showGuidance("Click a road on the map to upgrade its type");
    }
}

document.getElementById('tool-road').onclick = () => { currentTool = currentTool === 'road' ? null : 'road'; updateToolUI(); playSound('click'); };
document.getElementById('tool-build').onclick = () => { currentTool = currentTool === 'build' ? null : 'build'; updateToolUI(); playSound('click'); };
document.getElementById('tool-bulldoze').onclick = () => { currentTool = currentTool === 'bulldoze' ? null : 'bulldoze'; updateToolUI(); playSound('click'); };
document.getElementById('tool-upgrade').onclick = () => { currentTool = currentTool === 'upgrade' ? null : 'upgrade'; updateToolUI(); playSound('click'); };

document.getElementById('btn-undo').onclick = () => { playSound('click'); actionHistory.undo(); showGuidance("Action Undone"); };
document.getElementById('btn-redo').onclick = () => { playSound('click'); actionHistory.redo(); showGuidance("Action Redone"); };

document.getElementById("laneWidth").oninput = (e) => {
    ROAD_WIDTH = parseInt(e.target.value);
    document.getElementById("laneValue").innerText = ROAD_WIDTH;
};
document.getElementById("roadType").onchange = (e) => {
    currentRoadType = e.target.value;
};

// Persistence (Save / Load)
document.getElementById('Save')?.addEventListener('click', () => {
    const saveData = {
        budget: gameState.budget,
        happiness: gameState.happiness,
        energy: gameState.energy,
        buildings: buildingObjects.map(b => ({
            pos: { x: b.position.x, y: b.position.y, z: b.position.z },
            type: b.userData.type,
            cost: b.userData.cost
        }))
    };
    localStorage.setItem('villagecraft_save', JSON.stringify(saveData));
    playSound('click');
    showGuidance("Village layout saved successfully!");
});

document.getElementById('Load')?.addEventListener('click', () => {
    const raw = localStorage.getItem('villagecraft_save');
    if (!raw) {
        showGuidance("No saved layout found");
        playSound('error');
        return;
    }
    try {
        const saveData = JSON.parse(raw);
        gameState.budget = saveData.budget || 50000;
        gameState.happiness = saveData.happiness || 75;
        gameState.energy = saveData.energy || 1000;

        buildingObjects.forEach(b => scene.remove(b));
        buildingObjects = [];

        if (saveData.buildings) {
            saveData.buildings.forEach(b => {
                const pos = new THREE.Vector3(b.pos.x, b.pos.y, b.pos.z);
                placeStructure(pos, b.type, 0);
            });
        }

        updateUI();
        playSound('click');
        showGuidance("Saved village layout loaded!");
    } catch (e) {
        console.error("Failed to load save data", e);
        playSound('error');
    }
});

function updateUI() {
    document.getElementById("coinCount").innerText = gameState.budget;
    document.getElementById("energyCount").innerText = gameState.energy;
    document.getElementById("happinessCount").innerText = gameState.happiness + "%";
}

document.addEventListener('mousedown', function (e) {
    const btn = e.target.closest('button, .build-item');
    if (btn) {
        playSound('click');
        const rect = btn.getBoundingClientRect();
        const splash = document.createElement('div');
        splash.classList.add('ripple');
        splash.style.left = `${e.clientX - rect.left}px`;
        splash.style.top = `${e.clientY - rect.top}px`;
        btn.appendChild(splash); setTimeout(() => splash.remove(), 600);
    }
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
initThreeMap();
updateToolUI();
