import * as THREE from 'three';
import SceneManager from './SceneManager.js';
import Physics from './Physics.js';
import WorldManager from './WorldManager.js';
import Vehicle from './Vehicle.js';

async function startApp() {
    const info = document.getElementById('info');
    const speedometer = document.getElementById('speedometer');
    const uiOverlay = document.getElementById('ui-overlay');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBar = document.getElementById('loading-bar');
    const startBtn = document.getElementById('start-btn');

    // 1. Initial Setup (Persistent Environment)
    const sceneManager = new SceneManager();
    await sceneManager.init();

    // UI Selection State
    let selectedMap = 'drift_racetrack_free_world2.glb';
    let selectedCar = 'car_mazda.glb';

    // Set up UI listeners
    document.querySelectorAll('#map-options .option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('#map-options .option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedMap = opt.dataset.value;
        };
    });

    document.querySelectorAll('#car-options .option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('#car-options .option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCar = opt.dataset.value;
        };
    });

    let currentSimulation = null;
    let isSimulationRunning = false;
    let isMenuOpen = true;

    startBtn.onclick = async () => {
        isMenuOpen = false;
        uiOverlay.style.opacity = '0';
        setTimeout(() => uiOverlay.style.display = 'none', 500);
        speedometer.style.display = 'block';
        info.style.display = 'block';
    };

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !isMenuOpen) {
            isMenuOpen = true;
            uiOverlay.style.display = 'flex';
            setTimeout(() => uiOverlay.style.opacity = '1', 10);
            speedometer.style.display = 'none';
            info.style.display = 'none';
        }
    });

    // Global Animation Loop
    function mainLoop() {
        requestAnimationFrame(mainLoop);

        if (isSimulationRunning && currentSimulation) {
            currentSimulation.update(!isMenuOpen); // Pass whether input is allowed
            sceneManager.render();
        } else {
            // Idle menu animation if no simulation yet
            const time = Date.now() * 0.0002;
            sceneManager.camera.position.x = Math.sin(time) * 40;
            sceneManager.camera.position.z = Math.cos(time) * 40;
            sceneManager.camera.position.y = 20;
            sceneManager.camera.lookAt(0, 5, 0);
            sceneManager.render();
        }
    }
    mainLoop();

    // Initial Attract Mode Start
    (async () => {
        loadingOverlay.style.display = 'flex';
        loadingBar.style.width = '0%';
        currentSimulation = await runSimulation(selectedMap, selectedCar);
        isSimulationRunning = true;

        // Enhance UI listeners to reload in background
        const reloadOnSelect = async () => {
            loadingOverlay.style.display = 'flex';
            loadingBar.style.width = '0%';
            const oldSim = currentSimulation;
            currentSimulation = null;
            if (oldSim) await oldSim.dispose();
            currentSimulation = await runSimulation(selectedMap, selectedCar);
        };

        document.querySelectorAll('#map-options .option').forEach(opt => {
            const originalClick = opt.onclick;
            opt.onclick = () => { originalClick(); reloadOnSelect(); };
        });
        document.querySelectorAll('#car-options .option').forEach(opt => {
            const originalClick = opt.onclick;
            opt.onclick = () => { originalClick(); reloadOnSelect(); };
        });
    })();

    async function runSimulation(mapFile, carFile) {
        // 2. Setup Physics
        const physics = new Physics();
        physics.init();

        const assetPath = (file) => `${import.meta.env.BASE_URL}assets/${file}`.replace(/\/+/g, '/');
        const worldManager = new WorldManager(sceneManager.scene, physics);

        // 3. Load Map
        const world = await worldManager.loadWorld(assetPath(mapFile), (progress) => {
            loadingBar.style.width = `${progress * 100}%`;
        });

        // 4. Load Car
        const carBody = await worldManager.loadCar(assetPath(carFile));

        // Hide loading
        loadingOverlay.style.display = 'none';
        speedometer.style.display = 'block';
        info.style.display = 'block';

        // 5. Setup Input
        const actions = { acceleration: false, braking: false, left: false, right: false, reset: false };
        const keysActions = {
            KeyW: 'acceleration', KeyS: 'braking', KeyA: 'left', KeyD: 'right', KeyR: 'reset',
            ArrowUp: 'acceleration', ArrowDown: 'braking', ArrowLeft: 'left', ArrowRight: 'right'
        };

        const onKeyDown = (e) => { if (keysActions[e.code]) actions[keysActions[e.code]] = true; };
        const onKeyUp = (e) => { if (keysActions[e.code]) actions[keysActions[e.code]] = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // 6. Setup Vehicle at Spawn Point
        let spawns = [];
        world.traverse(e => e.name.startsWith("Spawn") && spawns.push(e));
        spawns.forEach(s => sceneManager.scene.attach(s));

        let spawnPos = new THREE.Vector3(0, 10, 0);
        let spawnQuat = new THREE.Quaternion(0, 0, 0, 1);

        if (spawns.length) {
            let rng = (Math.random() * spawns.length) | 0;
            spawnPos.copy(spawns[rng].position);
            spawnQuat.copy(spawns[rng].quaternion);
        } else {
            // Procedural fallback
            for (let i = 0; i < 50 && spawns.length < 5; i++) {
                const rx = (Math.random() - 0.5) * 400;
                const rz = (Math.random() - 0.5) * 400;
                const hits = [];
                physics.raycast({ x: rx, y: 500, z: rz }, { x: rx, y: -500, z: rz }, hits);
                if (hits.length > 0 && hits[0].hitNormal.y > 0.8) {
                    const s = new THREE.Object3D();
                    s.position.set(hits[0].hitPoint.x, hits[0].hitPoint.y + 2, hits[0].hitPoint.z);
                    spawns.push(s);
                }
            }
            if (spawns.length) {
                spawnPos.copy(spawns[0].position);
            }
        }

        const vehicle = new Vehicle(physics, sceneManager.scene, spawnPos, spawnQuat);

        // Setup Vehicle Meshes
        carBody.parent.remove(carBody);
        let wheelObjects = [];
        carBody.traverse(e => e.name.toLowerCase().includes("wheel") && wheelObjects.push(e));
        let wheelMaster = wheelObjects[0];

        if (wheelMaster.geometry) {
            wheelMaster.geometry.rotateY(Math.PI / 2);
            wheelMaster.geometry.scale(30, 30, 30);
        } else {
            wheelMaster.position.set(0, 0, 0);
            wheelMaster.scale.multiplyScalar(0.04);
        }
        wheelObjects.forEach(w => w.parent?.remove(w));
        sceneManager.scene.add(wheelMaster);

        vehicle.createChassisMesh = () => {
            let m = carBody.clone(true);
            m.position.set(0, 0.5, 0);
            m.scale.multiplyScalar(60);
            let o = new THREE.Object3D();
            o.add(m);
            sceneManager.scene.add(o);
            return o;
        };

        vehicle.createWheelMesh = (radius, width, isFront, isRight) => {
            let mesh = wheelMaster.clone(true);

            if (wheelMaster.isMesh) {
                mesh.geometry = mesh.geometry.clone();
                if (isRight)
                    mesh.geometry.rotateY(Math.PI / 2);
            } else {
                if (isRight) {
                    mesh.children[0].rotation.x = Math.PI;
                }
            }
            sceneManager.scene.add(mesh);

            return mesh;

        };

        vehicle.init();

        let isDisposed = false;
        let simObject = {
            resetHoldTime: 0,
            update: (allowInput) => {
                const dt = sceneManager.clock.getDelta();
                physics.update(dt);

                const activeActions = allowInput ? actions : { acceleration: false, braking: false, left: false, right: false, reset: false };

                // Handle R key hold logic
                if (activeActions.reset) {
                    simObject.resetHoldTime += dt;
                    // Apply flip force while holding R
                    vehicle.applyFlipForce();

                    if (simObject.resetHoldTime > 3.0) {
                        if (spawns.length) {
                            let rng = (Math.random() * spawns.length) | 0;
                            vehicle.initialPos.copy(spawns[rng].position);
                            vehicle.initialQuat.copy(spawns[rng].quaternion);
                        }
                        vehicle.reset();
                        simObject.resetHoldTime = 0;
                        actions.reset = false;
                    }
                    info.innerHTML = `HOLD R TO FLIP / LONG HOLD TO RESET (${(3.0 - simObject.resetHoldTime).toFixed(1)}s)`;
                } else {
                    simObject.resetHoldTime = 0;
                    info.innerHTML = 'Press W,A,S,D to move. Press R to flip/reset.';
                }

                const speed = vehicle.update(activeActions, sceneManager.camera, sceneManager.controls, sceneManager.desiredDistance);
                speedometer.innerHTML = (Math.abs(speed)).toFixed(1) + " <span style='font-size:1rem'>KM/H</span>";
            },
            dispose: async () => {
                isDisposed = true;
                window.removeEventListener('keydown', onKeyDown);
                window.removeEventListener('keyup', onKeyUp);

                // Clean up managers and vehicle (Physics + Graphics)
                vehicle.dispose();
                worldManager.dispose();
                sceneManager.scene.remove(world);
                sceneManager.scene.remove(wheelMaster);

                physics.dispose();
            }
        };
        return simObject;
    }
}

Ammo().then(startApp);
