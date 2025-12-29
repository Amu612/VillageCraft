// Import Three.js and controls
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/DragControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10).normalize();
scene.add(light);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 50, 100);
controls.update();

// Grid Helper
const gridSize = 100;
const gridDivisions = 10;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
scene.add(gridHelper);

// Draggable Objects Array
const draggableObjects = [];
let dragControls;

// Snapping to Grid
const snapGridSize = 10;
function snapToGrid(value) {
  return Math.round(value / snapGridSize) * snapGridSize;
}

// Raycaster and Mouse Vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;

// Mouse Click Handler
function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(draggableObjects, true);
  if (intersects.length > 0) {
    selectedObject = intersects[0].object;
    console.log('Object selected:', selectedObject);
  } else {
    selectedObject = null;
    console.log('No object selected');
  }
}

// Delete Selected Object
function deleteSelectedObject() {
  if (selectedObject) {
    scene.remove(selectedObject);
    const index = draggableObjects.indexOf(selectedObject);
    if (index > -1) draggableObjects.splice(index, 1);
    console.log('Object deleted:', selectedObject);
    selectedObject = null;
  } else {
    console.log('No object selected to delete');
  }
}

// Add Event Listener for Mouse Clicks
window.addEventListener('click', onMouseClick);

// Initialize Drag Controls
function initializeDragControls() {
  dragControls = new DragControls(draggableObjects, camera, renderer.domElement);

  dragControls.addEventListener('dragstart', () => {
    controls.enabled = false;
  });

  dragControls.addEventListener('dragend', (event) => {
    controls.enabled = true;
    const object = event.object;
    object.position.x = snapToGrid(object.position.x);
    object.position.z = snapToGrid(object.position.z);
  });
}

// Terrain Creation
async function createTerrain() {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load('./assets/lalpur_c.png');
  const geometry = new THREE.PlaneGeometry(100, 100, 256 - 1, 256 - 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
  });

  const terrain = new THREE.Mesh(geometry, material);
  scene.add(terrain);

  initializeDragControls();
}

// Add Block Functionality
function addNewMesh() {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
  );
  box.position.set(Math.random() * 50 - 25, 5, Math.random() * 50 - 25);
  draggableObjects.push(box);
  scene.add(box);

  dragControls.objects.push(box);
  console.log('New block added to the scene.');
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
        new THREE.BoxGeometry(10, 10, 10),
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

// Toolbar
const toolbar = document.createElement('div');
toolbar.style.position = 'fixed';
toolbar.style.top = '10px';
toolbar.style.left = '10px';
toolbar.style.backgroundColor = '#333';
toolbar.style.color = 'white';
toolbar.style.padding = '10px';
toolbar.style.borderRadius = '5px';
toolbar.style.display = 'flex';
toolbar.style.gap = '10px';
toolbar.style.alignItems = 'center';
document.body.appendChild(toolbar);

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
  { name: 'House', url: './models/house1.glb' },
];

// Populate Dropdown
models.forEach((model) => {
  const option = document.createElement('option');
  option.value = model.url;
  option.textContent = model.name;
  dropdown.appendChild(option);
});

// Create Toolbar Button
function createToolbarButton(label, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.backgroundColor = '#555';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '5px 10px';
  button.style.cursor = 'pointer';
  button.style.borderRadius = '5px';
  button.addEventListener('click', onClick);
  toolbar.appendChild(button);
}

// Toolbar Buttons
createToolbarButton('Add Block', addNewMesh);
createToolbarButton('Add Model', () => {
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});
createToolbarButton('Save State', saveState);
createToolbarButton('Load State', loadState);
createToolbarButton('Delete Object', deleteSelectedObject);

// Append Dropdown to Toolbar
toolbar.appendChild(dropdown);

// PWA Install Button Logic
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  createToolbarButton('Install App', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      console.log('User choice:', choiceResult.outcome);
      deferredPrompt = null;
    });
  });
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Initialize Terrain
createTerrain();
