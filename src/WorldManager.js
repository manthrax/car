import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class WorldManager {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.loader = new GLTFLoader();
    }

    async loadWorld(path, onProgress) {
        const gltf = await this.loader.loadAsync(path);
        const world = gltf.scene;

        world.scale.set(40, 40, 40);
        world.position.y = -25;
        this.scene.add(world);
        world.updateMatrixWorld(true);

        const terrain = world.getObjectByName("static_terrain");
        if (terrain) {
            await this.createTerrainCollision(terrain, onProgress);
        }

        const carBody = world.getObjectByName("Body");
        if (carBody) {
            carBody.updateMatrixWorld(true);
            this.scene.attach(carBody);
        }

        return { world, carBody };
    }

    async createTerrainCollision(terrain, onProgress, trianglesPerStep = 1500) {
        terrain.updateMatrixWorld(true);
        const geometries = [];
        terrain.traverse(child => {
            if (child.isMesh) {
                const geom = child.geometry.clone();
                geom.applyMatrix4(child.matrixWorld);
                geometries.push(geom);
            }
        });

        if (geometries.length === 0) return;

        const ammoMesh = new Ammo.btTriangleMesh();
        const areaThreshold = 0.5;
        const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
        const v1v2 = new THREE.Vector3(), v1v3 = new THREE.Vector3(), vCross = new THREE.Vector3();

        // 1. Calculate total triangles across all geometries
        let totalTriangles = 0;
        geometries.forEach(geom => {
            const pos = geom.attributes.position.array;
            const index = geom.index ? geom.index.array : null;
            totalTriangles += index ? index.length / 3 : pos.length / 9;
        });

        let processedTriangles = 0;

        for (const geom of geometries) {
            const pos = geom.attributes.position.array;
            const index = geom.index ? geom.index.array : null;

            const processTriangle = (x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
                va.set(x1, y1, z1);
                vb.set(x2, y2, z2);
                vc.set(x3, y3, z3);
                v1v2.subVectors(vb, va);
                v1v3.subVectors(vc, va);
                vCross.crossVectors(v1v2, v1v3);
                const area = vCross.length() * 0.5;

                if (area > areaThreshold) {
                    const amV1 = new Ammo.btVector3(x1, y1, z1);
                    const amV2 = new Ammo.btVector3(x2, y2, z2);
                    const amV3 = new Ammo.btVector3(x3, y3, z3);
                    ammoMesh.addTriangle(amV1, amV2, amV3, true);
                    Ammo.destroy(amV1);
                    Ammo.destroy(amV2);
                    Ammo.destroy(amV3);
                }
            };

            const numElements = index ? index.length : pos.length;
            const step = index ? 3 : 9;

            for (let i = 0; i < numElements; i += step) {
                if (index) {
                    const i1 = index[i] * 3, i2 = index[i + 1] * 3, i3 = index[i + 2] * 3;
                    processTriangle(pos[i1], pos[i1 + 1], pos[i1 + 2], pos[i2], pos[i2 + 1], pos[i2 + 2], pos[i3], pos[i3 + 1], pos[i3 + 2]);
                } else {
                    processTriangle(pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]);
                }

                processedTriangles++;

                // Yield to main thread every N triangles
                if (processedTriangles % trianglesPerStep === 0) {
                    if (onProgress) onProgress(processedTriangles / totalTriangles);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            geom.dispose();
        }

        if (onProgress) onProgress(1.0);

        const shape = new Ammo.btBvhTriangleMeshShape(ammoMesh, true);
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const motionState = new Ammo.btDefaultMotionState(transform);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0));
        const body = new Ammo.btRigidBody(rbInfo);
        this.physics.addRigidBody(body);
        console.log('Static terrain collision created (Time-sliced)');
    }
}
