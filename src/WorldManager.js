import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export default class WorldManager {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.loader = new GLTFLoader();
    }

    async loadWorld(path, onProgress) {
        return this.loadTerrain(path, onProgress);
    }

    async loadCar(path) {
        const gltf = await this.loader.loadAsync(path);
        const world = gltf.scene;
        const carBody = world.getObjectByName("Body");
        if (carBody) {
            carBody.updateMatrixWorld(true);
            this.scene.attach(carBody);
        }
        return carBody;
    }

    async loadTerrain(path, onProgress) {
        const gltf = await this.loader.loadAsync(path);
        const world = gltf.scene;

        world.scale.set(60, 60, 60);
        world.position.y = -25;
        this.scene.add(world);
        world.updateMatrixWorld(true);

        const terrain = world;
        if (terrain) {
            await this.createTerrainCollision(terrain, onProgress);
        }
        return world;
    }

    async createTerrainCollision(terrain, onProgress, trianglesPerStep = 2000) {
        terrain.updateMatrixWorld(true);
        const geometries = [];
        terrain.traverse(child => {
            if (child.isMesh) {
                const geom = child.geometry.clone();
                geom.applyMatrix4(child.matrixWorld);
                // Clean up unnecessary attributes to save memory
                Object.keys(geom.attributes).forEach(attr => {
                    if (attr !== 'position') geom.deleteAttribute(attr);
                });
                geometries.push(geom);
            }
        });

        if (geometries.length === 0) return;

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, true);
        const pos = mergedGeometry.attributes.position.array;
        const index = mergedGeometry.index ? mergedGeometry.index.array : null;

        // Partition triangles into a grid for better performance and organization
        const gridCellSize = 5000;
        const grid = new Map();
        const areaThreshold = 0.5;

        const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
        const v1v2 = new THREE.Vector3(), v1v3 = new THREE.Vector3(), vCross = new THREE.Vector3();
        const amV1 = new Ammo.btVector3(), amV2 = new Ammo.btVector3(), amV3 = new Ammo.btVector3();

        const totalTriangles = index ? index.length / 3 : pos.length / 9;
        let processedTriangles = 0;

        const getGridKey = (v) => {
            const gx = Math.floor(v.x / gridCellSize);
            const gz = Math.floor(v.z / gridCellSize);
            return `${gx},${gz}`;
        };

        const addTriangleToGrid = (x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
            va.set(x1, y1, z1);
            vb.set(x2, y2, z2);
            vc.set(x3, y3, z3);

            v1v2.subVectors(vb, va);
            v1v3.subVectors(vc, va);
            vCross.crossVectors(v1v2, v1v3);
            const area = vCross.length() * 0.5;

            if (area > areaThreshold) {
                // Use the centroid to determine the grid cell
                const centroidX = (x1 + x2 + x3) / 3;
                const centroidZ = (z1 + z2 + z3) / 3;
                const key = `${Math.floor(centroidX / gridCellSize)},${Math.floor(centroidZ / gridCellSize)}`;

                if (!grid.has(key)) {
                    grid.set(key, new Ammo.btTriangleMesh());
                }
                const mesh = grid.get(key);
                amV1.setValue(x1, y1, z1);
                amV2.setValue(x2, y2, z2);
                amV3.setValue(x3, y3, z3);
                mesh.addTriangle(amV1, amV2, amV3, false);
            }
        };

        const numElements = index ? index.length : pos.length;
        const step = index ? 3 : 9;

        for (let i = 0; i < numElements; i += step) {
            if (index) {
                const i1 = index[i] * 3, i2 = index[i + 1] * 3, i3 = index[i + 2] * 3;
                addTriangleToGrid(pos[i1], pos[i1 + 1], pos[i1 + 2], pos[i2], pos[i2 + 1], pos[i2 + 2], pos[i3], pos[i3 + 1], pos[i3 + 2]);
            } else {
                addTriangleToGrid(pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]);
            }

            processedTriangles++;
            if (processedTriangles % trianglesPerStep === 0) {
                if (onProgress) onProgress(processedTriangles / totalTriangles);
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }

        // Create a separate rigid body for each grid cell
        grid.forEach((ammoMesh, key) => {
            const shape = new Ammo.btBvhTriangleMeshShape(ammoMesh, true);
            const transform = new Ammo.btTransform();
            transform.setIdentity();
            const motionState = new Ammo.btDefaultMotionState(transform);
            const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0));
            const body = new Ammo.btRigidBody(rbInfo);
            this.physics.addRigidBody(body);
        });

        Ammo.destroy(amV1);
        Ammo.destroy(amV2);
        Ammo.destroy(amV3);

        mergedGeometry.dispose();
        geometries.forEach(g => g.dispose());

        if (onProgress) onProgress(1.0);
        console.log(`Static terrain collision created: ${grid.size} grid cells.`);
    }
}
