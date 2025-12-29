
document.addEventListener('DOMContentLoaded', () => {
  // Fetch the button element
  const button = document.getElementById('NewPlan');

  // Assign a click event
  button.addEventListener('click', () => {
      console.log('Button clicked!');
  });
});
// import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
// import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
// import { DragControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/DragControls.js';


// // Set up the scene, camera, and renderer
// const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight - 100), 0.1, 1000);
// const renderer = new THREE.WebGLRenderer();
// const container = document.getElementById('map-container');

// renderer.setSize(container.offsetWidth, container.offsetHeight);
// container.appendChild(renderer.domElement);

// // Add OrbitControls
// const controls = new THREE.OrbitControls(camera, renderer.domElement);
// camera.position.set(0, 10, 20);
// controls.update();

// // Add a simple cube to the scene
// const geometry = new THREE.BoxGeometry();
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

// // Add a light
// const light = new THREE.PointLight(0xffffff, 1, 100);
// light.position.set(10, 10, 10);
// scene.add(light);

// // Animate the scene
// function animate() {
//   requestAnimationFrame(animate);
//   controls.update();
//   renderer.render(scene, camera);
// }

// animate();

// // Adjust camera and renderer on window resize
// window.addEventListener('resize', () => {
//   const containerHeight = window.innerHeight - 100;
//   camera.aspect = window.innerWidth / containerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(container.offsetWidth, containerHeight);
// });
