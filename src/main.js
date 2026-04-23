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
    const info = document.getElementById('info');

    // 1. Setup Scene
    const sceneManager = new SceneManager();
    await sceneManager.init();

    // 2. Setup Physics
    const physics = new Physics();
    physics.init();

    // 3. Load World & Extract Car Spawn
    const worldManager = new WorldManager(sceneManager.scene, physics);
    const { carBody } = await worldManager.loadWorld('/assets/world.glb', (progress) => {
        info.innerHTML = `Generating Collision Mesh: ${(progress * 100).toFixed(1)}%`;
    });

    info.innerHTML = 'Ammo.js Raycast vehicle demo<br>Press W,A,S,D to move.';

    // 4. Setup Input
    const actions = {};
    const keysActions = {
        "KeyW": 'acceleration',
        "KeyS": 'braking',
        "KeyA": 'left',
        "KeyD": 'right',
        "KeyR": 'reset'
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
        //spawnPos.x += 2; // Offset from the model as in your demo
        spawnPos.y += -.5;
    }

    const vehicle = new Vehicle(physics, sceneManager.scene, spawnPos, spawnQuat);

    carBody.parent.remove(carBody)
    let wheel = carBody.getObjectByName("Wheel_FR001");
    let wheels = [carBody.getObjectByName("Wheel_FR001"), carBody.getObjectByName("Wheel_FR002"), carBody.getObjectByName("Wheel_FR003"), carBody.getObjectByName("Wheel_FR004")]

    wheel.geometry.rotateY(Math.PI / 2)
    wheel.geometry.scale(30, 30, 30)
    wheels.forEach(w => w.parent.remove(w))

    sceneManager.scene.add(wheel)

    vehicle.createChassisMesh = () => {
        let m = carBody.clone(true);
        m.position.set(0, .5, 0)
        let o = new THREE.Object3D();
        o.add(m)
        sceneManager.scene.add(o)
        return o;
    }
    vehicle.createWheelMesh = () => {
        let mesh = wheel.clone();
        sceneManager.scene.add(mesh);
        return mesh
    }

    vehicle.init();

    // 6. Animation Loop
    function tick() {
        requestAnimationFrame(tick);

        const dt = sceneManager.clock.getDelta();

        physics.update(dt);

        const speed = vehicle.update(actions, sceneManager.camera, sceneManager.controls);

        if (actions.reset) {
            vehicle.reset();
            actions.reset = false; // Trigger once
        }

        // Update UI
        speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';

        sceneManager.render();
    }

    tick();
}

startApp().catch(err => {
    console.error('Failed to start app:', err);
});
