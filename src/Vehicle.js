import * as THREE from 'three';
import { updateCameraFollow } from './CameraFollow.js';

let bv0, bv1, bv2, bv3;

export default class Vehicle {
    constructor(physics, scene, pos, quat, options = {}) {
        this.physics = physics;
        this.scene = scene;
        this.initialPos = pos.clone();
        this.initialPos.y += 1;
        this.initialQuat = quat.clone();

        // Default Config
        const defaults = {
            mass: 800,
            chassis: [
                { size: [1.5, 0.6, 4.5], pos: [0, 0, 0] }, // Lower Chassis
                { size: [1.2, 0.3, 2.2], pos: [0, 1.0, -0.2] } // Cabin
            ],
            wheels: {
                radiusBack: 0.35, widthBack: 0.3, halfTrackBack: 0.75, axisPositionBack: -1.32, axisHeightBack: 0.3,
                radiusFront: 0.3, widthFront: 0.2, halfTrackFront: 0.75, axisPositionFront: 1.5, axisHeightFront: 0.3
            },
            tuning: {
                frictionSlip: 1000.0,
                chassisFriction: 0.1,
                suspensionStiffness: 20.0,
                suspensionDampingRelaxation: 2.3,
                suspensionDampingCompression: 4.4,
                suspensionRestLength: 0.6,
                rollInfluence: 0.2,
                steeringIncrement: .01,
                steeringClamp: .5,
                maxEngineForce: 2000,
                maxBreakingForce: 100
            }
        };

        // Deep merge or manual apply
        this.config = { ...defaults, ...options };
        this.config.wheels = { ...defaults.wheels, ...(options.wheels || {}) };
        this.config.tuning = { ...defaults.tuning, ...(options.tuning || {}) };

        // Flatten essential config to instance properties
        this.massVehicle = this.config.mass;
        Object.assign(this, this.config.wheels);
        Object.assign(this, this.config.tuning);

        this.wheelMeshes = [];
        this.chassisMesh = null;
        this.vehicle = null;
        this.body = null;
        this.cameraLocalOffset = new THREE.Vector3(0, 1., 0);
    }

    init() {
        if (!bv0) {
            bv0 = new Ammo.btVector3(0, 0, 0);
            bv1 = new Ammo.btVector3(0, 0, 0);
            bv2 = new Ammo.btVector3(0, 0, 0);
            bv3 = new Ammo.btVector3(0, 0, 0);
        }
        // Physics Body - Compound Shape (Driven by config)
        this.chassisShape = new Ammo.btCompoundShape();
        this.subShapes = [];

        this.config.chassis.forEach(box => {
            const shape = new Ammo.btBoxShape(new Ammo.btVector3(box.size[0] * 0.5, box.size[1] * 0.5, box.size[2] * 0.5));
            this.subShapes.push(shape);

            const trans = new Ammo.btTransform();
            trans.setIdentity();
            trans.setOrigin(new Ammo.btVector3(box.pos[0], box.pos[1], box.pos[2]));

            this.chassisShape.addChildShape(trans, shape);
            Ammo.destroy(trans);
        });

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(this.initialPos.x, this.initialPos.y, this.initialPos.z));
        transform.setRotation(new Ammo.btQuaternion(this.initialQuat.x, this.initialQuat.y, this.initialQuat.z, this.initialQuat.w));

        const motionState = new Ammo.btDefaultMotionState(transform);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        this.chassisShape.calculateLocalInertia(this.massVehicle, localInertia);

        const rbInfo = new Ammo.btRigidBodyConstructionInfo(this.massVehicle, motionState, this.chassisShape, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        this.body.setFriction(this.config.tuning.chassisFriction || 0.1);
        this.body.setActivationState(4); // DISABLE_DEACTIVATION
        this.physics.addRigidBody(this.body, 2, -1); // Group 2, Collides with everything

        this.chassisMesh = this.createChassisMesh(this.chassisWidth, this.chassisHeight, this.chassisLength);

        // Raycast Vehicle
        this.tuning = new Ammo.btVehicleTuning();

        // Capture baseline Ammo.js tuning defaults for reference
        this.ammoTuningDefaults = {
            frictionSlip: this.tuning.get_m_frictionSlip(),
            suspensionStiffness: this.tuning.get_m_suspensionStiffness(),
            suspensionDamping: this.tuning.get_m_suspensionDamping(),
            suspensionCompression: this.tuning.get_m_suspensionCompression(),
            maxSuspensionTravelCm: this.tuning.get_m_maxSuspensionTravelCm(),
            maxSuspensionForce: this.tuning.get_m_maxSuspensionForce()
        };
        console.log("Ammo.js btVehicleTuning Defaults:", this.ammoTuningDefaults);

        // Apply config to the global tuning object
        if (this.config.tuning.frictionSlip !== undefined) this.tuning.set_m_frictionSlip(this.config.tuning.frictionSlip);
        if (this.config.tuning.suspensionStiffness !== undefined) this.tuning.set_m_suspensionStiffness(this.config.tuning.suspensionStiffness);
        if (this.config.tuning.suspensionDampingRelaxation !== undefined) this.tuning.set_m_suspensionDamping(this.config.tuning.suspensionDampingRelaxation);
        if (this.config.tuning.suspensionDampingCompression !== undefined) this.tuning.set_m_suspensionCompression(this.config.tuning.suspensionDampingCompression);
        if (this.config.tuning.maxSuspensionTravelCm !== undefined) this.tuning.set_m_maxSuspensionTravelCm(this.config.tuning.maxSuspensionTravelCm);
        if (this.config.tuning.maxSuspensionForce !== undefined) this.tuning.set_m_maxSuspensionForce(this.config.tuning.maxSuspensionForce);
        const rayCaster = new Ammo.btDefaultVehicleRaycaster(this.physics.world);
        this.vehicle = new Ammo.btRaycastVehicle(this.tuning, this.body, rayCaster);
        this.vehicle.setCoordinateSystem(0, 1, 2);
        this.physics.addAction(this.vehicle);

        const wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
        const wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

        const addWheel = (isFront, pos, radius, width, index) => {
            const wheelInfo = this.vehicle.addWheel(pos, wheelDirectionCS0, wheelAxleCS, this.config.tuning.suspensionRestLength, radius, this.tuning, isFront);

            // Lazy-capture Ammo.js defaults from the very first wheel
            if (!this.ammoWheelDefaults) {
                this.ammoWheelDefaults = {
                    suspensionStiffness: wheelInfo.get_m_suspensionStiffness(),
                    suspensionDampingRelaxation: wheelInfo.get_m_wheelsDampingRelaxation(),
                    suspensionDampingCompression: wheelInfo.get_m_wheelsDampingCompression(),
                    frictionSlip: wheelInfo.get_m_frictionSlip(),
                    rollInfluence: wheelInfo.get_m_rollInfluence()
                };
                console.log("Captured Ammo.js Wheel Defaults:", this.ammoWheelDefaults);
            }

            // Map config keys to Ammo setter methods
            const tuningMap = {
                suspensionStiffness: 'set_m_suspensionStiffness',
                suspensionDampingRelaxation: 'set_m_wheelsDampingRelaxation',
                suspensionDampingCompression: 'set_m_wheelsDampingCompression',
                frictionSlip: 'set_m_frictionSlip',
                rollInfluence: 'set_m_rollInfluence',
                maxSuspensionTravelCm: 'set_m_maxSuspensionTravelCm',
                maxSuspensionForce: 'set_m_maxSuspensionForce'
            };

            // Apply overrides only if they differ from the engine defaults
            Object.keys(tuningMap).forEach(key => {
                const userVal = this.config.tuning[key];
                const ammoDefault = this.ammoWheelDefaults[key];
                const setter = tuningMap[key];

                if (userVal !== undefined && userVal !== ammoDefault) {
                    wheelInfo[setter](userVal);
                }
            });

            const isRight = pos.x() > 0;
            this.wheelMeshes[index] = this.createWheelMesh(radius, width, isFront, isRight);
        };

        addWheel(true, new Ammo.btVector3(this.halfTrackFront, this.axisHeightFront, this.axisPositionFront), this.radiusFront, this.widthFront, 0);
        addWheel(true, new Ammo.btVector3(-this.halfTrackFront, this.axisHeightFront, this.axisPositionFront), this.radiusFront, this.widthFront, 1);
        addWheel(false, new Ammo.btVector3(this.halfTrackBack, this.axisHeightBack, this.axisPositionBack), this.radiusBack, this.widthBack, 2);
        addWheel(false, new Ammo.btVector3(-this.halfTrackBack, this.axisHeightBack, this.axisPositionBack), this.radiusBack, this.widthBack, 3);
    }

    createWheelMesh(radius, width, isFront, isRight) {
        const materialInteractive = new THREE.MeshPhongMaterial({ color: 0x990000 });
        const geometry = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
        geometry.rotateZ(isFront ? -(Math.PI / 2) : (Math.PI / 2));
        const mesh = new THREE.Mesh(geometry, materialInteractive);
        mesh.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, radius * 1.75, radius * .25), materialInteractive));
        mesh.castShadow = true;
        this.scene.add(mesh);
        return mesh;
    }

    createChassisMesh(w, l, h) {
        const materialInteractive = new THREE.MeshPhongMaterial({ color: 0x990000 });
        const geometry = new THREE.BoxGeometry(w, l, h);
        const mesh = new THREE.Mesh(geometry, materialInteractive);
        mesh.castShadow = true;
        this.scene.add(mesh);
        return mesh;
    }

    update(actions, camera, controls, desiredDistance) {
        const speed = this.vehicle.getCurrentSpeedKmHour();

        this.breakingForce = 0;
        this.engineForce = 0;

        if (actions.acceleration) {
            if (speed < -1) {
                this.breakingForce = this.maxBreakingForce || 100;
            } else {
                this.engineForce = this.maxEngineForce;
            }
        } else if (actions.braking) {
            if (speed > 1) {
                this.breakingForce = this.maxBreakingForce || 100;
            } else {
                this.engineForce = -this.maxEngineForce / 2;
            }
        } else {
            // Apply slight rolling resistance/brake when no keys are pressed
            this.breakingForce = (this.maxBreakingForce || 100) * 0.05;
        }
        if (actions.left) {
            if (this.vehicleSteering < this.steeringClamp) this.vehicleSteering += this.steeringIncrement;
        } else if (actions.right) {
            if (this.vehicleSteering > -this.steeringClamp) this.vehicleSteering -= this.steeringIncrement;
        } else {
            if (this.vehicleSteering < -this.steeringIncrement) this.vehicleSteering += this.steeringIncrement;
            else if (this.vehicleSteering > this.steeringIncrement) this.vehicleSteering -= this.steeringIncrement;
            else this.vehicleSteering = 0;
        }

        this.vehicle.applyEngineForce(this.engineForce, 2);
        this.vehicle.applyEngineForce(this.engineForce, 3);
        this.vehicle.setBrake(this.breakingForce / 2, 0);
        this.vehicle.setBrake(this.breakingForce / 2, 1);
        this.vehicle.setBrake(this.breakingForce, 2);
        this.vehicle.setBrake(this.breakingForce, 3);
        this.vehicle.setSteeringValue(this.vehicleSteering, 0);
        this.vehicle.setSteeringValue(this.vehicleSteering, 1);

        // Sync Wheels
        for (let i = 0; i < this.vehicle.getNumWheels(); i++) {
            this.vehicle.updateWheelTransformsWS(i, true);
            const tm = this.vehicle.getWheelTransformWS(i);
            const p = tm.getOrigin();
            const q = tm.getRotation();
            this.wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            this.wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        }

        // Sync Chassis
        const tm = this.vehicle.getChassisWorldTransform();
        const p = tm.getOrigin();
        const q = tm.getRotation();

        this.chassisMesh.position.set(p.x(), p.y(), p.z());
        this.chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
        this.chassisMesh.updateMatrixWorld();

        // Use extracted utility for camera follow and collision
        if (camera && controls) {
            updateCameraFollow(camera, controls, this.chassisMesh, this.physics, desiredDistance, this.cameraLocalOffset);
        }

        return speed;
    }

    applyFlipForce() {
        if (!this.body) return;

        // Get current transform and rotation basis
        const transform = this.body.getWorldTransform();
        const basis = transform.getBasis();

        // Extract the local Y-axis (Row 1) which represents the 'up' direction of the car
        const up = basis.getRow(1);

        // Calculate the world-space offset of the roof: local Up axis * 1.5 units
        bv1.setValue(up.x(), up.y() * 1.5, up.z());

        // Apply a global upward force at that roof position
        bv0.setValue(0, this.massVehicle * 15, 0);
        this.body.applyForce(bv0, bv1);
    }

    reset() {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(this.initialPos.x, this.initialPos.y, this.initialPos.z));
        transform.setRotation(new Ammo.btQuaternion(this.initialQuat.x, this.initialQuat.y, this.initialQuat.z, this.initialQuat.w));

        this.body.setWorldTransform(transform);
        this.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        this.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
        Ammo.destroy(transform);

        this.vehicleSteering = 0;
        this.engineForce = 0;
        this.breakingForce = 0;
    }

    getPhysicsState() {
        if (!this.body) return null;
        const transform = this.body.getWorldTransform();
        const origin = transform.getOrigin();
        const rotation = transform.getRotation();
        const lv = this.body.getLinearVelocity();
        const av = this.body.getAngularVelocity();

        return {
            pos: { x: origin.x(), y: origin.y(), z: origin.z() },
            quat: { x: rotation.x(), y: rotation.y(), z: rotation.z(), w: rotation.w() },
            lv: { x: lv.x(), y: lv.y(), z: lv.z() },
            av: { x: av.x(), y: av.y(), z: av.z() }
        };
    }

    setPhysicsState(state) {
        if (!this.body || !state) return;
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(state.pos.x, state.pos.y, state.pos.z));
        transform.setRotation(new Ammo.btQuaternion(state.quat.x, state.quat.y, state.quat.z, state.quat.w));

        this.body.setWorldTransform(transform);
        this.body.setLinearVelocity(new Ammo.btVector3(state.lv.x, state.lv.y, state.lv.z));
        this.body.setAngularVelocity(new Ammo.btVector3(state.av.x, state.av.y, state.av.z));
        this.body.activate();
        Ammo.destroy(transform);
    }

    dispose() {
        if (this.physics && this.physics.world) {
            this.physics.world.removeAction(this.vehicle);
            this.physics.world.removeRigidBody(this.body);
        }

        // Destroy Physics Objects
        Ammo.destroy(this.vehicle);
        Ammo.destroy(this.body);
        Ammo.destroy(this.chassisShape);
        //Ammo.destroy(this.tuning);

        if (this.subShapes) {
            this.subShapes.forEach(s => Ammo.destroy(s));
        }

        // Remove meshes from scene
        if (this.chassisMesh) this.scene.remove(this.chassisMesh);
        if (this.wheelMeshes) {
            this.wheelMeshes.forEach(m => this.scene.remove(m));
        }

        console.log('Vehicle Disposed');
    }
}
