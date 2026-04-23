# Antigravity Racing - High-Performance Physics Simulation

A premium, open-source car physics simulation built with **Three.js** and **Ammo.js**. This project demonstrates advanced physics integration, spatial partitioning for terrain collisions, and a modern "attract-mode" UI.

![Menu Concept](car_sim_menu_concept_1776944213086.png)

## 🚀 Features

- **Advanced Vehicle Physics**: Utilizing `btRaycastVehicle` from Ammo.js (Bullet Physics) for realistic suspension, friction, and engine dynamics.
- **Spatial Grid Partitioning**: Custom `WorldManager` that splits large terrain meshes into a spatial grid to optimize collision detection and prevent physics engine stutter.
- **Attract Mode UI**: A modern, glassmorphic selection menu that floats over the live simulation, allowing real-time map and vehicle switching.
- **Physics-Aware Camera**: A custom follow-camera utility that uses raycasting to prevent clipping through terrain and environment geometry.
- **Procedural Spawning**: Automatic terrain scanning via raycasting to find safe, flat spawn points if none are defined in the source assets.
- **CI/CD Integrated**: Automated deployment to GitHub Pages via GitHub Actions.

## 🛠 Tech Stack

- **Core**: HTML5, Vanilla JavaScript (ES6 Modules)
- **3D Engine**: [Three.js](https://threejs.org/)
- **Physics Engine**: [Ammo.js](https://github.com/kripken/ammo.js/) (Bullet Physics WASM port)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Assets**: GLTF/GLB models with custom mesh extraction for chassis and wheels.

## 🏁 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/manthrax/car.git
   cd car
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`.

## 🎮 Controls

- **W / Up**: Accelerate
- **S / Down**: Brake / Reverse
- **A / Left**: Steering Left
- **D / Right**: Steering Right
- **R**: Respawn at a random point
- **Mouse Wheel**: Zoom Camera
- **Escape**: Open Menu / Change Map & Car

## 📂 Project Structure

- `src/Physics.js`: Core Ammo.js world management and raycasting.
- `src/Vehicle.js`: Vehicle class handling chassis/wheel sync and physics application.
- `src/WorldManager.js`: Async GLB loading and spatial collision generation.
- `src/CameraFollow.js`: Physics-aware camera smoothing and collision logic.
- `src/SceneManager.js`: Three.js scene setup, environment mapping, and lighting.
- `src/main.js`: App entry point, UI orchestration, and main loop.

## 📜 License

MIT License. Free to use and modify for personal or commercial projects.
