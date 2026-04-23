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

    update(deltaTime) {
        this.world.stepSimulation(deltaTime, 10);
    }

    raycast(from, to, records) {
        this.rayFrom.setValue(from.x, from.y, from.z);
        this.rayTo.setValue(to.x, to.y, to.z);

        const rayCallback = new Ammo.ClosestRayResultCallback(this.rayFrom, this.rayTo);
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

    addRigidBody(body) {
        this.world.addRigidBody(body);
    }

    addAction(action) {
        this.world.addAction(action);
    }

    dispose() {
        // Cleanup Ammo objects
        Ammo.destroy(this.world);
        Ammo.destroy(this.solver);
        Ammo.destroy(this.broadphase);
        Ammo.destroy(this.dispatcher);
        Ammo.destroy(this.collisionConfiguration);
        
        this.world = null;
        console.log('Physics World Disposed');
    }
}
