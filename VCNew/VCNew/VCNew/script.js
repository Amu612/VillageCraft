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
camera.position.set(0, 150, 150);

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
    try {
        terrain = await terrainManager.loadTerrain('./assets/heightmap.png', './assets/lalpur_c.png');
    } catch (e) {
        console.error("3D Terrain load failed. Trying flat plane.", e);
        try {
            terrain = await terrainManager.loadTerrain(null, './assets/lalpur_c.png');
        } catch (err) {
            console.error(err);
        }
    }
    
    if (!terrain) terrain = ground;
    else terrain.position.set(0,0,0);
    
    // Load 3D Map Buildings
    const gis = new GISLoader(scene, terrainManager);
    gis.loadBuildings('./assets/buildings.geojson');
    
    updateUI();
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
    return false; // For road building, we usually allow overlap with roads if connecting
}

// --- RENDERING TEXTURES ---
function getRoadMaterial(type, length) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (type === 'street') {
        ctx.fillStyle = '#555'; ctx.fillRect(0,0,256,256);
        ctx.fillStyle = '#ddd'; 
        for(let i=0; i<256; i+=32) ctx.fillRect(124, i, 8, 16);
    } else if (type === 'highway') {
        ctx.fillStyle = '#222'; ctx.fillRect(0,0,256,256);
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(118, 0, 6, 256); ctx.fillRect(132, 0, 6, 256);
        ctx.fillStyle = '#fff'; ctx.fillRect(10, 0, 6, 256); ctx.fillRect(240, 0, 6, 256);
    } else { // dirt
        ctx.fillStyle = '#5c4033'; ctx.fillRect(0,0,256,256);
        for(let i=0; i<800; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#4b3528' : '#735140';
            ctx.fillRect(Math.random()*256, Math.random()*256, 4, 4);
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, length / 10), 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: (type==='dirt'? 1.0 : 0.8) });
    return mat;
}

// --- INTERACTION LOGIC ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersection(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(terrain || ground);
    if (intersects.length > 0) return intersects[0].point;
    return null;
}

function getObjectIntersection(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...buildingObjects, ...roadObjects], true);
    if(intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj.parent && obj.parent.type !== 'Scene' && !obj.userData?.type) {
            obj = obj.parent;
        }
        if(obj.userData && obj.userData.type) return obj;
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
    
    // Create new node
    const newNode = {
        id: Date.now() + Math.random(),
        pos: point.clone(),
        connectedRoads: [],
        mesh: new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffff00, visible: false }))
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
    // Also snap to building connection points (simplified: snap to building origins)
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
        // Terrain snap height
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

    if (currentTool === 'road') {
        controls.enabled = false;
        isDrawingRoad = true;
        roadStartPos = snapToNode(point);
        roadEndPos = roadStartPos.clone();
        roadControlPos = roadStartPos.clone();
        startMarker.position.copy(roadStartPos);
        startMarker.visible = true;
        showGuidance("Drag to set endpoint... Release to build");
    } 
    else if (currentTool === 'build' && placementMode) {
        if (hasCollision) {
            playSound('error');
            showGuidance("Invalid placement (Collision)!");
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
        } else {
            playSound('error'); pulseRed(document.getElementById('coinCount').parentElement);
        }
    }
    else if (currentTool === 'bulldoze') {
        const target = getObjectIntersection(e);
        if (target) {
            actionHistory.execute({
                type: 'delete',
                cost: target.userData.cost || 0,
                meshRef: target,
                category: target.userData.category,
                do() {
                    gameState.budget += Math.floor(this.cost / 2);
                    scene.remove(this.meshRef);
                    if(this.category === 'road') roadObjects = roadObjects.filter(r => r !== this.meshRef);
                    else buildingObjects = buildingObjects.filter(b => b !== this.meshRef);
                    playSound('build');
                },
                undo() {
                    gameState.budget -= Math.floor(this.cost / 2);
                    scene.add(this.meshRef);
                    if(this.category === 'road') roadObjects.push(this.meshRef);
                    else buildingObjects.push(this.meshRef);
                }
            });
        }
    }
});

window.addEventListener("pointermove", (e) => {
    const point = getIntersection(e);
    if (!point) return;

    if (isDrawingRoad && roadStartPos) {
        roadEndPos = snapToNode(point);
        // Curve handling: Midpoint is lerp + perpendicular offset based on distance from straight line?
        // Let's use simplified: Control point follows mouse, but Start and End remain fixed.
        // Or Start fixed, End mouse, and curve is automatically slightly bowed.
        roadControlPos.lerpVectors(roadStartPos, roadEndPos, 0.5);
        // Add a slight "tension" curve offset
        const dist = roadStartPos.distanceTo(roadEndPos);
        
        if (!roadPreviewMesh) {
            roadPreviewMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6, color: 0x00ffcc }));
            scene.add(roadPreviewMesh);
        }
        
        if (dist > 2) {
            const spline = getSplinePath(roadStartPos, roadControlPos, roadEndPos);
            const geo = new THREE.TubeGeometry(spline, 32, ROAD_WIDTH / 2, 8, false);
            roadPreviewMesh.geometry.dispose();
            roadPreviewMesh.geometry = geo;
            
            roadCostPreviewAmount = Math.floor(dist) * BUILD_COSTS.roadBase;
            document.getElementById("roadCostPreview").innerText = `${roadCostPreviewAmount} 💰 (${Math.floor(dist)}m)`;
            
            if (roadCostPreviewAmount > gameState.budget) roadPreviewMesh.material.color.setHex(0xff0000);
            else roadPreviewMesh.material.color.setHex(0x00ffcc);
        }
        endMarker.position.copy(roadEndPos);
        endMarker.visible = true;
    }
    
    // Ghost Preview for Build Tool
    if (currentTool === 'build' && placementMode) {
        if (!buildPreviewObj || buildPreviewObj.userData.type !== placementMode) {
            if(buildPreviewObj) scene.remove(buildPreviewObj);
            const geo = placementMode==='tree' ? new THREE.CylinderGeometry(2,2,6) : new THREE.BoxGeometry(6,6,6);
            buildPreviewObj = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0x00ffcc, transparent:true, opacity:0.6}));
            buildPreviewObj.userData.type = placementMode;
            scene.add(buildPreviewObj);
        }
        const target = snapToNode(point);
        buildPreviewObj.position.copy(target);
        
        // Auto-center base to 0
        const box = new THREE.Box3().setFromObject(buildPreviewObj);
        buildPreviewObj.position.y += (target.y - box.min.y);

        hasCollision = checkCollision(buildPreviewObj);
        const cost = BUILD_COSTS[placementMode] || 10;
        if (cost > gameState.budget || hasCollision) buildPreviewObj.material.color.setHex(0xff0000);
        else buildPreviewObj.material.color.setHex(0x00ffcc);
    } else if(buildPreviewObj) { scene.remove(buildPreviewObj); buildPreviewObj = null; }

    // Snapping Feedback
    if (currentTool === 'road' || currentTool === 'build') {
        const snap = snapToNode(point);
        if (snap.distanceTo(point) < 12) {
            // Visualize snap
        }
    }
});

window.addEventListener("pointerup", (e) => {
    if (isDrawingRoad && roadStartPos && roadEndPos) {
        isDrawingRoad = false;
        controls.enabled = true;
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
        } else { playSound('error'); }
        
        if (roadPreviewMesh) { scene.remove(roadPreviewMesh); roadPreviewMesh = null; }
        document.getElementById("roadCostPreview").innerText = `0 💰 (0m)`;
        roadStartPos = null; roadEndPos = null;
        if(currentTool === 'road') showGuidance("Click to start road");
    }
});

// --- ROAD CONSTRUCTION ---
function buildFinalRoad(startNode, mid, endNode, cost) {
    gameState.budget -= cost;
    const dist = startNode.pos.distanceTo(endNode.pos);
    const spline = getSplinePath(startNode.pos, mid, endNode.pos);
    const geo = new THREE.TubeGeometry(spline, 32, ROAD_WIDTH / 2, 8, false);
    
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
    // If 3+ roads, show a junction visual
    if (node.connectedRoads.length >= 3) {
        if (!node.junctionMesh) {
            node.junctionMesh = new THREE.Mesh(new THREE.CylinderGeometry(ROAD_WIDTH * 0.8, ROAD_WIDTH * 0.8, 1, 32), new THREE.MeshStandardMaterial({ color: 0x333333 }));
            scene.add(node.junctionMesh);
        }
        node.junctionMesh.position.copy(node.pos);
        node.junctionMesh.position.y += 0.5;
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
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
        trunk.position.y = 2.5;
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(3), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
        canopy.position.y = 6;
        group.add(trunk, canopy);
        group.scale.set(0.1, 0.1, 0.1);
        scene.add(group);
        animateGrowth(group);
        buildingObjects.push(group);
    } else {
        const modelPath = type === 'house' ? './models/brickhouse.glb' : type === 'streetLight' ? './models/street_lamp.glb' : null;
        if (modelPath) {
            new GLTFLoader().load(modelPath, (gltf) => {
                const model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.set(-center.x, -box.min.y, -center.z);
                group.add(model);
                group.scale.set(0.1, 0.1, 0.1);
                scene.add(group);
                animateGrowth(group);
                buildingObjects.push(group);
            });
        } else {
            // Box fallback
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(6,6,6), new THREE.MeshStandardMaterial({color: 0x888888}));
            mesh.position.set(0, 3, 0); // half height
            group.add(mesh);
            group.scale.set(0.1, 0.1, 0.1);
            scene.add(group);
            animateGrowth(group);
            buildingObjects.push(group);
        }
    }
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
window.buildHouse = () => { setBuildMode('house'); };
window.buildStreetLight = () => { setBuildMode('streetLight'); };
window.buildCustomModel = () => { setBuildMode('customModel'); };
document.getElementById("PlantTree").onclick = () => { setBuildMode('tree'); };

function setBuildMode(type) {
    currentTool = 'build';
    placementMode = type;
    updateToolUI();
}

function pulseRed(elem) {
    elem.style.textShadow = "0 0 15px red";
    setTimeout(()=>elem.style.textShadow="", 500);
}

function showGuidance(text) {
    const g = document.getElementById("hud-guidance");
    g.innerText = text;
    g.classList.add('visible');
}

function updateToolUI() {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (currentTool) document.getElementById(`tool-${currentTool}`).classList.add('active');
    
    if (buildPreviewObj) { scene.remove(buildPreviewObj); buildPreviewObj = null; }
    if (roadPreviewMesh) { scene.remove(roadPreviewMesh); roadPreviewMesh = null; }
    isDrawingRoad = false;
    
    const rightPanel = document.getElementById('hud-right');
    if(currentTool === 'bulldoze') document.body.style.cursor = 'cell';
    else if(currentTool) document.body.style.cursor = 'crosshair';
    else document.body.style.cursor = 'default';

    if (!currentTool) {
        rightPanel.classList.remove('active');
        showGuidance("Select a tool to begin");
    } else if (currentTool === 'road') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'block';
        document.getElementById('prop-build').style.display = 'none';
        showGuidance("Drag to build curved roads");
    } else if (currentTool === 'build') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'none';
        document.getElementById('prop-build').style.display = 'block';
        showGuidance(`Click to place ${placementMode}`);
    } else if (currentTool === 'bulldoze') {
        rightPanel.classList.remove('active');
        showGuidance("Hover and Click objects to demolish");
    } else if (currentTool === 'upgrade') {
        rightPanel.classList.add('active');
        document.getElementById('prop-road').style.display = 'block';
        document.getElementById('prop-build').style.display = 'none';
        showGuidance("Click a road to upgrade it");
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
