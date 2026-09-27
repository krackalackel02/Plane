import { WorldBounds } from "../../utils/worldBounds";

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
  // The world boundary's radius (see utils/worldBounds), scaled into the
  // same map CSS-pixel space as toMap/boardPoints. Always centered at
  // (size/2, size/2) by construction, since the world boundary is itself
  // centered on (bounds.centerX, bounds.centerZ).
  boundaryRadius: number;
}

/**
 * Build a fixed-scale world (x, z) -> map (x, y) CSS-pixel projection that
 * fits the whole world boundary circle (see utils/worldBounds) inside a
 * `size` x `size` square, with `paddingRatio` reserved as empty margin -
 * i.e. the boundary maps exactly onto the minimap's own circular dock, so
 * "how close to the rim you are on the map" directly reads as "how close
 * to the wall you are in the world". Since the boundary already contains
 * every board plus the ship's (0, 0, 0) starting point with room to
 * spare, this guarantees both fit too.
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
  bounds: WorldBounds,
  boards: WorldPoint[],
  size: number,
  paddingRatio: number,
): WorldToMapProjection => {
  const boundaryRadius = (size / 2) * (1 - paddingRatio);
  const scale = boundaryRadius / bounds.radius;

  const toMap = (x: number, z: number): [number, number] => [
    size / 2 - (x - bounds.centerX) * scale,
    size / 2 - (z - bounds.centerZ) * scale,
  ];

  const boardPoints: MapPoint[] = boards.map((b) => {
    const [x, y] = toMap(b.position[0], b.position[2]);
    return { id: b.id, x, y };
  });

  return { toMap, boardPoints, boundaryRadius };
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
