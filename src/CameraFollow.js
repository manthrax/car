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

    // 2. Set camera to desired distance (preserving current direction)
    v0.copy(camera.position).sub(controls.target).setLength(desiredDistance).add(controls.target);
    camera.position.copy(v0);

    // 3. Perform raycast from target to camera to prevent clipping
    const hits = [];
    physics.raycast(controls.target, camera.position, hits);

    if (hits.length > 0) {
        // Pull camera in to hit point with a 5% buffer
        v1.copy(hits[0].hitPoint);
        v0.copy(v1).sub(controls.target).multiplyScalar(1.0).add(controls.target);
        camera.position.copy(v0);
    }
    //if ((camera.position.y - controls.target.y) < offY) camera.position.y = controls.target.y + offY
}
