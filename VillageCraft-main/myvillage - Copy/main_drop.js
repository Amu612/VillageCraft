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
  selectedObject = intersects.length > 0 ? intersects[0].object : null;
}

// Delete Selected Object
function deleteSelectedObject() {
  if (selectedObject) {
    scene.remove(selectedObject);
    const index = draggableObjects.indexOf(selectedObject);
    if (index > -1) draggableObjects.splice(index, 1);
    selectedObject = null;
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
  dragControls.objects.push(box);
}

// Save and Load State
function saveState() {
  const state = draggableObjects.map((object) => ({
    position: object.position.clone(),
    color: object.material.color.getHex(),
  }));
  localStorage.setItem('sceneState', JSON.stringify(state));
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

// Dropdown Menu Setup
const menuButton = document.createElement('button');
menuButton.textContent = 'Menu';
menuButton.style.position = 'fixed';
menuButton.style.top = '10px';
menuButton.style.left = '10px';
menuButton.style.backgroundColor = '#555';
menuButton.style.color = 'white';
menuButton.style.border = 'none';
menuButton.style.padding = '10px';
menuButton.style.cursor = 'pointer';
menuButton.style.borderRadius = '5px';
document.body.appendChild(menuButton);

const dropdownMenu = document.createElement('div');
dropdownMenu.style.position = 'fixed';
dropdownMenu.style.top = '50px';
dropdownMenu.style.left = '10px';
dropdownMenu.style.backgroundColor = '#333';
dropdownMenu.style.color = 'white';
dropdownMenu.style.padding = '10px';
dropdownMenu.style.borderRadius = '5px';
dropdownMenu.style.display = 'none'; // Initially hidden
dropdownMenu.style.flexDirection = 'column';
dropdownMenu.style.gap = '10px';
document.body.appendChild(dropdownMenu);

function createDropdownButton(label, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.backgroundColor = '#555';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '5px 10px';
  button.style.cursor = 'pointer';
  button.style.borderRadius = '5px';
  button.addEventListener('click', onClick);
  dropdownMenu.appendChild(button);
}

createDropdownButton('Add Box', addNewMesh);
createDropdownButton('Save State', saveState);
createDropdownButton('Load State', loadState);
createDropdownButton('Add Model', () => addModel('./path/to/model.glb'));
createDropdownButton('Delete Object', deleteSelectedObject);

// Toggle dropdown menu visibility
menuButton.addEventListener('click', () => {
  dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'flex' : 'none';
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Load Terrain
createTerrain();
