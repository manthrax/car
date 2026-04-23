# Antigravity Racing - Technical Physics Simulation

**[Live Demo](https://manthrax.github.io/car/)**

A Three.js and Ammo.js based vehicle dynamics simulation focusing on high-fidelity raycast vehicle implementation and optimized terrain collision.

## Technical Architecture

### Physics Integration
- **`btRaycastVehicle`**: Uses Bullet's raycast vehicle model for suspension and traction.
- **`btCompoundShape`**: Chassis is defined as a compound shape of multiple box primitives for more accurate collision response and center-of-mass management.
- **Rescue Mechanics**: Implements roof-point force application for vehicle righting and time-accumulated state resets.

### Collision Optimization
- **Spatial Grid Partitioning**: `WorldManager` partitions large terrain meshes into a grid-based spatial map.
- **`btBvhTriangleMeshShape`**: Each grid cell generates an independent triangle mesh shape to maintain high physics frame rates on complex geometry.
- **Time-Sliced Generation**: Asynchronous collision mesh generation using `requestAnimationFrame` to prevent main-thread blocking during world initialization.

### Camera & Controls
- **Raycast-Based Occlusion**: `CameraFollow` utility performs world-space raycasting from the look-at target to the camera position to prevent geometry clipping.
- **Distance Constraints**: Implements a persistent `desiredDistance` logic that allows temporary collision overrides with automatic recovery.
- **Modular Design**: Decoupled control synchronization allows for easy swapping of input schemas or camera behaviors.

### Lifecycle & State Management
- **Resource Disposal**: Standardized `.dispose()` patterns across `SceneManager` and `Physics` to clear WASM heap memory and GPU resources during world transitions.
- **Attract Mode**: Decoupled initialization allows the simulation to run in a background state (input-locked) while the menu system is active.

## Core Modules

- `src/Physics.js`: Ammo.js world orchestration and raycasting interface.
- `src/Vehicle.js`: `btRaycastVehicle` wrapper and chassis/wheel synchronization.
- `src/WorldManager.js`: GLB parsing, geometry merging, and spatial grid generation.
- `src/CameraFollow.js`: Constraint-based follow logic with physics occlusion.
- `src/SceneManager.js`: WebGL context management and lighting/environment setup.

## Development

```bash
npm install
npm run dev
```

### Controls
- **WASD / Arrows**: Vehicle control.
- **R (Hold)**: Apply upward force to roof (Flip).
- **R (Long Hold)**: Full state reset.
- **Escape**: Toggle Menu / Pause Input.
- **Wheel**: Zoom.
