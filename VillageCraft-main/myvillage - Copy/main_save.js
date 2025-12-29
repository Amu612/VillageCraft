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

// Initialize Drag Controls
function initializeDragControls() {
  dragControls = new DragControls(draggableObjects, camera, renderer.domElement);

  dragControls.addEventListener('dragstart', () => {
    controls.enabled = false;
  });

  dragControls.addEventListener('dragend', (event) => {
    controls.enabled = true;

    // Snap to grid after dragging
    const object = event.object;
    object.position.x = snapToGrid(object.position.x);
    object.position.z = snapToGrid(object.position.z);
  });
}

// Terrain Creation
async function loadPNGTexture(url) {
  const textureLoader = new THREE.TextureLoader();
  return textureLoader.load(url);
}

async function createTerrain() {
  const texture = await loadPNGTexture('./assets/lalpur_35.png');
  const width = 100;
  const height = 100;
  const segments = 256;

  const geometry = new THREE.PlaneGeometry(width, height, segments - 1, segments - 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
  });

  const terrain = new THREE.Mesh(geometry, material);
  scene.add(terrain);

  // Add initial draggable objects
  // for (let i = 0; i < 3; i++) {
  //   const box = new THREE.Mesh(
  //     new THREE.BoxGeometry(10, 30, 10),
  //     new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
  //   );
  //   box.position.set(Math.random() * 50 - 25, 5, Math.random() * 50 - 25);
  //   draggableObjects.push(box);
  //   scene.add(box);
  // }

  // Enable DragControls
  initializeDragControls();
}

// Add New Mesh Functionality
function addNewMesh() {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
  );
  box.position.set(Math.random() * 50 - 25, 5, Math.random() * 50 - 25);
  draggableObjects.push(box);
  scene.add(box);

  // Update DragControls
  dragControls.objects.push(box);
  console.log('New mesh added to the scene.');
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
    (error) => console.error('An error occurred loading the model:', error)
  );
}

// PWA Install Button Logic
let deferredPrompt = null;

// Show the button when the `beforeinstallprompt` event is fired
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Prevent the default install prompt
  deferredPrompt = e;
  createToolbarButton('Install App', handleInstallClick); // Add install button to the toolbar
});

function handleInstallClick() {
  if (deferredPrompt) {
    deferredPrompt.prompt(); // Show the install prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null; // Reset the deferred prompt
    });
  }
}

// Toolbar Buttons
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
document.body.appendChild(toolbar);

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

createToolbarButton('Add Box', addNewMesh);
createToolbarButton('Save State', saveState);
createToolbarButton('Load State', loadState);
createToolbarButton('Add Model', () => addModel('./path/to/model.glb'));

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Load Terrain
createTerrain();
