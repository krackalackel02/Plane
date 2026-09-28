import * as THREE from "three";

/**
 * Points `camera` at `worldTarget`, rolled so `worldUp` reads as vertical -
 * unlike Object3D.lookAt(), which always rolls using the object's own
 * `camera.up` property.
 *
 * That property can't be repurposed here: OrbitControls reads `camera.up`
 * as being in the SAME space as `camera.position` (local, since the camera
 * is parented to the ship) to decide which local axis it orbits around, so
 * it has to stay the local (0,1,0) - the ship's own up axis in its own
 * terms, always, regardless of the ship's orientation in the world. But the
 * roll a viewer actually wants is relative to the ship's true WORLD-space
 * up (the planet's surface normal at its current position), which is
 * essentially never world +Y once the ship has moved from its exact spawn
 * point. Leaving `camera.up` at world (0,1,0) and calling the plain
 * `lookAt()` computes roll against the wrong axis - increasingly wrong the
 * further the ship's actual up drifts from world +Y - which is what made
 * the ship render banked/rolled instead of level. Passing the desired up
 * in explicitly here keeps that from ever fighting OrbitControls' own use
 * of the same shared vector.
 */
export const lookAtWithUp = (
  camera: THREE.Camera,
  worldTarget: THREE.Vector3,
  worldUp: THREE.Vector3,
) => {
  const worldPosition = camera.getWorldPosition(new THREE.Vector3());
  const lookMatrix = new THREE.Matrix4().lookAt(
    worldPosition,
    worldTarget,
    worldUp,
  );
  const worldQuaternion = new THREE.Quaternion().setFromRotationMatrix(
    lookMatrix,
  );

  if (camera.parent) {
    const parentWorldQuaternion = new THREE.Quaternion();
    camera.parent.getWorldQuaternion(parentWorldQuaternion);
    camera.quaternion.copy(
      parentWorldQuaternion.invert().multiply(worldQuaternion),
    );
  } else {
    camera.quaternion.copy(worldQuaternion);
  }
};
