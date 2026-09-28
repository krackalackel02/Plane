import { Quaternion, Vector3 } from "three";
import { boardJsonProps, PositionedBoard } from "../types/boardTypes";
import { Planet, getActivePlanet, getShellRadius } from "../../utils/planets";
import {
  buildSurfaceOrientation,
  eastNorthAt,
  pointOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";
import { getBoardMatWorldPosition } from "../../utils/3d";

/**
 * Lay boards out evenly spaced around a planet's equator, standing upright
 * on the cruise shell and facing the direction of travel (increasing
 * longitude) - so flying one full loop of the equator visits every board in
 * order, like signposts along a ring road. This is the one clear, readable
 * pattern for "how do I see everything on this planet".
 */
export const calculatedBoardPositionsAndRotations = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): PositionedBoard[] => {
  const shellRadius = getShellRadius(planet);
  const angleStep = (Math.PI * 2) / Math.max(items.length, 1);

  return items.map((item, i) => {
    const lon = i * angleStep;
    const position = pointOnSphere(shellRadius, 0, lon, planet.center);
    const normal = surfaceNormal(position, planet.center);
    // PictureFrame bakes in its own -90deg Y rotation (see boardCollision.ts's
    // doc comment), which puts the image's face normal on this group's local
    // -X axis. Facing "south" here (forwardHint = -north) makes local +X
    // point east, so the face normal ends up pointing west - toward a ship
    // approaching from lower longitude, i.e. head-on for the direction of
    // travel this layout is built around.
    const { north } = eastNorthAt(normal);
    const orientation = buildSurfaceOrientation(normal, north.clone().negate());

    return {
      ...item,
      position: position.toArray() as [number, number, number],
      quaternion: orientation.toArray() as [number, number, number, number],
    };
  });
};

// Radians of open trail kept between the ship's spawn point and the first
// project's activation zone - just enough that the player starts facing
// toward something to fly to, rather than spawning on top of it (or just
// past it, with the first stop behind them).
const SPAWN_LEAD_ANGLE = 0.25;

/**
 * Where the ship spawns: a short stretch of open trail before the first
 * project's activation zone (see activationZone.tsx for why the zone isn't
 * at the same longitude as the board's own anchor). Falls back to the
 * planet's lon-0 point facing east if there are no boards at all.
 */
export const spawnTransform = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): { position: Vector3; orientation: Quaternion } => {
  const shellRadius = getShellRadius(planet);
  const [firstBoard] = calculatedBoardPositionsAndRotations(items, planet);

  let spawnLon = 0;
  if (firstBoard) {
    const zoneWorldPosition = getBoardMatWorldPosition(
      firstBoard.position,
      firstBoard.quaternion,
    );
    const zoneNormal = surfaceNormal(zoneWorldPosition, planet.center);
    const zoneLon = Math.atan2(zoneNormal.x, zoneNormal.z);
    spawnLon = zoneLon - SPAWN_LEAD_ANGLE;
  }

  const position = pointOnSphere(shellRadius, 0, spawnLon, planet.center);
  const normal = surfaceNormal(position, planet.center);
  const { east } = eastNorthAt(normal);
  const orientation = buildSurfaceOrientation(normal, east);
  return { position, orientation };
};

// How far to either side of the trail centerline each board sits, in world
// units. Must clear the activation zone's own half-width (4, see
// activationZone.tsx's size=[8,6]) plus the board's own half-width (3.35,
// boardParams.json's outerX/2) - anything under ~7.4 lets the board's near
// edge poke into the zone's mat. 12 leaves a comfortable gap instead of
// sitting right at that threshold.
export const BOARD_SIDE_OFFSET = 12;

/** Alternates left/right by index, so consecutive stops flank the trail on opposite sides. */
export const boardSideOffset = (index: number): number =>
  index % 2 === 0 ? BOARD_SIDE_OFFSET : -BOARD_SIDE_OFFSET;

/**
 * A board's actual rendered position - its trail-centerline anchor (see
 * calculatedBoardPositionsAndRotations) shifted boardSideOffset() units
 * along its own local Z (lateral) axis, matching the identical local
 * offset board.tsx applies to the visual PictureFrame. The board's own
 * `position`/`quaternion` deliberately stay at the centerline anchor
 * everywhere else (autopilot targets, the minimap, the trail beacons) -
 * this is specifically for anything that needs to know where the board
 * actually, visibly sits, chiefly its collision box (see
 * ship/physics/collision/boardCollision.ts): building that from the raw
 * anchor instead would put the hitbox back on the centerline, where the
 * ship is actually meant to fly, bumping it against a board that visually
 * isn't there any more.
 */
export const boardVisualTransform = (
  board: Pick<PositionedBoard, "position" | "quaternion">,
  index: number,
): Pick<PositionedBoard, "position" | "quaternion"> => {
  const quaternion = new Quaternion(...board.quaternion);
  const position = new Vector3(0, 0, boardSideOffset(index))
    .applyQuaternion(quaternion)
    .add(new Vector3(...board.position));
  return {
    position: position.toArray() as [number, number, number],
    quaternion: board.quaternion,
  };
};
