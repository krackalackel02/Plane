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

export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldToMapProjection {
  toMap: (x: number, z: number) => [number, number];
  boardPoints: MapPoint[];
  // The world boundary (see utils/worldBounds) in the same map CSS-pixel
  // space as toMap/boardPoints, so the minimap can draw the zone the ship
  // is physically confined to.
  boundaryRect: MapRect;
}

/**
 * Build a fixed-scale world (x, z) -> map (x, y) CSS-pixel projection that
 * fits the whole world boundary (see utils/worldBounds) inside a `size` x
 * `size` square, with `paddingRatio` reserved as empty margin. Since the
 * boundary already contains every board plus the ship's (0, 0, 0) starting
 * point with room to spare, this guarantees both fit too.
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
  const spanX = Math.max(bounds.maxX - bounds.minX, 10);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 10);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

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

  // Two opposite corners of the boundary, mapped, then normalized into a
  // top-left-origin rect - the axis negation above means either corner can
  // land on either side depending on world orientation.
  const [cornerAX, cornerAY] = toMap(bounds.minX, bounds.minZ);
  const [cornerBX, cornerBY] = toMap(bounds.maxX, bounds.maxZ);
  const boundaryRect: MapRect = {
    x: Math.min(cornerAX, cornerBX),
    y: Math.min(cornerAY, cornerBY),
    width: Math.abs(cornerBX - cornerAX),
    height: Math.abs(cornerBY - cornerAY),
  };

  return { toMap, boardPoints, boundaryRect };
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
