// Import Three.js and controls
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/DragControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

let roadMode = false;
let roadPoints = [];
let previewLine = null;
let isDrawingRoad = false;
let lastDrawPoint = null;
let treeMode = false;
let terrain = null;
let dragControls = null;

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Updated camera position for closer initial view
camera.position.set(0, 60, 80); // Adjust based on your map's dimensions
camera.lookAt(0, 0, 0); // Look at the map's center

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("map-container").appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10).normalize();
scene.add(light);

let ROAD_WIDTH = 6;

const laneInput = document.getElementById("laneWidth");
const laneValue = document.getElementById("laneValue");

if (laneInput) {
  laneInput.addEventListener("input", () => {
    ROAD_WIDTH = Number(laneInput.value);
    if (laneValue) laneValue.textContent = ROAD_WIDTH;
  });
}

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Updated controls to focus on the map's center
controls.target.set(0, 0, 0); // Adjust if needed based on the map's center
controls.update();

// Optional: Adjust zoom for a closer perspective
camera.lookAt(0, 0, 0);
camera.zoom = 1; // Adjust the zoom level
camera.updateProjectionMatrix();

// Draggable Objects Array
const draggableObjects = [];
const roads = []; // To track roads for deletion

// Snapping to Grid
const snapGridSize = 10;
function snapToGrid(value) {
  return Math.round(value / snapGridSize) * snapGridSize;
}

/* ===============================
   GAME STATE (UI + ECONOMY)
================================ */

const gameState = {
  crafties: 1000,
  streetLightBuilt: false,
  houseBuilt: false,
  customModelBuilt: false,
  happiness : 0,
};

/* ===============================
   UI REFERENCES (BUILD PANEL)
================================ */

const planPanel = document.getElementById("new-plan-options");
const newPlanBtn = document.getElementById("NewPlan");
const coinCountEl = document.getElementById("coinCount");

// Raycaster and Mouse Vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener("pointerdown", onPointerDown);

function onPointerDown(event) {

  // 🛑 BLOCK ALL UI CLICKS
  if (
    event.target.closest("#context-actions") ||
    event.target.closest(".close-panel") ||
    event.target.closest(".menu-bottom") ||
    event.target.closest(".menu-top")
  ) {
    return;
  }

  // ✅ ALWAYS update mouse FIRST
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  /* ======================
    TREE MODE (PRIORITY)
  ====================== */
  if (treeMode) {
    const hits = raycaster.intersectObject(terrain);
    if (!hits.length) return;

    plantTree(hits[0].point);
    treeMode = false;
    return;
  }

  /* ======================
    ROAD MODE
  ====================== */
  if (roadMode) {
    isDrawingRoad = true;
    addRoadPoint(event);
    return;
  }

  /* ======================
     NORMAL SELECTION
  ====================== */
  const intersects = raycaster.intersectObjects(draggableObjects, true);

  if (!intersects.length) {
    contextPanel.style.display = "none";
    selectedObject = null;
    return;
  }

  let obj = intersects[0].object;
  while (obj.parent && !obj.userData.type) obj = obj.parent;
  if (!obj.userData.type) return;

  selectedObject = obj;

  const pos = worldToScreen(obj.position, camera);
  contextPanel.style.left = `${pos.x + 20}px`;
  contextPanel.style.top = `${pos.y - 40}px`;
  contextPanel.style.display = "flex";
}

function plantTree(position) {
  const loader = new GLTFLoader();
  loader.load("./models/tree.glb", (gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);

    group.position.set(position.x, 0, position.z);

    group.userData = {
      type: "tree",
      cost: 10
    };

    draggableObjects.push(group);
    scene.add(group);
    initializeDragControls();
    calculateHappiness();
  });
}

window.addEventListener("pointermove", (e) => {
  if (!roadMode || !isDrawingRoad) return;
  addRoadPoint(e);
});

window.addEventListener("pointerup", () => {
  isDrawingRoad = false;
  lastDrawPoint = null;
});

function addRoadPoint(event) {
  if (!terrain) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObject(terrain);
  if (!hits.length) return;

  const point = hits[0].point.clone();
  point.y = 0.05;

  // distance threshold (smoothness control)
  if (lastDrawPoint && lastDrawPoint.distanceTo(point) < 2) return;

  roadPoints.push(point);
  lastDrawPoint = point;

  updateRoadPreview();
}

function updateRoadPreview() {
  if (previewLine) scene.remove(previewLine);

  if (roadPoints.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(roadPoints);
  const points = curve.getPoints(roadPoints.length * 10);

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 2
  });

  previewLine = new THREE.Line(geometry, material);
  scene.add(previewLine);
}

document.addEventListener("keydown", (e) => {
  if (!roadMode) return;

  if (e.key === "Escape") {
    cancelRoad();
  }

  if (e.key === "Enter") {
    finalizeRoad();
  }
});

function finalizeRoad() {
  if (roadPoints.length < 2) {
    cancelRoad();
    return;
  }

  if (previewLine) {
    scene.remove(previewLine);
    previewLine = null;
  }

  buildFinalRoad(roadPoints);

  roadPoints = [];
  roadMode = false;
  controls.enabled = true;
}

function cancelRoad() {
  if (previewLine) scene.remove(previewLine);
  previewLine = null;
  roadPoints = [];
  roadMode = false;
  controls.enabled = true;
}

function buildFinalRoad(points) {
  const curve = new THREE.CatmullRomCurve3(points);
  curve.tension = 0.5;

  const divisions = points.length * 20;
  const curvePoints = curve.getPoints(divisions);
  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < curvePoints.length; i++) {
    const p = curvePoints[i];
    const t = curve.getTangent(i / curvePoints.length);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();

    const left = p.clone().add(n.clone().multiplyScalar(ROAD_WIDTH / 2));
    const right = p.clone().add(n.clone().multiplyScalar(-ROAD_WIDTH / 2));

    vertices.push(left.x, 0.02, left.z);
    vertices.push(right.x, 0.02, right.z);

    uvs.push(0, i / curvePoints.length);
    uvs.push(1, i / curvePoints.length);

    if (i < curvePoints.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const roadMaterial = createRoadMaterial();

  const road = new THREE.Mesh(geometry, roadMaterial);
  road.userData = { type: "road", cost: Math.round(curve.getLength()) };

  scene.add(road);
  draggableObjects.push(road);

  initializeDragControls();
}

function createRoadMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      void main() {
        vec3 asphalt = vec3(0.18, 0.18, 0.18);

        float centerLine = abs(vUv.x - 0.5);
        float stripe = step(centerLine, 0.02);
        float dash = step(0.5, fract(vUv.y * 8.0));

        vec3 color = mix(asphalt, vec3(1.0), stripe * dash);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

document.getElementById("deleteObject").addEventListener("click", (e) => {
  e.stopPropagation(); // 🔥 CRITICAL

  if (!selectedObject) return;

  const refund = selectedObject.userData?.cost || 0;

  gameState.crafties += refund;
  updateCrafties();

  scene.remove(selectedObject);

  const index = draggableObjects.indexOf(selectedObject);
  if (index !== -1) draggableObjects.splice(index, 1);

  selectedObject = null;
  contextPanel.style.display = "none";

  calculateHappiness();
});

document.getElementById("duplicateObject").addEventListener("click", (e) => {
  e.stopPropagation(); // 🔥 CRITICAL

  if (!selectedObject) return;

  const cost = selectedObject.userData?.cost || 0;
  if (gameState.crafties < cost) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= cost;
  updateCrafties();

  const clone = selectedObject.clone(true);

  clone.traverse(child => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.geometry = child.geometry.clone();
    }
  });

  clone.position.copy(selectedObject.position);
  clone.position.x += 10;
  clone.position.z += 10;

  clone.userData = { ...selectedObject.userData };

  scene.add(clone);
  draggableObjects.push(clone);

  initializeDragControls();
  calculateHappiness();
});

document.getElementById("PlantTree").addEventListener("click", () => {
  if (!terrain) {
    alert("Map still loading");
    return;
  }
  roadMode = false; 
  treeMode = true;
  alert("Tree mode ON\nClick on ground to plant tree");
});

document.getElementById("Road").addEventListener("click", () => {
  if (!terrain) {
    alert("Map still loading");
    return;
  }

  treeMode = false;        // ensure tree mode off
  roadMode = true;
  roadPoints = [];
  previewLine = null;

  controls.enabled = false;  // 🔥 LOCK CAMERA

  alert("Road mode ON\nHold mouse & draw\nEnter = finish\nEsc = cancel");
});

let selectedObject = null;

const contextPanel = document.getElementById("context-actions");

function getRootBuildObject(obj) {
  while (obj.parent && !obj.userData.type) {
    obj = obj.parent;
  }
  return obj.userData.type ? obj : null;
}

function calculateHappiness() {
  const houses = draggableObjects.filter(o => o.userData.type === "house").length;
  const lights = draggableObjects.filter(o => o.userData.type === "streetLight").length;
  const customs = draggableObjects.filter(o => o.userData.type === "customModel").length;

  let happiness = 0;

  // Housing (max 40)
  happiness += Math.min(houses * 10, 40);

  // Safety & infrastructure (max 30)
  happiness += Math.min(lights * 7, 30);

  // Balanced development bonus
  if (houses > 0 && lights > 0) happiness += 10;

  // Overbuilding penalty
  if (customs > houses * 2) happiness -= 10;

  // Resource efficiency
  if (gameState.crafties > 200) happiness += 10;
  else if (gameState.crafties < 50) happiness -= 10;

  gameState.happiness = Math.max(0, Math.min(100, happiness));

  document.querySelector(".xp .count").textContent =
    `Happiness-${gameState.happiness}`;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
});

function worldToScreen(position, camera) {
  const vector = position.clone().project(camera);

  return {
    x: (vector.x * 0.5 + 0.5) * window.innerWidth,
    y: (-vector.y * 0.5 + 0.5) * window.innerHeight
  };
}

// Initialize Drag Controls
function initializeDragControls() {
  if (dragControls) dragControls.dispose();

  dragControls = new DragControls(draggableObjects, camera, renderer.domElement);

  dragControls.addEventListener("dragstart", () => {
    controls.enabled = false;
  });

  dragControls.addEventListener("dragend", (e) => {
    controls.enabled = true;

    // snap non-road objects only
    if (e.object.userData?.type !== "road") {
      e.object.position.x = snapToGrid(e.object.position.x);
      e.object.position.z = snapToGrid(e.object.position.z);
    }
  });

  dragControls.addEventListener("dragend", () => {
    controls.enabled = true;
  });
}

async function fetchJSONData() {

  console.log("in func 1");
  addNewMesh();

  const url = "https://glsmoodle.in/vaat/newplace.php";
 
  const params = new URLSearchParams();
params.append("user_id", localStorage.getItem("user_id"));
params.append("place", localStorage.getItem("place"));
params.append("point_x", "10");
params.append("point_y", "30");

  try {
    const response = await fetch(url, {
      method: "POST", // HTTP method
      headers: {
          "Content-Type": "application/x-www-form-urlencoded",
      },
      mode: "cors",
      body: params.toString() // Convert object to JSON string
    });
    const data = await response.json();
    console.log("Fetched Data:", data);

    // if (!response.ok) {
    //   throw new Error(HTTP error! Status: ${response.status});
    // }

    // const data = await response.json();
    // console.log("Fetched Data:", data);

    // Store data into the array
    // data.forEach(item => dataArray.push(item));
    // console.log("Data stored in array:", dataArray);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
  // try {
  //   const response = await fetch(url);
  //   const data = await response.json();
    
  //   // data.forEach(item => dataArray.push(item));
  //   console.log("Fetched JSON data:", data);

  //   // Use the fetched data to dynamically create objects in THREE.js
  //   // mapDataToObjects(dataArray);
  // } catch (error) {
  //   console.error("Error fetching JSON data:", error);
  // }
}

// Add Block Functionality
function addNewMesh() {
  const COST = 40;

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
  );

  box.position.set(
    Math.random() * 50 - 25,
    2.6,
    Math.random() * 50 - 25
  );

  box.userData = {
    type: "customModel",
    cost: COST
  };

  draggableObjects.push(box);
  scene.add(box);
}

// Save and Load State
function saveState() {
  const state = draggableObjects.map((object) => ({
    position: object.position.clone(),
    color: object.material.color.getHex(),
  }));
  localStorage.setItem('sceneState', JSON.stringify(state));
  console.log('State saved:', state);
}

function loadState() {
  const savedState = JSON.parse(localStorage.getItem('sceneState'));
  if (savedState) {
    savedState.forEach((data) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(5, 5, 5),
        new THREE.MeshStandardMaterial({ color: data.color })
      );
      box.position.copy(data.position);
      draggableObjects.push(box);
      scene.add(box);
    });
    console.log('State loaded:', savedState);
  }
}

// Add Model Functionality
function addModel(url, position = { x: 0, y: 0, z: 0 }) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.position.set(position.x, position.y, position.z);
      draggableObjects.push(model);
      scene.add(model);
    },
    undefined,
    (error) => console.error('Error loading model:', error)
  );
}

document.getElementById("closeContextPanel").addEventListener("click", (e) => {
  e.stopPropagation();        // 🔥 BLOCK scene click
  contextPanel.style.display = "none";
  selectedObject = null;
});

// Dropdown for Model Selection
const dropdown = document.createElement('select');
dropdown.style.display = 'none';
dropdown.style.marginTop = '10px';
dropdown.style.backgroundColor = '#555';
dropdown.style.color = 'white';
dropdown.style.border = 'none';
dropdown.style.padding = '5px';
dropdown.style.borderRadius = '5px';
dropdown.style.cursor = 'pointer';
dropdown.addEventListener('change', (event) => {
  const modelUrl = event.target.value;
  if (modelUrl) {
    addModel(modelUrl);
    dropdown.value = '';
  }
});

// Predefined Models
const models = [
  { name: 'Car', url: './models/car.glb' },
  { name: 'Tree', url: './models/tree.glb' },
  { name: 'House', url: './models/brick_house.glb' },
];

// Populate Dropdown
models.forEach((model) => {
  const option = document.createElement('option');
  option.value = model.url;
  option.textContent = model.name;
  dropdown.appendChild(option);
});

// PWA Install Button Logic
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function myFun()
{
  const tree1 = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
tree1.position.set(-10, 0, 0);
scene.add(tree1);

const tree2 = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
tree2.position.set(10, 0, 0);
scene.add(tree2);

// Use the function to draw the path between the trees
// drawPath(tree1.position, tree2.position);


// Create a popup modal for model selection
function showModelPopup() {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = '#333';
  modal.style.color = 'white';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.zIndex = '1000';
  modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  modal.style.textAlign = 'center';

  const heading = document.createElement('h3');
  heading.textContent = 'Select a Model';
  modal.appendChild(heading);

  models.forEach((model) => {
    const button = document.createElement('button');
    button.textContent = model.name;
    button.style.backgroundColor = '#555';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.padding = '10px 20px';
    button.style.margin = '5px';
    button.style.cursor = 'pointer';
    button.style.borderRadius = '5px';
    button.addEventListener('click', () => {
      addModel(model.url);
      document.body.removeChild(modal);
    });
    modal.appendChild(button);
  });

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.backgroundColor = '#555';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.padding = '10px 20px';
  closeButton.style.margin = '5px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.borderRadius = '5px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  modal.appendChild(closeButton);

  document.body.appendChild(modal);
}
}

document.addEventListener('DOMContentLoaded', () => {

  // ROAD BUTTON — ENTER ROAD MODE
  const roadBtn = document.getElementById("Road");
  roadBtn.addEventListener("click", () => {
    roadMode = true;
    roadPoints = [];
    alert("Road mode ON: click on ground to draw road");
  });

  // SAVE / LOAD
  document.getElementById('Save').addEventListener('click', saveState);
  document.getElementById('Load').addEventListener('click', loadState);
});

  /* ===============================
   BUILD ACTIONS (UI → GAME → 3D)
================================ */

function updateCrafties() {
  coinCountEl.textContent = `crafties-${gameState.crafties}`;
}

window.buildStreetLight = function () {
  const COST = 20;

  if (gameState.crafties < COST) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= COST;
  updateCrafties();

  const loader = new GLTFLoader();
  loader.load('./models/street_lamp.glb', (gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);

    group.position.set(
      Math.random() * 50 - 25,
      0,
      Math.random() * 50 - 25
    );

    group.userData = {
      type: "streetLight",
      cost: COST
    };

    draggableObjects.push(group);
    scene.add(group);

    dragControls.dispose();
    initializeDragControls();

    calculateHappiness();
  });
};

window.buildHouse = function () {
  const COST = 30;

  if (gameState.crafties < COST) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= COST;
  updateCrafties();

  const loader = new GLTFLoader();
  loader.load('./models/brickhouse.glb', (gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);

    group.position.set(20, 0, 20);

    group.userData = {
      type: "house",
      cost: COST
    };

    draggableObjects.push(group);
    scene.add(group);

    dragControls.dispose();
    initializeDragControls();

    calculateHappiness();
  });
};


window.buildCustomModel = function () {
  if (gameState.customModelBuilt) return;

  const COST = 40;
  if (gameState.crafties < COST) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= COST;
  gameState.customModelBuilt = true;
  updateCrafties();

  const group = new THREE.Group();
  addNewMesh();
  updateCrafties();
  calculateHappiness();
};

  /* ===============================
   BUILD PANEL CONTROLS100
    ================================ */

    newPlanBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      planPanel.style.display = "flex";
    });

    window.closeBuildPanel = function () {
      planPanel.style.display = "none";
    };

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

function setAerialView() {
  controls.enabled = false;

  camera.position.set(0, 250, 0.01); // straight above
  camera.lookAt(0, 0, 0);

  controls.target.set(0, 0, 0);
  controls.update();

  setTimeout(() => {
    controls.enabled = true;
  }, 100);
}

async function createTerrain() {
  const textureLoader = new THREE.TextureLoader();

  const texture = textureLoader.load('./lalpur_c.png', () => {
    renderer.render(scene, camera);
  });

  texture.colorSpace = THREE.SRGBColorSpace;

  const SIZE = 200;

  const geometry = new THREE.PlaneGeometry(SIZE, SIZE);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0
  });

  terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.userData.isTerrain = true;

  scene.add(terrain);

  // camera fix
  controls.target.set(0, 0, 0);
  camera.position.set(0, 120, 120);
  camera.lookAt(0, 0, 0);
  controls.update();

  initializeDragControls();
}

// Initialize Terrain
createTerrain();