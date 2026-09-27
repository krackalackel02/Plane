export interface Vec2 {
  x: number;
  z: number;
}

/**
 * A board's collision footprint as an oriented rectangle (top-down, in
 * world x/z). `halfDepth` is the extent along the board's facing/normal
 * axis (how far it protrudes towards the ship), `halfWidth` is the extent
 * along its lateral axis (how wide the frame reads face-on).
 *
 * Derived from PictureFrame's own internal -90deg Y rotation (see board.tsx):
 * that bakes-in rotation swaps the box geometry's outerZ (depth) onto the
 * board group's local X axis and outerX (width) onto its local Z axis,
 * before the board's own per-item rotation.y (from
 * calculatedBoardPositionsAndRotations) turns that local frame to face the
 * arc's center.
 */
export interface BoardObb {
  centerX: number;
  centerZ: number;
  rotationY: number;
  halfDepth: number;
  halfWidth: number;
}

export const buildBoardObbs = (
  boardsData: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
  }>,
  boardGeometry: { outerX: number; outerZ: number },
): BoardObb[] =>
  boardsData.map((board) => ({
    centerX: board.position[0],
    centerZ: board.position[2],
    rotationY: board.rotation[1],
    halfDepth: boardGeometry.outerZ / 2,
    halfWidth: boardGeometry.outerX / 2,
  }));

export interface CircleObbCollision {
  // World-space vector to add to the circle's position to resolve the
  // overlap (push it back out of the board).
  pushOut: Vec2;
  // Unit vector, world-space, pointing away from the board at the contact
  // point - the direction the ship should bounce along.
  normal: Vec2;
}

/**
 * Treats the ship as a circle of the given radius and tests it against a
 * board's oriented rectangle, expanded by that same radius (a standard
 * Minkowski-sum simplification - slightly generous at the rectangle's
 * corners, which doesn't matter here since boards are approached mostly
 * face-on or from the side).
 *
 * Returns null when there's no overlap.
 */
export const resolveCircleObb = (
  position: Vec2,
  obb: BoardObb,
  radius: number,
): CircleObbCollision | null => {
  const dx = position.x - obb.centerX;
  const dz = position.z - obb.centerZ;
  const cos = Math.cos(obb.rotationY);
  const sin = Math.sin(obb.rotationY);

  // World -> board-local (inverse rotation): u along the facing axis, v
  // along the lateral axis.
  const u = dx * cos - dz * sin;
  const v = dx * sin + dz * cos;

  const halfDepth = obb.halfDepth + radius;
  const halfWidth = obb.halfWidth + radius;

  if (Math.abs(u) >= halfDepth || Math.abs(v) >= halfWidth) return null;

  // Inside the expanded box - push out along whichever axis has the
  // smaller penetration (the nearer edge).
  const penetrationU = halfDepth - Math.abs(u);
  const penetrationV = halfWidth - Math.abs(v);
  const signU = u >= 0 ? 1 : -1;
  const signV = v >= 0 ? 1 : -1;

  const pushAlongFacing = penetrationU <= penetrationV;
  const localPushU = pushAlongFacing ? signU * penetrationU : 0;
  const localPushV = pushAlongFacing ? 0 : signV * penetrationV;

  // Board-local -> world (forward rotation).
  const worldPushX = localPushU * cos + localPushV * sin;
  const worldPushZ = -localPushU * sin + localPushV * cos;
  const pushMagnitude = Math.hypot(worldPushX, worldPushZ) || 1;

  return {
    pushOut: { x: worldPushX, z: worldPushZ },
    normal: { x: worldPushX / pushMagnitude, z: worldPushZ / pushMagnitude },
  };
};
