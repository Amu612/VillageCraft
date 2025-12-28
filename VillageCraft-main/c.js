/* ===============================
   COST CONFIG
================================ */

const COSTS = {
  streetLight: 20,
  house: 30,
  customModel: 40,
  road: 10
};

/* ===============================
   UI REFERENCES
================================ */

const planPanel = document.getElementById("new-plan-options");
const newPlanBtn = document.getElementById("NewPlan");
const coinCountEl = document.getElementById("coinCount");

const streetBtn = document.getElementById("Option1");
const houseBtn = document.querySelector(".build-action.primary");
const customBtn = document.getElementById("Option3");

/* ===============================
   PANEL CONTROLS
================================ */

newPlanBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  planPanel.style.display = "flex";
});

window.closeBuildPanel = function () {
  planPanel.style.display = "none";
};

/* ===============================
   BUILD ACTIONS (ONE-TIME ONLY)
================================ */

window.buildStreetLight = function () {
  if (gameState.streetLightBuilt) return;

  const cost = BUILD_COSTS.streetLight;
  if (gameState.crafties < cost) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= cost;
  gameState.streetLightBuilt = true;
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
      cost: cost
    };

    draggableObjects.push(group);
    scene.add(group);
  });
};

window.buildHouse = function () {
  if (gameState.houseBuilt) return;

  const cost = BUILD_COSTS.house;
  if (gameState.crafties < cost) {
    alert("Not enough crafties!");
    return;
  }

  gameState.crafties -= cost;
  gameState.houseBuilt = true;
  updateCrafties();

  const loader = new GLTFLoader();
  loader.load('./models/brickhouse.glb', (gltf) => {
    const group = new THREE.Group();
    group.add(gltf.scene);

    group.position.set(20, 0, 20);

    group.userData = {
      type: "house",
      cost: cost
    };

    draggableObjects.push(group);
    scene.add(group);
  });
};

window.buildCustomModel = function () {
  if (gameState.customModels >= 1) return;

  if (gameState.coins < COSTS.customModel) {
    alert("Not enough crafties!");
    return;
  }

  gameState.coins -= COSTS.customModel;
  gameState.customModels = 1;

  customBtn.disabled = true;
  customBtn.style.opacity = "0.5";

  updateUI();
};

/* ===============================
   UI UPDATE
================================ */

function updateUI() {
  coinCountEl.textContent = `crafties-${gameState.coins}`;
}
