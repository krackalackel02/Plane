import { Matrix4, Quaternion, Vector3 } from "three";
import { PositionedBoard } from "../../../types/boardTypes";

export interface HalfExtents {
  x: number;
  y: number;
  z: number;
}

/**
 * A board's collision footprint as a 3D oriented box, expressed via its own
 * position/orientation rather than a flat top-down rectangle - boards stand
 * at a different tilt at every longitude around the planet, so a Y-only
 * angle (as the old flat-world version used) can't describe it any more.
 *
 * `halfExtents.x` is along the board's own local X axis (its facing/depth
 * axis), `halfExtents.z` along its local Z axis (lateral/width),
 * `halfExtents.y` along local Y (height). The x/z swap versus the raw box
 * geometry's own outerX/outerZ is because of PictureFrame's internal
 * -90deg Y rotation (see board.tsx): that bakes-in rotation swaps the box
 * geometry's outerZ (depth, how far the frame protrudes along its facing
 * axis) onto this group's local X, and outerX (width) onto its local Z -
 * regardless of which way the group itself is oriented in the world.
 */
export interface BoardObb {
  position: Vector3;
  invQuaternion: Quaternion;
  quaternion: Quaternion;
  halfExtents: HalfExtents;
}

export const buildBoardObbs = (
  boardsData: Pick<PositionedBoard, "position" | "quaternion">[],
  boardGeometry: { outerX: number; outerY: number; outerZ: number },
): BoardObb[] =>
  boardsData.map((board) => {
    const quaternion = new Quaternion(...board.quaternion);
    return {
      position: new Vector3(...board.position),
      quaternion,
      invQuaternion: quaternion.clone().invert(),
      halfExtents: {
        x: boardGeometry.outerZ / 2,
        y: boardGeometry.outerY / 2,
        z: boardGeometry.outerX / 2,
      },
    };
  });

export interface BoxCollision {
  // World-space vector to add to the ship's position to resolve the
  // overlap (push it back out of the board).
  pushOut: Vector3;
  // Unit vector, world-space, pointing away from the board at the contact
  // point - the direction the ship should bounce along.
  normal: Vector3;
}

const AXES: Array<keyof HalfExtents> = ["x", "y", "z"];

/**
 * Ship half-extent as projected onto one of the board's own local axes -
 * the standard "expand this box by the other box's size along my axis"
 * trick: the ship's bounding box, viewed from the board's own orientation,
 * casts a shadow on that axis equal to the sum of its own half-extents
 * weighted by how aligned each of the ship's axes is with it.
 */
const projectedExtent = (
  relativeMatrixElements: number[],
  ship: HalfExtents,
  row: 0 | 1 | 2,
): number =>
  Math.abs(relativeMatrixElements[row]) * ship.x +
  Math.abs(relativeMatrixElements[row + 4]) * ship.y +
  Math.abs(relativeMatrixElements[row + 8]) * ship.z;

/**
 * Tests the ship's own oriented bounding box against a board's, entirely in
 * the board's local space (via its quaternion) - so it needs no assumption
 * about which way the board or the ship happen to be oriented in the
 * world, and holds anywhere on the planet.
 *
 * This checks all three of the board's local axes (not just its flat
 * top-down footprint), which matters more than it might look: two points
 * on opposite sides of the planet can land almost exactly on top of each
 * other when only the depth/width axes are compared, because "opposite
 * side of a sphere" is *entirely* a difference along the board's own
 * height/normal axis - the one a flat 2D check would silently ignore.
 * Checking height too is what tells a ship on the far side of the planet
 * apart from one actually standing at the board.
 *
 * An approximation of full 3D OBB-vs-OBB (it only tests the board's own
 * three face-normal axes as separating axes, not the ship's, nor their
 * nine edge-cross-axes a complete SAT test would add) - but a solid one
 * for two boxes that are both roughly axis-sized rather than long and
 * thin, and a much better match for "the ship's actual bounding box" than
 * treating it as a uniform sphere.
 *
 * Returns null when there's no overlap.
 */
export const resolveShipBoardCollision = (
  shipPosition: Vector3,
  shipQuaternion: Quaternion,
  shipHalfExtents: HalfExtents,
  obb: BoardObb,
): BoxCollision | null => {
  const local = shipPosition
    .clone()
    .sub(obb.position)
    .applyQuaternion(obb.invQuaternion);

  const relative = new Quaternion().multiplyQuaternions(
    obb.invQuaternion,
    shipQuaternion,
  );
  const m = new Matrix4().makeRotationFromQuaternion(relative).elements;

  const half = {
    x: obb.halfExtents.x + projectedExtent(m, shipHalfExtents, 0),
    y: obb.halfExtents.y + projectedExtent(m, shipHalfExtents, 1),
    z: obb.halfExtents.z + projectedExtent(m, shipHalfExtents, 2),
  };

  if (
    Math.abs(local.x) >= half.x ||
    Math.abs(local.y) >= half.y ||
    Math.abs(local.z) >= half.z
  ) {
    return null;
  }

  // Inside on all three axes - push out along whichever has the smallest
  // penetration (the nearest edge).
  const penetration = {
    x: half.x - Math.abs(local.x),
    y: half.y - Math.abs(local.y),
    z: half.z - Math.abs(local.z),
  };
  const pushAxis = AXES.reduce((a, b) =>
    penetration[b] < penetration[a] ? b : a,
  );

  const localPush = new Vector3();
  const sign = local[pushAxis] >= 0 ? 1 : -1;
  localPush[pushAxis] = sign * penetration[pushAxis];

  const worldPush = localPush.applyQuaternion(obb.quaternion);
  const pushMagnitude = worldPush.length() || 1;

  return {
    pushOut: worldPush,
    normal: worldPush.clone().divideScalar(pushMagnitude),
  };
};
