import { Quaternion, Vector3 } from "three";
import { boardJsonProps, PositionedBoard } from "../types/boardTypes";
import { Planet, getActivePlanet, getShellRadius } from "../../utils/planets";
import {
  buildSurfaceOrientation,
  eastNorthAt,
  slerpOnSphere,
} from "../../utils/planetSurface";
import { surfaceClearanceOf } from "../planet/planetTerrain";
import boardData from "./boardItems.json";

// How much room the trail centerline itself needs to clear a landmass by, in
// world units: the ship's own half-width (shipParams.json) plus a
// turning/visual-breathing-room buffer.
const SHIP_HALF_WIDTH = 2.5;
const CORRIDOR_SAFETY_MARGIN = 4.5;
export const CORRIDOR_HALF_WIDTH = SHIP_HALF_WIDTH + CORRIDOR_SAFETY_MARGIN;

/**
 * Open water a project's stop needs around it, in world units.
 *
 * The board is 6.7 wide (boardParams.json) and its activation mat 8 by 6, so
 * about 8 units covers the furniture itself; the rest is what stops the
 * billboard rendering *through* a coastline's trees. Stops used to be placed
 * at fixed longitude intervals along the routed trail, which put each one
 * wherever that trail happened to pass - routinely a few units off a coast,
 * with the board buried in the scenery behind it.
 */
export const MIN_BOARD_WATER = 20;
// Consecutive stops have to be a real journey apart, or two boards end up
// almost on top of each other wherever one patch of good water abuts another.
const MIN_SITE_SEPARATION = (32 * Math.PI) / 180;
// Straight run into and out of each stop, world units - long enough that the
// approach reads as deliberately lined up before the turn.
const APPROACH_LEG = 13;
/**
 * How far the board stands behind its own activation mat, world units.
 * ActivationZone places the mat at the board's local [-5, -2.5, 0] (see
 * activationZone.tsx) - 5 units along the board's own facing axis, zero
 * lateral - so offsetting the board this far *forward* along the approach
 * lands the mat exactly on the searched open-water stop, with the board
 * behind it and the ship meeting the mat first.
 */
const MAT_OFFSET = 5;

// One stop per project. Read from the same static list the project context
// parses, so the trail and the board list can't disagree about how many
// stops there are.
const NODE_COUNT = boardData.boardItems.length;

/** Move `from` along the surface by `angle` radians, heading in tangent direction `tangent`. */
const stepAlong = (from: Vector3, tangent: Vector3, angle: number): Vector3 =>
  from
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(tangent, Math.sin(angle))
    .normalize();

/** Unit tangent at `from` pointing along the great circle toward `to`. */
const tangentToward = (from: Vector3, to: Vector3): Vector3 => {
  const tangent = to.clone().addScaledVector(from, -from.dot(to));
  if (tangent.lengthSq() < 1e-12) return eastNorthAt(from).east;
  return tangent.normalize();
};

/**
 * Where the project stops go: the deepest open water on the planet, rather
 * than evenly spaced longitudes. Searching for water is what makes "nothing
 * clips into the scenery" a property of the layout instead of something to
 * keep fixing after the fact.
 *
 * Greedy over the whole globe rather than one stop per longitude sector:
 * sector boundaries are arbitrary, and forcing a stop into each either puts
 * two almost on top of each other where one sector's good water abuts the
 * next's, or fails outright in a sector that happens to be mostly land.
 */
const pickBoardSites = (count: number, planetRadius: number): Vector3[] => {
  const candidates: { direction: Vector3; water: number; lon: number }[] = [];
  const LON_STEPS = 360;
  const LAT_STEPS = 180;

  for (let i = 0; i < LON_STEPS; i++) {
    const lon = (i / LON_STEPS) * Math.PI * 2;
    for (let j = 0; j <= LAT_STEPS; j++) {
      const lat = (j / LAT_STEPS - 0.5) * Math.PI * 0.94;
      const direction = new Vector3(
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.cos(lon),
      );
      const water = surfaceClearanceOf(planetRadius, direction);
      if (water >= MIN_BOARD_WATER) candidates.push({ direction, water, lon });
    }
  }

  candidates.sort((a, b) => b.water - a.water);
  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    const tooClose = chosen.some(
      (other) =>
        other.direction.angleTo(candidate.direction) < MIN_SITE_SEPARATION,
    );
    if (!tooClose) chosen.push(candidate);
  }

  // Ordered by longitude, so flying the trail reads as one circumnavigation
  // rather than criss-crossing the planet.
  chosen.sort((a, b) => a.lon - b.lon);
  return chosen.map((c) => c.direction);
};

export interface PathNode {
  /** Unit direction of the stop itself - where the activation mat sits. */
  direction: Vector3;
  /** Unit tangent: the direction of travel arriving at the stop. */
  approach: Vector3;
  /** Unit tangent perpendicular to `approach`: the direction of travel leaving it. */
  exit: Vector3;
  entryAnchor: Vector3;
  exitAnchor: Vector3;
}

/**
 * Turns the stops into L-shaped waypoints: a straight run in, a right-angle
 * corner at the stop, a straight run out.
 *
 * The approach is the great-circle direction continuing on from the previous
 * stop, so the ship arrives lined up and facing the billboard head-on. The
 * exit is exactly perpendicular to it - whichever of the two perpendiculars
 * points more toward the next stop - so leaving means turning out of the zone
 * rather than carrying straight on through it into whatever lies behind.
 */
const buildNodes = (sites: Vector3[], planetRadius: number): PathNode[] => {
  const legAngle = APPROACH_LEG / planetRadius;

  return sites.map((direction, i) => {
    const previous = sites[(i - 1 + sites.length) % sites.length];
    const next = sites[(i + 1) % sites.length];

    // Travel arrives heading away from the previous stop.
    const approach = tangentToward(direction, previous).negate();
    const left = new Vector3().crossVectors(direction, approach).normalize();
    const right = left.clone().negate();
    const toNext = tangentToward(direction, next);
    const exit = left.dot(toNext) >= right.dot(toNext) ? left : right;

    return {
      direction,
      approach,
      exit,
      entryAnchor: stepAlong(direction, approach.clone().negate(), legAngle),
      exitAnchor: stepAlong(direction, exit, legAngle),
    };
  });
};

// Samples per straight leg and per curved inter-node run.
const LEG_SAMPLES = 8;
const BLEND_SAMPLES = 40;
// Clearance the curved runs are relaxed toward - above CORRIDOR_HALF_WIDTH so
// the result keeps real margin rather than grazing the limit.
const BLEND_TARGET = CORRIDOR_HALF_WIDTH + 3;
const BLEND_PASSES = 400;
const BLEND_SMOOTHING = 0.35;
const BLEND_PUSH_STEP = 1.2;

/**
 * The curved run between two stops: start from the great-circle arc, then
 * relax it clear of land with both endpoints pinned - smoothing toward the
 * neighbours, pushing any sample that's too close to land toward better
 * water. Restricted to this segment precisely so the L-corners either side of
 * it stay exactly square.
 */
const blendRun = (
  from: Vector3,
  to: Vector3,
  planetRadius: number,
): Vector3[] => {
  const points: Vector3[] = [];
  for (let k = 1; k < BLEND_SAMPLES; k++) {
    points.push(slerpOnSphere(from, to, k / BLEND_SAMPLES));
  }

  const pushAngle = BLEND_PUSH_STEP / planetRadius;
  for (let pass = 0; pass < BLEND_PASSES; pass++) {
    for (let i = 0; i < points.length; i++) {
      const behind = i === 0 ? from : points[i - 1];
      const ahead = i === points.length - 1 ? to : points[i + 1];

      const midpoint = behind.clone().add(ahead).normalize();
      let point = points[i]
        .clone()
        .addScaledVector(midpoint, BLEND_SMOOTHING)
        .normalize();

      let bestWater = surfaceClearanceOf(planetRadius, point);
      if (bestWater < BLEND_TARGET) {
        const { east, north } = eastNorthAt(point);
        let best = point;
        for (const tangent of [
          east,
          east.clone().negate(),
          north,
          north.clone().negate(),
        ]) {
          const candidate = stepAlong(point, tangent, pushAngle);
          const water = surfaceClearanceOf(planetRadius, candidate);
          if (water > bestWater) {
            bestWater = water;
            best = candidate;
          }
        }
        point = best;
      }
      points[i] = point;
    }
  }

  return points;
};

interface Trail {
  nodes: PathNode[];
  /** Closed loop of unit directions: straight legs, corners and relaxed curved runs. */
  points: Vector3[];
  /** Index into `points` of each node's own corner. */
  nodeIndices: number[];
}

/**
 * The whole trail, assembled once: for every stop, the straight run in, the
 * corner, the straight run out, then the curved run to the next stop.
 */
const buildTrail = (planetRadius: number): Trail => {
  const sites = pickBoardSites(NODE_COUNT, planetRadius);
  const nodes = buildNodes(sites, planetRadius);
  const points: Vector3[] = [];
  const nodeIndices: number[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNode = nodes[(i + 1) % nodes.length];

    for (let k = 0; k < LEG_SAMPLES; k++) {
      points.push(
        slerpOnSphere(node.entryAnchor, node.direction, k / LEG_SAMPLES),
      );
    }
    nodeIndices.push(points.length);
    points.push(node.direction.clone());
    for (let k = 1; k <= LEG_SAMPLES; k++) {
      points.push(
        slerpOnSphere(node.direction, node.exitAnchor, k / LEG_SAMPLES),
      );
    }
    for (const point of blendRun(
      node.exitAnchor,
      nextNode.entryAnchor,
      planetRadius,
    )) {
      points.push(point);
    }
  }

  return { nodes, points, nodeIndices };
};

// Assembling the trail samples the globe for open water and relaxes one curved
// run per stop - far too expensive to redo per call (pathFrameAt runs for every
// ring sample and every minimap frame), and CONTINENTS is static, so for a
// given planet radius the answer never changes.
const trailCache = new Map<number, Trail>();
const trailFor = (planetRadius: number): Trail => {
  let trail = trailCache.get(planetRadius);
  if (!trail) {
    trail = buildTrail(planetRadius);
    trailCache.set(planetRadius, trail);
  }
  return trail;
};

/** Unit direction of the trail at `t`, a fraction of the way around the loop. */
const trailDirectionAt = (t: number, planetRadius: number): Vector3 => {
  const { points } = trailFor(planetRadius);
  const count = points.length;
  const x = (((t % 1) + 1) % 1) * count;
  const i = Math.floor(x);
  return slerpOnSphere(points[i % count], points[(i + 1) % count], x - i);
};

export interface PathFrame {
  position: Vector3;
  normal: Vector3;
  /** Unit vector tangent to the surface, pointing in the direction of travel. */
  tangent: Vector3;
}

/**
 * Position, surface normal and direction-of-travel tangent at a point along
 * the trail, on the shell at the given radius.
 *
 * `t` is a fraction of the way around the closed loop, **not a longitude**:
 * the trail now turns a right angle at every stop and doubles back on itself,
 * so it is no longer a function of longitude and cannot be sampled by one.
 * Everything that needs to sit "on the trail" - boards, the spawn point, the
 * visual ring, the minimap - goes through this, so they can never drift out of
 * sync with each other.
 */
export const pathFrameAt = (
  radius: number,
  t: number,
  center: Vector3 = new Vector3(),
): PathFrame => {
  // Routing is measured against the planet's own surface radius, not `radius`:
  // `radius` is whichever shell is being sampled (the cruise shell, the ring
  // just above the surface), but a continent's outline is defined in the
  // tangent plane at the surface (see planetTerrain.ts).
  const planetRadius = getActivePlanet().radius;
  const { points } = trailFor(planetRadius);
  const lookahead = 0.5 / points.length;

  const direction = trailDirectionAt(t, planetRadius);
  const ahead = trailDirectionAt(t + lookahead, planetRadius);

  return {
    position: direction.clone().multiplyScalar(radius).add(center),
    normal: direction.clone(),
    tangent: ahead.sub(direction).normalize(),
  };
};

/**
 * Orientation standing upright at `normal` with its local +X along `facing`.
 *
 * PictureFrame bakes in its own -90deg Y rotation (see boardCollision.ts), so
 * the image's face normal is this group's local -X. Pointing +X along the
 * direction the ship arrives from therefore puts the picture face-on to the
 * oncoming ship, and puts the activation mat's own [-5, -2.5, 0] offset
 * directly in front of the board rather than off to one side.
 */
const orientationFacing = (normal: Vector3, facing: Vector3): Quaternion =>
  buildSurfaceOrientation(normal, new Vector3().crossVectors(facing, normal));

/**
 * One board per project, standing in open water at its own stop with its
 * activation mat in front of it, facing the ship's line of approach.
 *
 * The board sits MAT_OFFSET *along* the approach from the stop, so the mat
 * lands exactly on the searched open-water point and the board stands behind
 * it: the ship meets the mat, triggers the project, and turns out of the zone
 * before ever reaching the board itself.
 */
export const calculatedBoardPositionsAndRotations = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): PositionedBoard[] => {
  const shellRadius = getShellRadius(planet);
  const { nodes } = trailFor(planet.radius);
  const matAngle = MAT_OFFSET / planet.radius;

  return items.map((item, i) => {
    const node = nodes[i % nodes.length];
    const anchorDirection = stepAlong(node.direction, node.approach, matAngle);
    const position = anchorDirection
      .clone()
      .multiplyScalar(shellRadius)
      .add(planet.center);
    const orientation = orientationFacing(anchorDirection, node.approach);

    return {
      ...item,
      position: position.toArray() as [number, number, number],
      quaternion: orientation.toArray() as [number, number, number, number],
    };
  });
};

// How far back along the trail from the first stop the ship starts, as a
// fraction of the whole loop - just enough that the player begins on the
// straight approach, already lined up on the first billboard.
const SPAWN_LEAD = 0.035;

/**
 * Where the ship spawns: on the open approach a short way before the first
 * project's stop, so the player starts facing something to fly toward rather
 * than sitting on top of it.
 */
export const spawnTransform = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): { position: Vector3; orientation: Quaternion } => {
  const shellRadius = getShellRadius(planet);
  const { points, nodeIndices } = trailFor(planet.radius);
  const firstStop = items.length > 0 ? nodeIndices[0] / points.length : 0;

  const { position, normal, tangent } = pathFrameAt(
    shellRadius,
    firstStop - SPAWN_LEAD,
    planet.center,
  );
  // The ship's own forward convention is local +Z (see PlanetMotion), unlike a
  // board's local +X, so this builds straight from the tangent as the forward
  // hint - facing along the direction of travel.
  return { position, orientation: buildSurfaceOrientation(normal, tangent) };
};

/** Each project's own stop as a fraction of the way around the loop. */
export const boardTrailParameters = (
  planet: Planet = getActivePlanet(),
): number[] => {
  const { points, nodeIndices } = trailFor(planet.radius);
  return nodeIndices.map((index) => index / points.length);
};

/** The trail's L-shaped waypoints, for anything that needs the approach/exit geometry. */
export const trailNodes = (planet: Planet = getActivePlanet()): PathNode[] =>
  trailFor(planet.radius).nodes;
