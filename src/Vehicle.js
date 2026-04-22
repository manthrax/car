import * as THREE from 'three';

export default class Vehicle {
    constructor(physics, scene, pos, quat) {
        this.physics = physics;
        this.scene = scene;
        this.pos = pos;
        this.quat = quat;

        // Vehicle constants (from Demo)
        this.chassisWidth = 1.8;
        this.chassisHeight = .6;
        this.chassisLength = 4;
        this.massVehicle = 800;

        this.wheelAxisPositionBack = -1;
        this.wheelRadiusBack = .4;
        this.wheelWidthBack = .3;
        this.wheelHalfTrackBack = 1;
        this.wheelAxisHeightBack = .3;

        this.wheelAxisFrontPosition = 1.7;
        this.wheelHalfTrackFront = 1;
        this.wheelAxisHeightFront = .3;
        this.wheelRadiusFront = .35;
        this.wheelWidthFront = .2;

        this.friction = 1000;
        this.suspensionStiffness = 20.0;
        this.suspensionDamping = 2.3;
        this.suspensionCompression = 4.4;
        this.suspensionRestLength = 0.6;
        this.rollInfluence = 0.2;

        this.steeringIncrement = .04;
        this.steeringClamp = .5;
        this.maxEngineForce = 2000;
        this.maxBreakingForce = 100;

        this.engineForce = 0;
        this.vehicleSteering = 0;
        this.breakingForce = 0;

        this.wheelMeshes = [];
        this.chassisMesh = null;
        this.vehicle = null;
        this.body = null;

        this.init();
    }

    init() {
        // Physics Body
        const shape = new Ammo.btBoxShape(new Ammo.btVector3(this.chassisWidth * .5, this.chassisHeight * .5, this.chassisLength * .5));
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(this.pos.x, this.pos.y, this.pos.z));
        transform.setRotation(new Ammo.btQuaternion(this.quat.x, this.quat.y, this.quat.z, this.quat.w));
        
        const motionState = new Ammo.btDefaultMotionState(transform);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(this.massVehicle, localInertia);
        
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(this.massVehicle, motionState, shape, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        this.body.setActivationState(4); // DISABLE_DEACTIVATION
        this.physics.addRigidBody(this.body);
        
        this.chassisMesh = this.createChassisMesh(this.chassisWidth, this.chassisHeight, this.chassisLength);

        // Raycast Vehicle
        const tuning = new Ammo.btVehicleTuning();
        const rayCaster = new Ammo.btDefaultVehicleRaycaster(this.physics.world);
        this.vehicle = new Ammo.btRaycastVehicle(tuning, this.body, rayCaster);
        this.vehicle.setCoordinateSystem(0, 1, 2);
        this.physics.addAction(this.vehicle);

        const wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
        const wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

        const addWheel = (isFront, pos, radius, width, index) => {
            const wheelInfo = this.vehicle.addWheel(pos, wheelDirectionCS0, wheelAxleCS, this.suspensionRestLength, radius, tuning, isFront);
            wheelInfo.set_m_suspensionStiffness(this.suspensionStiffness);
            wheelInfo.set_m_wheelsDampingRelaxation(this.suspensionDamping);
            wheelInfo.set_m_wheelsDampingCompression(this.suspensionCompression);
            wheelInfo.set_m_frictionSlip(this.friction);
            wheelInfo.set_m_rollInfluence(this.rollInfluence);
            this.wheelMeshes[index] = this.createWheelMesh(radius, width);
        };

        addWheel(true, new Ammo.btVector3(this.wheelHalfTrackFront, this.wheelAxisHeightFront, this.wheelAxisFrontPosition), this.wheelRadiusFront, this.wheelWidthFront, 0);
        addWheel(true, new Ammo.btVector3(-this.wheelHalfTrackFront, this.wheelAxisHeightFront, this.wheelAxisFrontPosition), this.wheelRadiusFront, this.wheelWidthFront, 1);
        addWheel(false, new Ammo.btVector3(this.wheelHalfTrackBack, this.wheelAxisHeightBack, this.wheelAxisPositionBack), this.wheelRadiusBack, this.wheelWidthBack, 2);
        addWheel(false, new Ammo.btVector3(-this.wheelHalfTrackBack, this.wheelAxisHeightBack, this.wheelAxisPositionBack), this.wheelRadiusBack, this.wheelWidthBack, 3);
    }

    createWheelMesh(radius, width) {
        const materialInteractive = new THREE.MeshPhongMaterial({ color: 0x990000 });
        const geometry = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
        geometry.rotateZ(Math.PI / 2);
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

    update(actions, camera, controls) {
        const speed = this.vehicle.getCurrentSpeedKmHour();
        
        this.breakingForce = 0;
        this.engineForce = 0;

        if (actions.acceleration) {
            if (speed < -1) this.breakingForce = this.maxBreakingForce;
            else this.engineForce = this.maxEngineForce;
        }
        if (actions.braking) {
            if (speed > 1) this.breakingForce = this.maxBreakingForce;
            else this.engineForce = -this.maxEngineForce / 2;
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
            this.vehicle.updateWheelTransform(i, true);
            const tm = this.vehicle.getWheelTransformWS(i);
            const p = tm.getOrigin();
            const q = tm.getRotation();
            this.wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            this.wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        }

        // Sync Chassis & Camera Follow
        const tm = this.vehicle.getChassisWorldTransform();
        const p = tm.getOrigin();
        const q = tm.getRotation();

        if (camera && controls) {
            camera.position.sub(controls.target);
            controls.target.sub(this.chassisMesh.position);
        }

        this.chassisMesh.position.set(p.x(), p.y(), p.z());
        this.chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

        if (camera && controls) {
            controls.target.add(this.chassisMesh.position);
            camera.position.add(controls.target);
        }

        return speed;
    }
}
