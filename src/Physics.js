export default class Physics {
    constructor() {
        this.collisionConfiguration = null;
        this.dispatcher = null;
        this.broadphase = null;
        this.solver = null;
        this.world = null;
        this.transformAux = new Ammo.btTransform();
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

    addRigidBody(body) {
        this.world.addRigidBody(body);
    }

    addAction(action) {
        this.world.addAction(action);
    }
}
