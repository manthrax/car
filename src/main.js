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

    // UI Selection State (Restored from Persistence if enabled)
    const isPersistenceOn = localStorage.getItem('agr_preserveState') === 'true';
    let selectedMap = (isPersistenceOn && localStorage.getItem('agr_selectedMap')) || 'drift_racetrack_free_world2.glb';
    let selectedCar = (isPersistenceOn && localStorage.getItem('agr_selectedCar')) || 'car_mazda.glb';

    // Helper to sync UI to current state
    const syncUISelection = () => {
        document.querySelectorAll('#map-options .option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === selectedMap);
        });
        document.querySelectorAll('#car-options .option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === selectedCar);
        });
    };
    syncUISelection();

    const CAR_CONFIGS = {
        'car.glb': { // Classic Muscle
            mass: 800,
            chassis: [
                { size: [1.8, 0.6, 4.0], pos: [0, 0, 0] },
                { size: [1.4, 0.4, 2.0], pos: [0, 0.8, -0.2] }
            ],
            wheels: {
                axisPositionBack: -1.3,
                axisPositionFront: 1.5,
                radiusBack: 0.4,
                radiusFront: 0.4
            }
        },



        'car_mazda.glb': { // MX5 Tuner
            mass: 1100,
            chassis: [
                { size: [1.8, 0.6, 4.0], pos: [0, 0.1, 0] },
                { size: [1.4, 0.4, 2.0], pos: [0, 0.7, -0.2] }
            ],
            wheels: {
                widthBack: 0.3,
                widthFront: 0.2,
                halfTrackBack: 0.9,
                halfTrackFront: 0.9,
                axisPositionBack: -1.32,
                axisPositionFront: 1.5,
                axisHeightBack: 0.3,
                axisHeightFront: 0.3,
                radiusBack: 0.40,
                radiusFront: 0.40,
            },
            tuning: {
                maxEngineForce: 2000,
                frictionSlip: 3.5,
                chassisFriction: 0.01,
                suspensionStiffness: 100,
                suspensionDampingRelaxation: 15.0,
                suspensionDampingCompression: 18.0,
                suspensionRestLength: .6,
                rollInfluence: 0.1,
                steeringIncrement: .02,
                steeringClamp: .5,
                maxBreakingForce: 100,
                maxSuspensionTravelCm: 30,
            }
        }
    };

    // Set up UI listeners
    document.querySelectorAll('#map-options .option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('#map-options .option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedMap = opt.dataset.value;
            if (preserveStateChk.checked) localStorage.setItem('agr_selectedMap', selectedMap);
        };
    });

    document.querySelectorAll('#car-options .option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('#car-options .option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCar = opt.dataset.value;
            if (preserveStateChk.checked) localStorage.setItem('agr_selectedCar', selectedCar);
        };
    });

    let currentSimulation = null;
    let isSimulationRunning = false;
    let isMenuOpen = true;

    const preserveStateChk = document.getElementById('preserve-state-chk');
    preserveStateChk.checked = localStorage.getItem('agr_preserveState') === 'true';
    preserveStateChk.onchange = () => {
        localStorage.setItem('agr_preserveState', preserveStateChk.checked);
        if (!preserveStateChk.checked) {
            localStorage.removeItem('agr_selectedMap');
            localStorage.removeItem('agr_selectedCar');
            localStorage.removeItem('agr_simState');
        } else {
            // Save current selection immediately if enabled
            localStorage.setItem('agr_selectedMap', selectedMap);
            localStorage.setItem('agr_selectedCar', selectedCar);
        }
    };

    const saveState = () => {
        if (!currentSimulation || !preserveStateChk.checked) return;
        const vehicle = currentSimulation.vehicle;
        const transform = vehicle.body.getWorldTransform();
        const pos = transform.getOrigin();
        const quat = transform.getRotation();
        const lv = vehicle.body.getLinearVelocity();
        const av = vehicle.body.getAngularVelocity();

        const state = {
            map: localStorage.getItem('agr_selectedMap'),
            car: localStorage.getItem('agr_selectedCar'),
            pos: { x: pos.x(), y: pos.y(), z: pos.z() },
            quat: { x: quat.x(), y: quat.y(), z: quat.z(), w: quat.w() },
            linearVel: { x: lv.x(), y: lv.y(), z: lv.z() },
            angularVel: { x: av.x(), y: av.y(), z: av.z() },
            camPos: { x: sceneManager.camera.position.x, y: sceneManager.camera.position.y, z: sceneManager.camera.position.z },
            camTarget: { x: sceneManager.controls.target.x, y: sceneManager.controls.target.y, z: sceneManager.controls.target.z },
            isMenuOpen: isMenuOpen
        };
        localStorage.setItem('agr_simState', JSON.stringify(state));
    };

    window.addEventListener('beforeunload', saveState);
    setInterval(saveState, 5000); // Autosave every 5s

    startBtn.onclick = async () => {
        isMenuOpen = false;
        uiOverlay.style.opacity = '0';
        setTimeout(() => uiOverlay.style.display = 'none', 500);
        speedometer.style.display = 'block';
        info.style.display = 'block';
    };

    // Auto-resume if was running and preservation is enabled
    if (preserveStateChk.checked) {
        const savedStateStr = localStorage.getItem('agr_simState');
        if (savedStateStr) {
            try {
                const savedState = JSON.parse(savedStateStr);
                if (savedState.isMenuOpen === false) {
                    setTimeout(() => startBtn.onclick(), 100);
                }
            } catch (e) { }
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !isMenuOpen) {
            isMenuOpen = true;
            uiOverlay.style.display = 'flex';
            setTimeout(() => uiOverlay.style.opacity = '1', 10);
            speedometer.style.display = 'none';
            info.style.display = 'none';
        }

        // F2 Toggle Debug Physics
        if (e.code === 'F2') {
            if (currentSimulation && currentSimulation.physics) {
                const physics = currentSimulation.physics;
                if (physics.debugMesh) {
                    physics.debugMesh.visible = !physics.debugMesh.visible;
                    if (physics.debugMesh.visible) physics.debugDrawer.enable();
                    else physics.debugDrawer.disable();
                }
            }
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
        physics.setupDebugDrawer(sceneManager.scene);

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
        const actions = { acceleration: false, braking: false, left: false, right: false, reset: false, flip: false };
        const keysActions = {
            KeyW: 'acceleration', KeyS: 'braking', KeyA: 'left', KeyD: 'right', KeyR: 'reset', Space: 'flip',
            ArrowUp: 'acceleration', ArrowDown: 'braking', ArrowLeft: 'left', ArrowRight: 'right'
        };

        const onKeyDown = (e) => { if (keysActions[e.code]) actions[keysActions[e.code]] = true; };
        const onKeyUp = (e) => { if (keysActions[e.code]) actions[keysActions[e.code]] = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);


        let spawnPos = new THREE.Vector3(0, 10, 0);
        let spawnQuat = new THREE.Quaternion(0, 0, 0, 1);
        let spawns = worldManager.spawns;

        let isRestoring = false;
        if (preserveStateChk.checked) {
            const savedStateStr = localStorage.getItem('agr_simState');
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    spawnPos.set(savedState.pos.x, savedState.pos.y, savedState.pos.z);
                    spawnQuat.set(savedState.quat.x, savedState.quat.y, savedState.quat.z, savedState.quat.w);
                    isRestoring = true;
                } catch (e) { }
            }
        }

        if (!isRestoring) {
            if (spawns.length) {
                let rng = (Math.random() * spawns.length) | 0;
                spawnPos.copy(spawns[rng].position);
                spawnQuat.copy(spawns[rng].quaternion);
            } else {
                // Procedural fallback
                for (let i = 0; i < 50 && spawns.length < 5; i++) {
                    const rx = (Math.random() - 0.5) * 1000;
                    const rz = (Math.random() - 0.5) * 1000;
                    const hits = [];
                    physics.raycast({ x: rx, y: 1000, z: rz }, { x: rx, y: -1000, z: rz }, hits);
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
        }

        const carConfig = CAR_CONFIGS[carFile] || {};
        const vehicle = new Vehicle(physics, sceneManager.scene, spawnPos, spawnQuat, carConfig);

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
                    mesh.geometry.rotateY(Math.PI);
            } else {
                let rtn = new THREE.Group();
                rtn.add(mesh);
                sceneManager.scene.add(rtn);
                if (isRight) {
                    //mesh.position.x -= 2;
                }
                mesh.rotation.y = Math.PI;// * .5;
                if (isRight) {
                    mesh.rotation.z = Math.PI;
                }
                mesh.quaternion.setFromEuler(mesh.rotation);
                return rtn;
            }

            sceneManager.scene.add(mesh);
            return mesh;

        };

        vehicle.init();

        // Restore Velocity and Camera if enabled
        if (isRestoring) {
            const savedStateStr = localStorage.getItem('agr_simState');
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    if (savedState.linearVel) {
                        const lv = new Ammo.btVector3(savedState.linearVel.x, savedState.linearVel.y, savedState.linearVel.z);
                        const av = new Ammo.btVector3(savedState.angularVel.x, savedState.angularVel.y, savedState.angularVel.z);
                        vehicle.body.setLinearVelocity(lv);
                        vehicle.body.setAngularVelocity(av);
                        Ammo.destroy(lv);
                        Ammo.destroy(av);
                    }
                    if (savedState.camPos) {
                        sceneManager.camera.position.set(savedState.camPos.x, savedState.camPos.y, savedState.camPos.z);
                        sceneManager.controls.target.set(savedState.camTarget.x, savedState.camTarget.y, savedState.camTarget.z);
                    }
                } catch (e) { }
            }
        }


        let isDisposed = false;
        let simObject = {
            physics,
            vehicle,
            speedUpdateTimer: 0,
            resetHoldTime: 0,
            update: (allowInput) => {
                const dt = sceneManager.clock.getDelta();
                physics.update(dt);

                const activeActions = allowInput ? actions : { acceleration: false, braking: false, left: false, right: false, reset: false, flip: false };

                // Handle Flip behavior (Space)
                if (activeActions.flip) {
                    vehicle.applyFlipForce();
                }

                // Handle R key hold logic for Respawn
                if (activeActions.reset) {
                    simObject.resetHoldTime += dt;

                    if (simObject.resetHoldTime > 1.0) {
                        if (spawns.length) {
                            let rng = (Math.random() * spawns.length) | 0;
                            vehicle.initialPos.copy(spawns[rng].position);
                            vehicle.initialQuat.copy(spawns[rng].quaternion);
                        }
                        vehicle.reset();
                        simObject.resetHoldTime = 0;
                        actions.reset = false;
                    }
                    info.innerHTML = `HOLDING R TO RESPAWN (${(1.0 - simObject.resetHoldTime).toFixed(1)}s)`;
                } else {
                    simObject.resetHoldTime = 0;
                    info.innerHTML = 'W,A,S,D: Drive | SPACE: Flip | Hold R: Respawn';
                }

                const speed = vehicle.update(activeActions, sceneManager.camera, sceneManager.controls, sceneManager.desiredDistance);

                simObject.speedUpdateTimer += dt;
                if (simObject.speedUpdateTimer > 0.25) {
                    speedometer.innerHTML = (Math.abs(speed)).toFixed(1) + " <span style='font-size:1rem'>KM/H</span>";
                    simObject.speedUpdateTimer = 0;
                }
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
