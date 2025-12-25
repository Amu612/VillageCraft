// Import Three.js and controls
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/DragControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Updated camera position for closer initial view
camera.position.set(0, 100, 0); // Adjust based on your map's dimensions
camera.lookAt(0, 0, 0); // Look at the map's center

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10).normalize();
scene.add(light);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Updated controls to focus on the map's center
controls.target.set(0, 0, 0); // Adjust if needed based on the map's center
controls.update();

// Optional: Adjust zoom for a closer perspective
camera.zoom = 8; // Adjust the zoom level
camera.updateProjectionMatrix();

// Grid Helper
// const gridSize = 100;
// const gridDivisions = 25;
// const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
// scene.add(gridHelper);

// Draggable Objects Array
const draggableObjects = [];
const roads = []; // To track roads for deletion
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

// // Delete Selected Object
// function deleteSelectedObject() {
//   if (selectedObject) {
//     scene.remove(selectedObject);
//     const index = draggableObjects.indexOf(selectedObject);
//     if (index > -1) draggableObjects.splice(index, 1);
//     console.log('Object deleted:', selectedObject);
//     selectedObject = null;
//   } else {
//     console.log('No object selected to delete');
//   }
// }
// Delete the last object added to the scene
function deleteLastObject() {
  if (draggableObjects.length > 0) {
    const lastObject = draggableObjects.pop(); // Remove the last object from the array
    scene.remove(lastObject); // Remove it from the scene
    console.log('Last object deleted:', lastObject);
  } else {
    console.log('No objects to delete');
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

let terrain; // Declare terrain in a shared scope

async function createTerrain() {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load('./lalpur_c.png');
  const geometry = new THREE.PlaneGeometry(100, 100, 256 - 1, 256 - 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
  });

  terrain = new THREE.Mesh(geometry, material); // Assign the terrain to the shared variable
  scene.add(terrain);

  initializeDragControls();
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
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
  );
  box.position.set(Math.random() * 50 - 25, 2.6, Math.random() * 50 - 25);
  //box.position.set(10,2.6,30);
  // localStorage.setItem("10",point_x);
  // localStorage.setItem("30",point_z);
  draggableObjects.push(box);
  scene.add(box);

   console.log('New block added to the scene.');
}
// Add Model as a Block

// function addNewMesh() {
//   const loader = new GLTFLoader();
//   const modelUrl = './models/brick.glb'; // Replace with the path to your desired model

//   loader.load(
//     modelUrl,
//     (gltf) => {
//       const model = gltf.scene;

//       // Randomly position the model within bounds
//       model.position.set(
//         Math.random() * 50 - 25, // Random X position
//         0, // Place on the ground
//         Math.random() * 50 - 25 // Random Z position
//       );

//       draggableObjects.push(model);
//       scene.add(model);

//       // Add the model to drag controls
//       dragControls.objects.push(model);

//       console.log('New model added to the scene.');
//     },
//     undefined,
//     (error) => console.error('Error loading model:', error)
//   );
// }


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

// function addMarker(position) {
//   const geometry = new THREE.SphereGeometry(2, 16, 16);
//   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
//   const marker = new THREE.Mesh(geometry, material);
//   marker.position.copy(position);
//   scene.add(marker);
//   marker.push(marker);
//   console.log('Marker added at:', position);
// }

// function createRoad() {
//   if (markers.length < 2) return; // Wait until two markers are added

//   // Get the positions of the two markers
//   const start = markers[0].position;
//   const end = markers[1].position;

//   // Calculate the midpoint and length of the road
//   const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
//   const length = start.distanceTo(end);

//   // Create the road geometry (thin rectangular box)
//   const geometry = new THREE.BoxGeometry(length, 1, 5); // Length x Thickness x Width
//   const material = new THREE.MeshBasicMaterial({ color: 0x808080 }); // Gray color
//   const road = new THREE.Mesh(geometry, material);

//   // Position and rotate the road
//   road.position.copy(midpoint);
//   road.lookAt(end); // Align road with the end marker
//   road.rotateX(Math.PI / 2); // Adjust rotation to lay flat
//   scene.add(road);
//   roads.push(road);

//   // Remove markers after creating the road (optional)
//   // markers.forEach((marker) => scene.remove(marker));

//   // Clear markers array after use (optional)
//   markers = []; // Clear markers array

//   console.log('Road created between markers:', start, end);
// }

function onScreenClick(event) {
  // Convert click to normalized device coordinates (NDC)
  const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
  );

  // Raycast to find intersected objects
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(terrain); // Assuming `terrain` is the ground object

  if (intersects.length > 0) {
      const position = intersects[0].point; // Get the intersection point
      addMarker(position);

      if (markers.length === 2) {
          createRoad(); // Create a road after two markers are added
      }
  }
}

// Add event listener for user clicks
window.addEventListener('click', onScreenClick);


// // Toolbar
// const toolbar = document.createElement('div');
// toolbar.style.position = 'fixed';
// toolbar.style.top = '10px';
// toolbar.style.left = '10px';
// toolbar.style.backgroundColor = '#333';
// toolbar.style.color = 'white';
// toolbar.style.padding = '10px';
// toolbar.style.borderRadius = '5px';
// toolbar.style.display = 'flex';
// toolbar.style.gap = '10px';
// toolbar.style.alignItems = 'center';
// document.body.appendChild(toolbar);

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

// // Create Toolbar Button
// function createToolbarButton(label, onClick) {
//   const button = document.createElement('button');
//   button.textContent = label;
//   button.style.backgroundColor = '#555';
//   button.style.color = 'white';
//   button.style.border = 'none';
//   button.style.padding = '5px 10px';
//   button.style.cursor = 'pointer';
//   button.style.borderRadius = '5px';
//   button.addEventListener('click', onClick);
//   toolbar.appendChild(button);
// }

// Toolbar Buttons
// // createToolbarButton('Add Block', addNewMesh);
// createToolbarButton('Add Model', () => {
//   dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
// });
// createToolbarButton('Save State', saveState);
// createToolbarButton('Load State', loadState);
// createToolbarButton('Delete Object', deleteLastObject);

// Append Dropdown to Toolbar
// toolbar.appendChild(dropdown);

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
drawPath(tree1.position, tree2.position);


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

// Camera position
camera.position.z = 30;
}
  document.addEventListener('DOMContentLoaded', () => {
    // Fetch the button element
    // Toggle display of New Plan options
document.getElementById('NewPlan').addEventListener('click', () => {
    const options = document.getElementById('new-plan-options');
    options.style.display = options.style.display === 'none' ? 'block' : 'none';
});

// Option 1: Add a Tree
document.getElementById('Option1').addEventListener('click', () => {
  localStorage.setItem("place","streetlight");
  fetchJSONData();
  const loader = new GLTFLoader();
  const modelUrl = './models/street_lamp.glb'; // Replace with the desired model path
  loader.load(
      modelUrl,
      (gltf) => {
          const model = gltf.scene;
          model.position.set(Math.random() * 50 - 25, 2.6, Math.random() * 50 - 25);;
          draggableObjects.push(model);
          scene.add(model);
          console.log('Custom model added to the scene.');
      },
      undefined,
      (error) => console.error('Error loading model:', error)
  );
});

// Option 2: Add a House
document.getElementById('Option2').addEventListener('click', () => {
  const loader = new GLTFLoader();
  const modelUrl = './models/brickhouse.glb';
  loader.load(
      modelUrl,
      (gltf) => {
          const model = gltf.scene;
          model.position.set(20, 0, 20);
          draggableObjects.push(model);
          scene.add(model);
          console.log('Custom model added to the scene.');
      },
      undefined,
      (error) => console.error('Error loading model:', error)
  );
});

// Option 3: Add a Custom Model
document.getElementById('Option3').addEventListener('click', () => {

  console.log("print in click");
    // const loader = new GLTFLoader();
    // const modelUrl = './models/custom_model.glb'; // Replace with the desired model path
    // loader.load(
    //     modelUrl,
    //     (gltf) => {
    //         const model = gltf.scene;
    //         model.position.set(20, 0, 20);
    //         draggableObjects.push(model);
    //         scene.add(model);
    //         console.log('Custom model added to the scene.');
    //     },
    //     undefined,
    //     (error) => console.error('Error loading model:', error)
    // );
    localStorage.setItem("place","building");
    fetchJSONData();
});

    document.getElementById('Road').addEventListener('click', myFun);
    document.getElementById('Save').addEventListener('click', saveState);
    document.getElementById('Load').addEventListener('click', loadState);
    document.getElementById('Delete').addEventListener('click', deleteLastObject);

    // const button = document.getElementById('NewPlan');
    // // Assign a click event
    // button.addEventListener('click', () => {
    //     console.log('Button clicked!');
    //     addNewMesh();
    // });
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
  