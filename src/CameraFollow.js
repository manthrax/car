import * as THREE from 'three';

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();

/**
 * Updates the camera to follow a target mesh while preventing clipping through physics geometry.
 * @param {THREE.Camera} camera 
 * @param {OrbitControls} controls 
 * @param {THREE.Mesh} targetMesh 
 * @param {Physics} physics 
 * @param {number} desiredDistance The target follow distance
 * @param {THREE.Vector3} localOffset The offset from the targetMesh origin to the focus point
 */
export function updateCameraFollow(camera, controls, targetMesh, physics, desiredDistance, localOffset = new THREE.Vector3(0, .7, 0)) {
    if (!camera || !controls || !targetMesh || !physics) return;
    let offY = camera.position.y
    // 1. Sync controls target to targetMesh with local offset
    targetMesh.localToWorld(controls.target.copy(localOffset));

    // 1.1 Ground Clamp for target (prevent "crazy" camera when upside down)
    const targetGroundHits = [];
    v0.copy(controls.target);
    v1.copy(v0).setY(v0.y + .5); // Start slightly above
    v0.setY(v0.y - 1); // Shoot down
    physics.raycast(v1, v0, targetGroundHits, 1);
    if (targetGroundHits.length > 0) {
        const minTargetY = targetGroundHits[0].hitPoint.y + 0.5;
        if (controls.target.y < minTargetY) {
            controls.target.y = minTargetY;
        }
    }

    // 2. Set camera to desired distance (preserving current direction)
    v0.copy(camera.position).sub(controls.target).setLength(desiredDistance).add(controls.target);
    camera.position.copy(v0);

    // 3. Ground Check: Prevent camera from going below terrain
    const groundHits = [];
    v0.copy(camera.position);
    const camMinGroundHeight = 3;
    v1.copy(v0).setY(v0.y); // Start from high above
    v0.setY(v0.y - camMinGroundHeight); // Shoot far down

    physics.raycast(v1, v0, groundHits, 1); // Mask 1 for terrain

    if (groundHits.length > 0) {
        const minGroundY = groundHits[0].hitPoint.y + camMinGroundHeight; // 5 meter minimum height
        if (camera.position.y < minGroundY) {
            camera.position.y = minGroundY;
        }
    }

    // 4. Perform raycast from target to camera to prevent clipping
    const hits = [];
    physics.raycast(controls.target, camera.position, hits, 1); // Only hit Group 1 (Terrain)

    if (hits.length > 0) {
        // Pull camera in to hit point with a 5% buffer
        v1.copy(hits[0].hitPoint);
        v0.copy(v1).sub(controls.target).multiplyScalar(1.0).add(controls.target);
        camera.position.copy(v0);
    }
}
