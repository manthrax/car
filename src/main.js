import * as THREE from 'three';
import SceneManager from './SceneManager.js';
import Physics from './Physics.js';
import Vehicle from './Vehicle.js';
import WorldManager from './WorldManager.js';

async function startApp() {
    // Wait for Ammo.js to be ready
    const AmmoLib = await Ammo();
    console.log('Ammo.js ready');

    const speedometer = document.getElementById('speedometer');

    // 1. Setup Scene
    const sceneManager = new SceneManager();
    await sceneManager.init();

    // 2. Setup Physics
    const physics = new Physics();
    physics.init();

    // 3. Load World & Extract Car Spawn
    const worldManager = new WorldManager(sceneManager.scene, physics);
    const { carBody } = await worldManager.loadWorld('/assets/world.glb');

    // 4. Setup Input
    const actions = {};
    const keysActions = {
        "KeyW": 'acceleration',
        "KeyS": 'braking',
        "KeyA": 'left',
        "KeyD": 'right'
    };

    window.addEventListener('keydown', (e) => {
        if (keysActions[e.code]) actions[keysActions[e.code]] = true;
    });
    window.addEventListener('keyup', (e) => {
        if (keysActions[e.code]) actions[keysActions[e.code]] = false;
    });

    // 5. Setup Vehicle at Spawn Point
    let spawnPos = new THREE.Vector3(0, 4, -20);
    let spawnQuat = new THREE.Quaternion(0, 0, 0, 1);

    if (carBody) {
        spawnPos.copy(carBody.position);
        spawnPos.x += 2; // Offset from the model as in your demo
        spawnPos.y += 2;
    }

    const vehicle = new Vehicle(physics, sceneManager.scene, spawnPos, spawnQuat);

    // 6. Animation Loop
    function tick() {
        requestAnimationFrame(tick);
        
        const dt = sceneManager.clock.getDelta();
        
        physics.update(dt);
        
        const speed = vehicle.update(actions, sceneManager.camera, sceneManager.controls);
        
        // Update UI
        speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';
        
        sceneManager.render();
    }

    tick();
}

startApp().catch(err => {
    console.error('Failed to start app:', err);
});
