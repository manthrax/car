/* global Ammo */
//export const DefaultBufferSize = 50000;

export const AmmoDebugConstants = {
    NoDebug: 0,
    DrawWireframe: 1,
    DrawAabb: 2,
    DrawFeaturesText: 4,
    DrawContactPoints: 8,
    NoDeactivation: 16,
    NoHelpText: 32,
    DrawText: 64,
    ProfileTimings: 128,
    EnableSatComparison: 256,
    DisableBulletLCP: 512,
    EnableCCD: 1024,
    DrawConstraints: 1 << 11, //2048
    DrawConstraintLimits: 1 << 12, //4096
    FastWireframe: 1 << 13, //8192
    DrawNormals: 1 << 14, //16384
    MAX_DEBUG_DRAW_MODE: 0xffffffff
};

export class AmmoDebugDrawer {
    /**
     * @param {Uint32Array} indexArray
     * @param {Float32Array} verticesArray
     * @param {Float32Array} colorsArray
     * @param {Ammo.btCollisionWorld} world
     * @param {object} [options]
     */
    constructor(indexArray, verticesArray, colorsArray, world, options = {}) {
        this.world = world;
        this.verticesArray = verticesArray;
        this.colorsArray = colorsArray;
        this.indexArray = indexArray;
        this.Ammo = options.Ammo || window.Ammo;

        this.debugDrawMode = AmmoDebugConstants.MAX_DEBUG_DRAW_MODE;//options.debugDrawMode || AmmoDebugConstants.DrawWireframe;
        this.index = 0;

        if (this.indexArray) {
            Atomics.store(this.indexArray, 0, this.index);
        }

        this.enabled = false;

        this.debugDrawer = new this.Ammo.DebugDrawer();
        this.debugDrawer.drawLine = this.drawLine.bind(this);
        this.debugDrawer.drawContactPoint = this.drawContactPoint.bind(this);
        this.debugDrawer.reportErrorWarning = this.reportErrorWarning.bind(this);
        this.debugDrawer.draw3dText = this.draw3dText.bind(this);
        this.debugDrawer.setDebugMode = this.setDebugMode.bind(this);
        this.debugDrawer.getDebugMode = this.getDebugMode.bind(this);

        this.world.setDebugDrawer(this.debugDrawer);
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    update() {
        if (!this.enabled) return;

        if (this.indexArray) {
            if (Atomics.load(this.indexArray, 0) === 0) {
                this.index = 0;
                this.world.debugDrawWorld();
                Atomics.store(this.indexArray, 0, this.index);
            }
        } else {
            this.index = 0;
            this.world.debugDrawWorld();
        }
    }

    drawLine(from, to, color) {
        const heap = this.Ammo.HEAPF32;
        const r = heap[(color + 0) / 4];
        const g = heap[(color + 4) / 4];
        const b = heap[(color + 8) / 4];

        const fromX = heap[(from + 0) / 4];
        const fromY = heap[(from + 4) / 4];
        const fromZ = heap[(from + 8) / 4];
        this.setXYZ(this.verticesArray, this.index, fromX, fromY, fromZ);
        this.setXYZ(this.colorsArray, this.index++, r, g, b);

        const toX = heap[(to + 0) / 4];
        const toY = heap[(to + 4) / 4];
        const toZ = heap[(to + 8) / 4];
        this.setXYZ(this.verticesArray, this.index, toX, toY, toZ);
        this.setXYZ(this.colorsArray, this.index++, r, g, b);
    }

    drawContactPoint(pointOnB, normalOnB, distance, lifeTime, color) {
        const heap = this.Ammo.HEAPF32;
        const r = heap[(color + 0) / 4];
        const g = heap[(color + 4) / 4];
        const b = heap[(color + 8) / 4];

        const x = heap[(pointOnB + 0) / 4];
        const y = heap[(pointOnB + 4) / 4];
        const z = heap[(pointOnB + 8) / 4];
        this.setXYZ(this.verticesArray, this.index, x, y, z);
        this.setXYZ(this.colorsArray, this.index++, r, g, b);

        const dx = heap[(normalOnB + 0) / 4] * distance;
        const dy = heap[(normalOnB + 4) / 4] * distance;
        const dz = heap[(normalOnB + 8) / 4] * distance;
        this.setXYZ(this.verticesArray, this.index, x + dx, y + dy, z + dz);
        this.setXYZ(this.colorsArray, this.index++, r, g, b);
    }

    reportErrorWarning(warningString) {
        if (this.Ammo.hasOwnProperty("UTF8ToString")) {
            console.warn(this.Ammo.UTF8ToString(warningString));
        } else if (!this.warnedOnce) {
            this.warnedOnce = true;
            console.warn("Cannot print warningString, please export UTF8ToString from Ammo.js in make.py");
        }
    }

    draw3dText(location, textString) {
        // TODO: Implement text rendering if needed
    }

    setDebugMode(debugMode) {
        this.debugDrawMode = debugMode;
    }

    getDebugMode() {
        return this.debugDrawMode;
    }

    setXYZ(array, index, x, y, z) {
        index *= 3;
        array[index + 0] = x;
        array[index + 1] = y;
        array[index + 2] = z;
    }
}
