import * as THREE from 'three';
import { AmmoDebugDrawer } from './AmmoDebugDrawer.js';

export default class Physics {
    constructor() {
        this.collisionConfiguration = null;
        this.dispatcher = null;
        this.broadphase = null;
        this.solver = null;
        this.world = null;
        this.transformAux = new Ammo.btTransform();
        this.rayFrom = new Ammo.btVector3();
        this.rayTo = new Ammo.btVector3();

        this.debugDrawer = null;
        this.debugMesh = null;
    }

    init() {
        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.broadphase = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.world = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
        this.world.setGravity(new Ammo.btVector3(0, -9.82, 0));
        console.log('Physics World Initialized');
    }

    setupDebugDrawer(scene) {
        const bufferSize = 8000000; // 1 million floats
        this.debugVertices = new Float32Array(bufferSize);
        this.debugColors = new Float32Array(bufferSize);

        this.debugDrawer = new AmmoDebugDrawer(null, this.debugVertices, this.debugColors, this.world, { Ammo: Ammo });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.debugVertices, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.debugColors, 3).setUsage(THREE.DynamicDrawUsage));

        const material = new THREE.LineBasicMaterial({ vertexColors: true });
        this.debugMesh = new THREE.LineSegments(geometry, material);
        this.debugMesh.frustumCulled = false;
        this.debugMesh.visible = false;
        this.debugMesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10000);
        scene.add(this.debugMesh);
    }

    update(deltaTime) {
        this.world && this.world.stepSimulation(deltaTime, 10);

        if (this.debugMesh && this.debugMesh.visible) {
            this.debugDrawer.update();
            this.debugMesh.geometry.attributes.position.needsUpdate = true;
            this.debugMesh.geometry.attributes.color.needsUpdate = true;
            this.debugMesh.geometry.setDrawRange(0, this.debugDrawer.index);
        }
    }

    raycast(from, to, records, mask = -1) {
        if (!this.world) return;
        this.rayFrom.setValue(from.x, from.y, from.z);
        this.rayTo.setValue(to.x, to.y, to.z);

        const rayCallback = new Ammo.ClosestRayResultCallback(this.rayFrom, this.rayTo);
        rayCallback.set_m_collisionFilterMask(mask);

        this.world.rayTest(this.rayFrom, this.rayTo, rayCallback);

        if (rayCallback.hasHit()) {
            const hitPoint = rayCallback.get_m_hitPointWorld();
            const hitNormal = rayCallback.get_m_hitNormalWorld();

            records.push({
                hitPoint: { x: hitPoint.x(), y: hitPoint.y(), z: hitPoint.z() },
                hitNormal: { x: hitNormal.x(), y: hitNormal.y(), z: hitNormal.z() },
                body: Ammo.castObject(rayCallback.get_m_collisionObject(), Ammo.btRigidBody)
            });
        }

        Ammo.destroy(rayCallback);
    }

    addRigidBody(body, group = 1, mask = -1) {
        this.world.addRigidBody(body, group, mask);
    }

    addAction(action) {
        this.world.addAction(action);
    }

    dispose() {
        // Cleanup Ammo objects with safety checks
        if (this.world) {
            Ammo.destroy(this.world);
            this.world = null;
        }
        if (this.solver) {
            Ammo.destroy(this.solver);
            this.solver = null;
        }
        if (this.broadphase) {
            Ammo.destroy(this.broadphase);
            this.broadphase = null;
        }
        if (this.dispatcher) {
            Ammo.destroy(this.dispatcher);
            this.dispatcher = null;
        }
        if (this.collisionConfiguration) {
            Ammo.destroy(this.collisionConfiguration);
            this.collisionConfiguration = null;
        }

        console.log('Physics World Disposed');
    }
}
