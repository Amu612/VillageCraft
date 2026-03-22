# 🧭 Village Craft
**Gamifying Rural Development through Drone Land Survey Maps & 3D Simulation**

> **Smart India Hackathon 2024 (Problem Statement 1704)**

Village Craft is an immersive, 3D web-based simulation platform designed to bridge the gap between rural development planning and community engagement. By utilizing real-world drone imagery and GIS data, the platform allows village youth and stakeholders to visualize, plan, and suggest infrastructure improvements directly to the Gram Panchayat in a gamified, intuitive environment.

---

## ✨ Key Features

### 🗺️ Procedural 3D Environment
- **Real-World GIS Mapping**: Uses GeoJSON architectural data and high-resolution satellite texture maps (`lalpur_c.png`) to recreate actual village layouts.
- **Drone Land Survey Integration**: Renders 3D buildings and structures directly from drone-surveyed spatial coordinates.
- **Adaptive Terrain**: A custom 3D displacement map system ensures buildings and roads sit realistically on the terrain surface.

### 🛣️ Advanced Road System
- **Curved Path Generation**: Implements a Bezier/Catmull-Rom spline system for smooth, non-linear road layouts.
- **Node-Based Connectivity**: Roads intelligently snap to shared endpoints (nodes).
- **Automated Junctions**: Procedurally generates T-junctions and intersections when 3+ roads meet at a single node.

### 🏗️ Construction & Management
- **Unity-Style UI**: A premium, glassmorphism-based interface with structured zones (HUD, Resource Bar, Tool Panels).
- **Resource Management**: Track Energy (⚡), Happiness (😊), and Budget (💰) in real-time.
- **Dynamic Building Tools**: 
    - **Build Tool**: Place houses, street-lights, and trees with animated growth effects.
    - **Bulldozer**: Remove structures and reclaim a portion of the budget.
    - **Upgrade Tool**: Visual and functional upgrades for existing infrastructure.

### 🔁 Persistence & History
- **Undo/Redo System**: A robust action stack that tracks every placement, upgrade, and deletion.
- **State Management**: Centralized game state handling for consistent resource tracking.

---

## 🛠️ Technical Stack
- **Engine**: [Three.js](https://threejs.org/) (WebGL)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Glassmorphism design)
- **Data Formats**: GeoJSON (Buildings), PNG (Terrain/Displacement Maps), GLB/GLTF (3D Models)
- **Icons & UI**: FontAwesome, Google Fonts (Inter/Outfit)

---

## 🚀 Installation & Local Development

1. **Clone the Project**
   ```bash
   git clone https://github.com/[your-username]/VillageCraft.git
   cd VillageCraft
   ```

2. **Run Local Server**
   Since the project uses ES Modules, you need a local server. You can use Python's built-in server:
   ```bash
   # Python 3
   python -m http.server 8000
   ```
   Or using Node.js `serve`:
   ```bash
   npx serve .
   ```

3. **Open in Browser**
   Visit `http://localhost:8000` to start the simulation.

---

## ⌨️ Controls
| Action | Control |
| :--- | :--- |
| **Move Camera** | Right Click + Drag |
| **Rotate Camera** | Left Click + Drag (No Tool) |
| **Zoom** | Mouse Wheel |
| **Place Object** | Left Click (Tool Active) |
| **Finalize Road** | Drag & Release |
| **Demolish** | Hover + Click (Bulldozer) |

---

## 📜 Problem Statement 1704
*Ministry of Panchayati Raj*
**Objective:** To empower the village youth by providing a gamified interface for rural planning using drone land survey maps and GIS data. This ensures that youth can understand and openly contribute their suggestions for the development of their lands.

---

*Note: This project is an ongoing simulation prototype.*
