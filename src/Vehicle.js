import * as THREE from 'three';
import { updateCameraFollow } from './CameraFollow.js';

let bv0, bv1, bv2, bv3;

export default class Vehicle {
    constructor(physics, scene, pos, quat) {
        this.physics = physics;
        this.scene = scene;
        this.initialPos = pos.clone();
        this.initialPos.y += 1;
        this.initialQuat = quat.clone();

        // Vehicle constants (from Demo)
        this.chassisWidth = 1.5;
        this.chassisHeight = .6;
        this.chassisLength = 4.5;
        this.massVehicle = 800;

        this.wheelAxisPositionBack = -1.32;
        this.wheelRadiusBack = .35;
        this.wheelWidthBack = .3;
        this.wheelHalfTrackBack = .75;
        this.wheelAxisHeightBack = .3;

        this.wheelAxisFrontPosition = 1.5;
        this.wheelHalfTrackFront = .75;
        this.wheelAxisHeightFront = .3;
        this.wheelRadiusFront = .3;
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

        this.cameraLocalOffset = new THREE.Vector3(0, 1., 0);
    }

    init() {
        bv0 = new Ammo.btVector3(0, 0, 0);
        bv1 = new Ammo.btVector3(0, 0, 0);
        bv2 = new Ammo.btVector3(0, 0, 0);
        bv3 = new Ammo.btVector3(0, 0, 0);
        // Physics Body - Compound Shape (2 Boxes)
        const shape = new Ammo.btCompoundShape();

        // 1. Lower Chassis Box
        const chassisBox = new Ammo.btBoxShape(new Ammo.btVector3(this.chassisWidth * 0.5, this.chassisHeight * 0.5, this.chassisLength * 0.5));
        const chassisTrans = new Ammo.btTransform();
        chassisTrans.setIdentity();
        chassisTrans.setOrigin(new Ammo.btVector3(0, 0, 0));
        shape.addChildShape(chassisTrans, chassisBox);
        //let shape = chassisBox;
        // 2. Upper Cabin Box
        const cabinBox = new Ammo.btBoxShape(new Ammo.btVector3(this.chassisWidth * 0.4, this.chassisHeight * 0.25, this.chassisLength * 0.25));
        const cabinTrans = new Ammo.btTransform();
        cabinTrans.setIdentity();
        cabinTrans.setOrigin(new Ammo.btVector3(0, this.chassisHeight * 1.5, -this.chassisLength * 0.05));
        shape.addChildShape(cabinTrans, cabinBox);

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(this.initialPos.x, this.initialPos.y, this.initialPos.z));
        transform.setRotation(new Ammo.btQuaternion(this.initialQuat.x, this.initialQuat.y, this.initialQuat.z, this.initialQuat.w));

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

    update(actions, camera, controls, desiredDistance) {
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

    reset() {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(this.initialPos.x, this.initialPos.y, this.initialPos.z));
        transform.setRotation(new Ammo.btQuaternion(this.initialQuat.x, this.initialQuat.y, this.initialQuat.z, this.initialQuat.w));

        this.body.setWorldTransform(transform);
        this.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        this.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

        this.vehicleSteering = 0;
        this.engineForce = 0;
        this.breakingForce = 0;
    }
}
