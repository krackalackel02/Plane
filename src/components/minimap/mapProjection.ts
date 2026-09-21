export interface WorldPoint {
  id: string;
  position: [number, number, number];
}

export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

export interface WorldToMapProjection {
  toMap: (x: number, z: number) => [number, number];
  boardPoints: MapPoint[];
}

/**
 * Build a fixed-scale world (x, z) -> map (x, y) CSS-pixel projection that
 * fits every board plus the ship's (0, 0, 0) starting point inside a
 * `size` x `size` square, with `paddingRatio` reserved as empty margin.
 *
 * Both world axes are negated:
 *
 * - Z is negated so increasing Z - the direction TranslationMotion treats
 *   as forward at yaw 0, and where the timeline boards sit - reads as
 *   "up" on the map, matching the fixed "N" compass label.
 * - X is negated so the map's left/right matches the game's own notion
 *   of the ship's left/right. keyContext's determineControlState defines
 *   "turning left" as increasing yaw (the 'a' key, yaw.positive), and on
 *   a north-up map turning left must rotate the blip counter-clockwise
 *   (12 o'clock towards 9 o'clock). Without this flip, increasing yaw
 *   rotates the map's arrow clockwise instead - the ship's own left turn
 *   reads as a right turn on the map.
 *
 * See arrowRotationForYaw for how the ship arrow's rotation is derived
 * from these same two flips.
 */
export const computeWorldToMapProjection = (
  boards: WorldPoint[],
  size: number,
  paddingRatio: number,
): WorldToMapProjection => {
  const xs = [0, ...boards.map((b) => b.position[0])];
  const zs = [0, ...boards.map((b) => b.position[2])];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  // Floor the span so a single board (or none) doesn't zoom the map in to
  // an unusably tiny world.
  const spanX = Math.max(maxX - minX, 10);
  const spanZ = Math.max(maxZ - minZ, 10);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const usable = size * (1 - paddingRatio);
  const scale = usable / Math.max(spanX, spanZ);

  const toMap = (x: number, z: number): [number, number] => [
    size / 2 - (x - centerX) * scale,
    size / 2 - (z - centerZ) * scale,
  ];

  const boardPoints: MapPoint[] = boards.map((b) => {
    const [x, y] = toMap(b.position[0], b.position[2]);
    return { id: b.id, x, y };
  });

  return { toMap, boardPoints };
};

/**
 * Canvas rotation to apply to an up-pointing arrow glyph so it matches
 * the ship's yaw heading on the map.
 *
 * TranslationMotion moves the ship by (sin(yaw), cos(yaw)) in (x, z).
 * Because computeWorldToMapProjection negates both x and z, that forward
 * vector becomes (-sin(yaw), -cos(yaw)) on screen - exactly what
 * ctx.rotate(-yaw) does to an arrow drawn pointing up. So at yaw 0 the
 * arrow points straight up (north, toward the boards), and as yaw
 * increases (the ship turning left, per keyContext) the arrow turns
 * counter-clockwise, matching a north-up map instead of running mirrored.
 */
export const arrowRotationForYaw = (yaw: number): number => -yaw;
