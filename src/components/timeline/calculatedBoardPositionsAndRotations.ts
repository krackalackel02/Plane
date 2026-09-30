import { Quaternion, Vector3 } from "three";
import { boardJsonProps, PositionedBoard } from "../types/boardTypes";
import { Planet, getActivePlanet, getShellRadius } from "../../utils/planets";
import {
  buildSurfaceOrientation,
  pointOnSphere,
  projectToShell,
  surfaceNormal,
} from "../../utils/planetSurface";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { CONTINENTS, outlineRadiusAt } from "../planet/planetTerrain";

// A gentle base swing, on top of which each nearby landmass adds its own
// detour (see islandBumpDeg below) - most of the trail's actual shape now
// comes from routing around wherever the (deliberately scattered, not
// latitude-banded - see planetTerrain.ts) continents and islands happen to
// be, rather than from this wiggle alone.
export const PATH_WIGGLE_AMPLITUDE = (10 * Math.PI) / 180; // ~10 degrees of latitude swing
const PATH_WIGGLE_CYCLES = 5; // full swings per full loop of the planet

const baseLatitudeDeg = (lonDeg: number): number =>
  ((PATH_WIGGLE_AMPLITUDE * 180) / Math.PI) *
  Math.sin(((lonDeg * Math.PI) / 180) * PATH_WIGGLE_CYCLES);

// How much room the trail centerline itself actually needs to clear a
// landmass by, in world units: the ship's own half-width (shipParams.json)
// plus a turning/visual-breathing-room buffer. This is deliberately just
// the ship's own requirement, not the board/activation-zone footprint
// beside it (their much larger sideways offset would roughly double this
// and, combined with the corridor every *other* landmass also needs,
// leaves no room for continents with real visual size - see
// planetTerrain.ts's CONTINENTS comment) - a board occasionally rendering
// near a big continent's coastline is an acceptable trade for that, since
// nothing about it is actually broken (the centerline the ship flies
// still never crosses land).
const SHIP_HALF_WIDTH = 2.5;
const CORRIDOR_SAFETY_MARGIN = 4.5;
const CORRIDOR_HALF_WIDTH = SHIP_HALF_WIDTH + CORRIDOR_SAFETY_MARGIN;

// Precomputed once (CONTINENTS is static): each landmass's own centroid
// and widest outline radius, in world units.
const islandProfiles = CONTINENTS.map((c) => {
  let maxRadius = 0;
  for (let i = 0; i < 36; i++) {
    maxRadius = Math.max(maxRadius, outlineRadiusAt(c, (i / 36) * Math.PI * 2));
  }
  return { lat: c.lat, lon: c.lon, radiusWorldUnits: maxRadius };
});

// A first (coarse) search pass finds roughly where it's safe, a second
// (fine) pass refines tightly around that; SEARCH_MARGIN is extra
// world-unit headroom beyond the bare CORRIDOR_HALF_WIDTH requirement, to
// absorb both passes' step size and keep genuine margin rather than
// landing exactly on the boundary.
const COARSE_LAT_STEP_DEG = 2;
const FINE_LAT_STEP_DEG = 0.1;
const SEARCH_MARGIN = 5;

/**
 * Finds a safe trail latitude (radians) at a given longitude: the one
 * closest to the gentle base wiggle that still keeps true 3D distance to
 * every landmass's centroid, minus that landmass's own radius, at least
 * CORRIDOR_HALF_WIDTH (plus a safety margin) - a direct numeric search
 * over real 3D distances, not a closed-form approximation. An earlier
 * attempt summed a per-island "nudge" instead, which broke down whenever
 * two landmasses' influence zones overlapped - the sum could silently
 * produce a latitude that cleared *neither* of them. This can't have that
 * failure mode: every candidate is checked directly against every
 * landmass, so "safe" always means safe from all of them at once.
 */
const searchSafeLatitude = (
  lon: number,
  radius: number,
  center: Vector3,
): number => {
  const baseDeg = baseLatitudeDeg((lon * 180) / Math.PI);
  const requiredClearance = CORRIDOR_HALF_WIDTH + SEARCH_MARGIN;
  const islandCenters = islandProfiles.map((island) =>
    pointOnSphere(radius, island.lat, island.lon, center),
  );

  const clearanceAt = (latDeg: number): number => {
    const point = pointOnSphere(radius, (latDeg * Math.PI) / 180, lon, center);
    let min = Infinity;
    for (let i = 0; i < islandProfiles.length; i++) {
      const clearance =
        point.distanceTo(islandCenters[i]) - islandProfiles[i].radiusWorldUnits;
      if (clearance < min) min = clearance;
    }
    return min;
  };

  const pickBest = (
    step: number,
    from: number,
    to: number,
    fallback: number,
  ): number => {
    let best: number | null = null;
    let bestDeviation = Infinity;
    for (let lat = from; lat <= to; lat += step) {
      if (clearanceAt(lat) >= requiredClearance) {
        const deviation = Math.abs(lat - baseDeg);
        if (deviation < bestDeviation) {
          bestDeviation = deviation;
          best = lat;
        }
      }
    }
    return best ?? fallback;
  };

  const coarse = pickBest(COARSE_LAT_STEP_DEG, -84, 84, baseDeg);
  const fine = pickBest(
    FINE_LAT_STEP_DEG,
    coarse - COARSE_LAT_STEP_DEG,
    coarse + COARSE_LAT_STEP_DEG,
    coarse,
  );
  return (fine * Math.PI) / 180;
};

/** Latitude (radians) of the trail at a given longitude/shell radius - the gentle base wiggle, nudged to clear every landmass (see searchSafeLatitude). */
const pathLatitude = (lon: number, radius: number, center: Vector3): number =>
  searchSafeLatitude(lon, radius, center);

export interface PathFrame {
  position: Vector3;
  normal: Vector3;
  // Unit vector, tangent to the surface, pointing in the direction of
  // increasing longitude along the (possibly wiggling) path.
  tangent: Vector3;
}

// Small longitude step used to finite-difference the tangent - simple and
// accurate enough at this wiggle's scale, and avoids hand-deriving a
// closed-form derivative for the sphere-plus-latitude-wiggle parametrization.
const TANGENT_EPSILON = 0.001;

/**
 * Position, surface normal, and direction-of-travel tangent of the trail at
 * a given longitude, on the shell at the given radius. The one place that
 * actually knows about the zigzag - everything that needs to sit "on the
 * trail" (boards, the ship's spawn point, the visual trail itself) goes
 * through this, so they can never drift out of sync with each other.
 */
export const pathFrameAt = (
  radius: number,
  lon: number,
  center: Vector3 = new Vector3(),
): PathFrame => {
  const position = pointOnSphere(
    radius,
    pathLatitude(lon, radius, center),
    lon,
    center,
  );
  const normal = surfaceNormal(position, center);
  const ahead = pointOnSphere(
    radius,
    pathLatitude(lon + TANGENT_EPSILON, radius, center),
    lon + TANGENT_EPSILON,
    center,
  );
  const tangent = ahead.sub(position).normalize();
  return { position, normal, tangent };
};

/**
 * Orientation standing upright at `normal`, facing back along `tangent` -
 * PictureFrame bakes in its own -90deg Y rotation (see boardCollision.ts's
 * doc comment), which puts the image's face normal on this group's local
 * -X axis. Building local +X from tangent (rather than +Z) puts the face
 * normal opposite the direction of travel, i.e. facing a ship approaching
 * from behind - head-on, the way a roadside sign faces oncoming traffic.
 */
const orientationAlongPath = (
  normal: Vector3,
  tangent: Vector3,
): Quaternion => {
  const forwardHint = new Vector3().crossVectors(tangent, normal);
  return buildSurfaceOrientation(normal, forwardHint);
};

/**
 * Lay boards out evenly spaced by longitude along the planet's trail (see
 * pathFrameAt), standing upright on the cruise shell and facing back along
 * it - so flying one full loop visits every board in order, like signposts
 * along a ring road. This is the one clear, readable pattern for "how do I
 * see everything on this planet".
 */
export const calculatedBoardPositionsAndRotations = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): PositionedBoard[] => {
  const shellRadius = getShellRadius(planet);
  const angleStep = (Math.PI * 2) / Math.max(items.length, 1);

  return items.map((item, i) => {
    const lon = i * angleStep;
    const { position, normal, tangent } = pathFrameAt(
      shellRadius,
      lon,
      planet.center,
    );
    const orientation = orientationAlongPath(normal, tangent);

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
 * planet's lon-0 point if there are no boards at all.
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

  const { position, normal, tangent } = pathFrameAt(
    shellRadius,
    spawnLon,
    planet.center,
  );
  // Ship's own forward convention is local +Z (see PlanetMotion), unlike a
  // board's local +X (see orientationAlongPath) - so this builds directly
  // from the path's tangent as the forward hint, facing along the
  // direction of travel rather than back along it like a board does.
  const orientation = buildSurfaceOrientation(normal, tangent);
  return { position, orientation };
};

// How far to either side of the trail centerline each board sits, in world
// units. Must clear the activation zone's own half-width (4, see
// activationZone.tsx's size=[8,6]) plus the board's own half-width (3.35,
// boardParams.json's outerX/2) - anything under ~7.4 lets the board's near
// edge poke into the zone's mat. 12 leaves a comfortable gap instead of
// sitting right at that threshold.
export const BOARD_SIDE_OFFSET = 12;

/** Alternates left/right by index (first board on the left), so consecutive stops flank the trail on opposite sides. */
export const boardSideOffset = (index: number): number =>
  index % 2 === 0 ? -BOARD_SIDE_OFFSET : BOARD_SIDE_OFFSET;

/**
 * A board's actual rendered position - its trail-centerline anchor (see
 * calculatedBoardPositionsAndRotations) shifted boardSideOffset() units
 * along its own local Z (lateral) axis, then re-projected back onto the
 * planet's shell and given a fresh orientation built at that landing point.
 *
 * The naive version - just offsetting the anchor's position without
 * reprojecting - moves along the anchor's flat TANGENT PLANE, not the
 * sphere's actual curved surface: the further the offset, the further the
 * board bulges outward from the shell, and its "up" (still the anchor's own
 * normal) increasingly stops matching the true radial direction at the
 * board's own landing spot. Both show up as the same visual bug - the board
 * visibly tilting and sticking out rather than sitting flush on the
 * curve - which is exactly what re-projecting + rebuilding the orientation
 * here fixes.
 *
 * The board's own `position`/`quaternion` fields deliberately stay at the
 * centerline anchor everywhere else (autopilot targets, the minimap, the
 * trail beacons) - this is specifically for anything that needs to know
 * where the board actually, visibly sits, chiefly its collision box (see
 * ship/physics/collision/boardCollision.ts): building that from the raw
 * anchor instead would put the hitbox back on the centerline, where the
 * ship is actually meant to fly, bumping it against a board that visually
 * isn't there any more.
 */
export const boardVisualTransform = (
  board: Pick<PositionedBoard, "position" | "quaternion">,
  index: number,
  planet: Planet = getActivePlanet(),
): Pick<PositionedBoard, "position" | "quaternion"> => {
  const anchorQuaternion = new Quaternion(...board.quaternion);
  const anchorPosition = new Vector3(...board.position);
  const shellRadius = anchorPosition.distanceTo(planet.center);

  const tangentPlaneOffset = new Vector3(0, 0, boardSideOffset(index))
    .applyQuaternion(anchorQuaternion)
    .add(anchorPosition);
  const position = projectToShell(
    tangentPlaneOffset,
    shellRadius,
    planet.center,
  );
  const normal = surfaceNormal(position, planet.center);
  // Keep facing the same general direction the anchor faced (its own local
  // X, per orientationAlongPath - the tangent-along-the-path direction),
  // re-derived fresh against this new, slightly different normal. Mirrors
  // orientationAlongPath's own cross(tangent, normal) construction (local
  // X = cross(normal, forwardHint), so recovering a forwardHint that lands
  // back on the same local X takes the cyclic cross(X, normal) instead).
  const anchorFacing = new Vector3(1, 0, 0).applyQuaternion(anchorQuaternion);
  const forwardHint = new Vector3().crossVectors(anchorFacing, normal);
  const orientation = buildSurfaceOrientation(normal, forwardHint);

  return {
    position: position.toArray() as [number, number, number],
    quaternion: orientation.toArray() as [number, number, number, number],
  };
};
