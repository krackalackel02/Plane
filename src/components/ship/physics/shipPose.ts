import { Euler, Quaternion, type Object3D, type Vector3 } from "three";

/**
 * Poses the ship for a frame, split across two objects:
 *
 * - `ship` - the ship's own frame: where it is and which way it's heading on
 *   the surface. The chase camera rides on this as a child (see
 *   camera/index.tsx), so it must only ever carry the true heading;
 * - `attitude` - the body and exhaust inside it, which take the purely
 *   cosmetic lean on top: pitching, banking into turns, and the barrel-roll
 *   trick's full turn about the nose.
 *
 * When the lean went onto the ship's own frame, the camera inherited it: a
 * barrel roll swung the camera - and the whole planet with it - around the
 * ship, instead of the ship spinning on its own axis in a still view.
 */
export const applyShipPose = (
  ship: Object3D,
  attitude: Object3D | null | undefined,
  position: Vector3,
  heading: Quaternion,
  pitch: number,
  roll: number,
) => {
  ship.position.copy(position);
  ship.quaternion.copy(heading);
  attitude?.quaternion.setFromEuler(new Euler(pitch, 0, roll));
};
