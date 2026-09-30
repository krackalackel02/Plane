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
import { surfaceClearanceAt } from "../planet/planetTerrain";

// How much room the trail centerline itself actually needs to clear a
// landmass by, in world units: the ship's own half-width (shipParams.json)
// plus a turning/visual-breathing-room buffer. This is deliberately just
// the ship's own requirement, not the board/activation-zone footprint
// beside it (their much larger sideways offset would roughly double this
// and, combined with the corridor every *other* landmass also needs,
// leaves no room for continents with real visual size - see
// planetTerrain.ts's CONTINENTS comment). A board occasionally rendering
// near a big continent's coastline is an acceptable trade for that, since
// the centerline the ship actually flies still never crosses land.
const SHIP_HALF_WIDTH = 2.5;
const CORRIDOR_SAFETY_MARGIN = 4.5;
const CORRIDOR_HALF_WIDTH = SHIP_HALF_WIDTH + CORRIDOR_SAFETY_MARGIN;

// The trail is one closed curve all the way around the planet - a latitude
// for every longitude - stored as this many evenly spaced latitude samples
// (2 degrees apart) and interpolated between them (see sampleProfile).
//
// Denser sampling is deliberately *not* better here: the relaxation below
// balances a smoothing pull against a per-sample push, and the smoothing's
// reach is measured in samples, so halving the spacing halves the angular
// span it damps over. At 1 degree the push wins locally, a bulge forms beside
// an island and runs away to the latitude clamp instead of settling -
// measured, not assumed.
const PROFILE_SAMPLES = 180;
const MAX_PATH_LATITUDE = (82 * Math.PI) / 180;
// Headroom over the bare requirement. The router only enforces clearance at
// its own samples, while the ship flies the Catmull-Rom curve *through* them,
// which sags slightly between knots; this is what keeps that sag above
// CORRIDOR_HALF_WIDTH rather than merely near it.
const REQUIRED_CLEARANCE = CORRIDOR_HALF_WIDTH + 3;
// The shape relaxation starts from: a single slow N/S swing per loop,
// which is already roughly the weave the staggered continent layout wants
// (see planetTerrain.ts), so the relaxation only has to refine it.
const SEED_AMPLITUDE = (30 * Math.PI) / 180;
const SEED_CYCLES = 1.5;
const RELAX_ITERATIONS = 900;
const RELAX_SMOOTHING = 0.35;
const RELAX_PUSH_STEP = (0.5 * Math.PI) / 180;

const profileLongitude = (i: number): number =>
  (i / PROFILE_SAMPLES) * Math.PI * 2;

/**
 * Routes the trail around every continent as a smooth closed loop, by
 * relaxation: each pass first pulls every sample toward the average of its
 * two neighbours (which is what makes the result smooth, and is periodic
 * because the neighbours wrap), then pushes any sample that's too close to
 * land toward whichever latitude improves its clearance. Repeated, the two
 * forces settle into a curve that flows around the coastlines instead of
 * cutting across them.
 *
 * The previous router searched each longitude *independently* for "the safe
 * latitude nearest a fixed base wiggle". That looked reasonable per point
 * and was badly wrong as a curve: wherever a continent splits the safe
 * latitudes into a northern and a southern branch, consecutive longitudes
 * would pick opposite branches, and the trail teleported tens of degrees
 * between neighbouring samples. On screen that read as a jagged mess that
 * appeared to cross itself, and it also broke pathFrameAt's tangent, which
 * is finite-differenced between two nearby longitudes and so is meaningless
 * across a jump - boards near one faced essentially arbitrary directions.
 * Relaxation can't produce that: the smoothing term is what defines the
 * curve, so continuity isn't something the router has to rediscover at
 * every longitude, and a closed continuous latitude-per-longitude curve
 * can't self-intersect at all.
 */
const relaxPathProfile = (planetRadius: number): number[] => {
  let profile = Array.from(
    { length: PROFILE_SAMPLES },
    (_, i) => Math.sin(SEED_CYCLES * profileLongitude(i)) * SEED_AMPLITUDE,
  );
  const clampLatitude = (lat: number): number =>
    Math.max(-MAX_PATH_LATITUDE, Math.min(MAX_PATH_LATITUDE, lat));

  for (let pass = 0; pass < RELAX_ITERATIONS; pass++) {
    const next = profile.map((lat, i) => {
      const behind = profile[(i - 1 + PROFILE_SAMPLES) % PROFILE_SAMPLES];
      const ahead = profile[(i + 1) % PROFILE_SAMPLES];
      return lat + RELAX_SMOOTHING * ((behind + ahead) / 2 - lat);
    });

    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const lon = profileLongitude(i);
      if (
        surfaceClearanceAt(planetRadius, lon, next[i]) >= REQUIRED_CLEARANCE
      ) {
        continue;
      }
      const north = clampLatitude(next[i] + RELAX_PUSH_STEP);
      const south = clampLatitude(next[i] - RELAX_PUSH_STEP);
      next[i] =
        surfaceClearanceAt(planetRadius, lon, north) >=
        surfaceClearanceAt(planetRadius, lon, south)
          ? north
          : south;
    }
    profile = next;
  }

  return profile;
};

// Relaxation is far too expensive to redo per call (pathFrameAt runs for
// every board, every trail sample and twice per tangent), but CONTINENTS is
// static, so for a given planet radius the answer never changes - compute
// it once, on first use.
const profileCache = new Map<number, number[]>();
const pathProfile = (planetRadius: number): number[] => {
  let profile = profileCache.get(planetRadius);
  if (!profile) {
    profile = relaxPathProfile(planetRadius);
    profileCache.set(planetRadius, profile);
  }
  return profile;
};

/**
 * Latitude of the trail at an arbitrary longitude, Catmull-Rom interpolated
 * through the routed profile's samples. Catmull-Rom (rather than linear)
 * because pathFrameAt finite-differences this to get the direction of
 * travel: linear interpolation would make that tangent piecewise-constant
 * and jump at every sample boundary, which boards inherit as their facing.
 */
const sampleProfile = (profile: number[], lon: number): number => {
  const n = profile.length;
  const turns = lon / (Math.PI * 2);
  const x = (((turns % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const t = x - i;
  const p0 = profile[(i - 1 + n) % n];
  const p1 = profile[i % n];
  const p2 = profile[(i + 1) % n];
  const p3 = profile[(i + 2) % n];
  return (
    p1 +
    0.5 *
      t *
      (p2 -
        p0 +
        t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  );
};

/** Latitude (radians) of the trail at a given longitude - routed clear of every landmass (see relaxPathProfile). */
const pathLatitude = (lon: number, planetRadius: number): number =>
  sampleProfile(pathProfile(planetRadius), lon);

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
  // Routing is done against the planet's own surface radius, not `radius`:
  // `radius` is whichever shell is being sampled (the ship's cruise shell,
  // the trail ring just above the surface), but a continent's outline is
  // defined in the tangent plane at the *surface* (see planetTerrain.ts), so
  // that's the radius its geometry has to be measured against. The routed
  // latitudes are the same for every shell above it.
  const planetRadius = getActivePlanet().radius;
  const position = pointOnSphere(
    radius,
    pathLatitude(lon, planetRadius),
    lon,
    center,
  );
  const normal = surfaceNormal(position, center);
  const ahead = pointOnSphere(
    radius,
    pathLatitude(lon + TANGENT_EPSILON, planetRadius),
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
