import { Quaternion, Vector3 } from "three";
import { boardJsonProps, PositionedBoard } from "../types/boardTypes";
import { Planet, getActivePlanet, getShellRadius } from "../../utils/planets";
import {
  buildSurfaceOrientation,
  eastNorthAt,
  slerpOnSphere,
} from "../../utils/planetSurface";
import {
  surfaceClearanceOf,
  surfaceClearanceWithGradient,
} from "../planet/planetTerrain";
import boardData from "./boardItems.json";

/*
 * The trail and the project stops along it are laid out by one constrained
 * optimisation rather than by fixing the stops first and forcing a path
 * through them:
 *
 *   minimise  bending energy of the trail  +  its length
 *             -  how squarely each billboard faces the oncoming ship
 *   subject to  the trail and every billboard staying in open water,
 *               each billboard facing within THETA_MAX of the trail's approach,
 *               and the stops being spread out along it.
 *
 * It is solved in stages (block-coordinate descent): relax the trail as an
 * elastic band through the ocean channels, then choose where along it the
 * stops go and how each billboard is turned. Fixing the stops first and
 * routing through them - what the previous version did - forces the trail to
 * visit wherever the deepest water happens to be, and the deepest water is
 * mostly in dead-end pockets: reaching them took right-angle turns or
 * hairpins. Letting the trail settle first and placing stops where open
 * water lies *beside* it is what makes the result smooth.
 */

// How much room the trail centerline itself needs to clear a landmass by, in
// world units: the ship's own half-width (shipParams.json) plus a
// turning/visual-breathing-room buffer.
const SHIP_HALF_WIDTH = 2.5;
const CORRIDOR_SAFETY_MARGIN = 4.5;
export const CORRIDOR_HALF_WIDTH = SHIP_HALF_WIDTH + CORRIDOR_SAFETY_MARGIN;

/**
 * Least open water a billboard may stand in, world units from its centre to
 * the nearest coast. The board is 6.7 wide (boardParams.json), so even at
 * this floor its edge stays ~9 units off the coastline - well clear of any
 * tree, which grow inland of it. Most boards get far more (the objective
 * rewards depth); this is the floor that guarantees nothing ever clips.
 *
 * It is a floor rather than a target of 20+ on purpose: with land at a third
 * of the sphere, a *smooth* trail only passes deep water at a handful of
 * places, and demanding 20 units at every one of eight stops forces the trail
 * into dead-end pockets - which is exactly the hairpinning this layout
 * exists to avoid.
 */
export const MIN_BOARD_WATER = 12;
/** How far each billboard stands back from its activation mat, world units. */
export const BOARD_SETBACK = 16;
/** Least distance from the trail's centreline to any billboard's panel. */
export const BOARD_CLEARANCE = 4;
/**
 * Largest angle a billboard may be turned away from the trail's approach.
 * The board stands BOARD_SETBACK along its own facing axis from the mat; were
 * that axis exactly along the trail, a trail that carries on smoothly would
 * fly straight through the board. Turning the board a little off the line of
 * travel is what lets the trail pass it without a sharp turn - and keeping
 * the turn within this bound is what keeps it readable as facing the ship.
 */
export const THETA_MAX = (45 * Math.PI) / 180;
// Along-trail spacing between consecutive stops, world units.
const MIN_STOP_SPACING = 24;
const MAX_STOP_SPACING = 55;
// The mat sits just proud of the ocean shell, where it always has.
const MAT_LIFT = 0.3;

// One stop per project. Read from the same static list the project context
// parses, so the trail and the board list can't disagree about how many
// stops there are.
const NODE_COUNT = boardData.boardItems.length;

const BOARD_HALF_WIDTH = 3.35;

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

/** Rotate tangent `t` about surface normal `n` by `angle`. */
const turnAbout = (t: Vector3, n: Vector3, angle: number): Vector3 =>
  t
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(new Vector3().crossVectors(n, t), Math.sin(angle))
    .normalize();

/** Resample a closed polyline of unit directions to `count` equal-arc samples. */
const resampleClosed = (points: Vector3[], count: number): Vector3[] => {
  const n = points.length;
  const cumulative = [0];
  for (let k = 1; k <= n; k++) {
    cumulative.push(cumulative[k - 1] + points[k - 1].angleTo(points[k % n]));
  }
  const total = cumulative[n];
  const out: Vector3[] = [];
  let j = 0;
  for (let s = 0; s < count; s++) {
    const target = (s / count) * total;
    while (j < n - 1 && cumulative[j + 1] < target) j++;
    const span = cumulative[j + 1] - cumulative[j];
    out.push(
      slerpOnSphere(
        points[j],
        points[(j + 1) % n],
        span > 1e-12 ? (target - cumulative[j]) / span : 0,
      ),
    );
  }
  return out;
};

const loopLength = (points: Vector3[], radius: number): number => {
  let length = 0;
  for (let k = 0; k < points.length; k++) {
    length += points[k].angleTo(points[(k + 1) % points.length]) * radius;
  }
  return length;
};

/** Unit tangent of a closed polyline at sample `k`, by central difference. */
const tangentOf = (points: Vector3[], k: number): Vector3 => {
  const n = points.length;
  const difference = points[(k + 1) % n].clone().sub(points[(k - 1 + n) % n]);
  return difference
    .addScaledVector(points[k], -difference.dot(points[k]))
    .normalize();
};

// --- Warm start -------------------------------------------------------------
//
// The elastic band needs a starting loop that already wraps the planet once
// and stays off land; the previous layout's right-angled trail through the
// deepest open water is exactly that, so it's kept as the seed.

const SEED_SITE_WATER = 20;
const SEED_SITE_SEPARATION = (32 * Math.PI) / 180;
const SEED_LEG = 13;

const pickSeedSites = (count: number, planetRadius: number): Vector3[] => {
  const candidates: { direction: Vector3; water: number; lon: number }[] = [];
  for (let i = 0; i < 360; i++) {
    const lon = (i / 360) * Math.PI * 2;
    for (let j = 0; j <= 180; j++) {
      const lat = (j / 180 - 0.5) * Math.PI * 0.94;
      const direction = new Vector3(
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.cos(lon),
      );
      const water = surfaceClearanceOf(planetRadius, direction);
      if (water >= SEED_SITE_WATER) candidates.push({ direction, water, lon });
    }
  }
  candidates.sort((a, b) => b.water - a.water);
  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (
      chosen.some(
        (other) =>
          other.direction.angleTo(candidate.direction) < SEED_SITE_SEPARATION,
      )
    ) {
      continue;
    }
    chosen.push(candidate);
  }
  chosen.sort((a, b) => a.lon - b.lon);
  return chosen.map((c) => c.direction);
};

/** A great-circle run between two points, pushed clear of land with its ends pinned. */
const seedRun = (
  from: Vector3,
  to: Vector3,
  planetRadius: number,
): Vector3[] => {
  const points: Vector3[] = [];
  for (let k = 1; k < 40; k++) points.push(slerpOnSphere(from, to, k / 40));
  const push = 1.2 / planetRadius;
  for (let pass = 0; pass < 400; pass++) {
    for (let i = 0; i < points.length; i++) {
      const behind = i === 0 ? from : points[i - 1];
      const ahead = i === points.length - 1 ? to : points[i + 1];
      let point = points[i]
        .clone()
        .addScaledVector(behind.clone().add(ahead).normalize(), 0.35)
        .normalize();
      let water = surfaceClearanceOf(planetRadius, point);
      if (water < 10) {
        const { east, north } = eastNorthAt(point);
        let best = point;
        for (const t of [
          east,
          east.clone().negate(),
          north,
          north.clone().negate(),
        ]) {
          const candidate = stepAlong(point, t, push);
          const candidateWater = surfaceClearanceOf(planetRadius, candidate);
          if (candidateWater > water) {
            water = candidateWater;
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

const seedLoop = (planetRadius: number): Vector3[] => {
  const sites = pickSeedSites(NODE_COUNT, planetRadius);
  const n = sites.length;
  const legAngle = SEED_LEG / planetRadius;
  const legs = sites.map((site, i) => {
    const previous = sites[(i - 1 + n) % n];
    const next = sites[(i + 1) % n];
    const approach = tangentToward(site, previous).negate();
    const left = new Vector3().crossVectors(site, approach).normalize();
    const exit =
      left.dot(tangentToward(site, next)) >= 0 ? left : left.clone().negate();
    return {
      site,
      entry: stepAlong(site, approach.clone().negate(), legAngle),
      exit: stepAlong(site, exit, legAngle),
    };
  });

  const points: Vector3[] = [];
  legs.forEach((leg, i) => {
    for (let k = 0; k < 8; k++)
      points.push(slerpOnSphere(leg.entry, leg.site, k / 8));
    points.push(leg.site.clone());
    for (let k = 1; k <= 8; k++)
      points.push(slerpOnSphere(leg.site, leg.exit, k / 8));
    points.push(...seedRun(leg.exit, legs[(i + 1) % n].entry, planetRadius));
  });
  return points;
};

// --- Stage 1: the trail as an elastic band ---------------------------------

// Bending (bi-Laplacian) is the curvature term; tension (Laplacian) the length
// term. Both are explicit steps, stable well below their 1/8 and 1/2 limits.
const BEND = 0.35;
const SETTLE_TENSION = 0.01;
// Strong tension early on retracts any free spur the seed has (a stretch that
// runs out and back without wrapping anything, which bending alone barely
// moves); it's then dropped so the band settles by curvature, not length.
const RETRACT_TENSION = 0.25;
// Capped 1/clearance^2 barrier, active inside BARRIER_REACH of any coast.
const BARRIER_REACH = 13;
const BARRIER_STRENGTH = 60;
const BARRIER_MAX_STEP = 0.6;
// Hard floor the band is projected back above after every step.
const HARD_CLEARANCE = 9;

const relaxPass = (
  band: Vector3[],
  planetRadius: number,
  tension: number,
  withBarrier: boolean,
  floor: number,
): void => {
  const n = band.length;
  const laplacian = band.map((p, k) =>
    band[(k - 1 + n) % n]
      .clone()
      .add(band[(k + 1) % n])
      .multiplyScalar(0.5)
      .sub(p),
  );
  const biLaplacian = laplacian.map((l, k) =>
    laplacian[(k - 1 + n) % n]
      .clone()
      .add(laplacian[(k + 1) % n])
      .multiplyScalar(0.5)
      .sub(l),
  );

  const next = band.map((p, k) => {
    const delta = laplacian[k]
      .clone()
      .multiplyScalar(tension)
      .addScaledVector(biLaplacian[k], -BEND);
    if (withBarrier) {
      const { clearance, gradient } = surfaceClearanceWithGradient(
        planetRadius,
        p,
      );
      if (clearance < BARRIER_REACH) {
        const push = Math.min(
          BARRIER_MAX_STEP,
          BARRIER_STRENGTH *
            (1 / Math.max(clearance, 0.5) ** 2 - 1 / BARRIER_REACH ** 2),
        );
        delta.addScaledVector(gradient.normalize(), push / planetRadius);
      }
    }
    delta.addScaledVector(p, -delta.dot(p));
    const q = p.clone().add(delta).normalize();

    for (let guard = 0; guard < 30; guard++) {
      const here = surfaceClearanceWithGradient(planetRadius, q);
      if (here.clearance >= floor) break;
      q.copy(stepAlong(q, here.gradient.normalize(), 0.3 / planetRadius));
    }
    return q;
  });
  for (let k = 0; k < n; k++) band[k] = next[k];
};

/**
 * Smooth closed upsampling: a Catmull-Rom curve through the coarse samples,
 * rather than straight great-circle runs between them - which would carry the
 * coarse polygon's corners straight into the fine band.
 */
const upsampleSmooth = (points: Vector3[], count: number): Vector3[] => {
  const n = points.length;
  return Array.from({ length: count }, (_, s) => {
    const x = (s / count) * n;
    const i = Math.floor(x);
    const t = x - i;
    const t2 = t * t;
    const t3 = t2 * t;
    return points[(i - 1 + n) % n]
      .clone()
      .multiplyScalar(-0.5 * t3 + t2 - 0.5 * t)
      .addScaledVector(points[i % n], 1.5 * t3 - 2.5 * t2 + 1)
      .addScaledVector(points[(i + 1) % n], -1.5 * t3 + 2 * t2 + 0.5 * t)
      .addScaledVector(points[(i + 2) % n], 0.5 * t3 - 0.5 * t2)
      .normalize();
  });
};

// Multigrid: a coarse band settles the long wavelengths - and does all the
// work of routing around land - in few passes; a fine one then only has to
// fair the curve, which makes the whole solve several times cheaper.
const COARSE_SAMPLES = 72;
const COARSE_PASSES = 500;
const TRAIL_SAMPLES = 360;
const FINE_PASSES = 150;
// The fine stage is pure bending, with only a safety floor under it. The land
// barrier is tuned for the coarse band's ~3.5 unit spacing; applied at the
// fine band's ~0.7, its per-sample pushes drove a sample-to-sample zig-zag
// along stretches pressed against a coast (vertex turns of 30+ degrees on an
// otherwise smooth curve). The coarse stage has already put the trail where
// it belongs, so fairing it doesn't need the barrier at all.
const FINE_FLOOR = CORRIDOR_HALF_WIDTH + 1;

const relaxTrail = (seed: Vector3[], planetRadius: number): Vector3[] => {
  let band = resampleClosed(seed, COARSE_SAMPLES);
  for (let pass = 0; pass < COARSE_PASSES; pass++) {
    const tension =
      pass < COARSE_PASSES * 0.8 ? RETRACT_TENSION : SETTLE_TENSION;
    relaxPass(band, planetRadius, tension, true, HARD_CLEARANCE);
    if (pass % 10 === 0) band = resampleClosed(band, COARSE_SAMPLES);
  }
  band = upsampleSmooth(resampleClosed(band, COARSE_SAMPLES), TRAIL_SAMPLES);
  for (let pass = 0; pass < FINE_PASSES; pass++) {
    relaxPass(band, planetRadius, 0, false, FINE_FLOOR);
    if (pass % 10 === 0) band = resampleClosed(band, TRAIL_SAMPLES);
  }
  return resampleClosed(band, TRAIL_SAMPLES);
};

// --- Stage 2: stops and billboards -----------------------------------------

interface BoardPlacement {
  index: number;
  facingOffset: number;
  axis: Vector3;
  direction: Vector3;
  water: number;
  score: number;
}

const placeBoard = (
  trail: Vector3[],
  worldTrail: Float64Array,
  index: number,
  facingOffset: number,
  planetRadius: number,
): BoardPlacement | null => {
  const stop = trail[index];
  const axis = turnAbout(tangentOf(trail, index), stop, facingOffset);
  const direction = stepAlong(stop, axis, BOARD_SETBACK / planetRadius);

  // The panel, in world units: BOARD_HALF_WIDTH either side of the board's
  // centre, across its own facing axis.
  const boardAxis = axis
    .clone()
    .addScaledVector(direction, -axis.dot(direction))
    .normalize();
  const across = new Vector3().crossVectors(direction, boardAxis).normalize();
  const centre = direction.clone().multiplyScalar(planetRadius);
  const ax = centre.x + across.x * BOARD_HALF_WIDTH;
  const ay = centre.y + across.y * BOARD_HALF_WIDTH;
  const az = centre.z + across.z * BOARD_HALF_WIDTH;
  const ex = centre.x - across.x * BOARD_HALF_WIDTH - ax;
  const ey = centre.y - across.y * BOARD_HALF_WIDTH - ay;
  const ez = centre.z - across.z * BOARD_HALF_WIDTH - az;
  const lengthSq = ex * ex + ey * ey + ez * ez;

  // Nowhere along the trail may come within BOARD_CLEARANCE of the panel.
  for (let k = 0; k < worldTrail.length; k += 3) {
    const px = worldTrail[k] - ax;
    const py = worldTrail[k + 1] - ay;
    const pz = worldTrail[k + 2] - az;
    const t = Math.max(
      0,
      Math.min(1, (px * ex + py * ey + pz * ez) / lengthSq),
    );
    const dx = px - ex * t;
    const dy = py - ey * t;
    const dz = pz - ez * t;
    if (dx * dx + dy * dy + dz * dz < BOARD_CLEARANCE * BOARD_CLEARANCE) {
      return null;
    }
  }

  const water = surfaceClearanceOf(planetRadius, direction);
  if (water < MIN_BOARD_WATER) return null;
  return {
    index,
    facingOffset,
    axis,
    direction,
    water,
    // Depth (capped - past ~24 units more water doesn't look any different)
    // plus how squarely the board faces the oncoming ship.
    score: Math.min(water, 24) + 10 * Math.cos(facingOffset),
  };
};

const bestPlacementAt = (
  trail: Vector3[],
  worldTrail: Float64Array,
  index: number,
  planetRadius: number,
  stepDegrees: number,
): BoardPlacement | null => {
  let best: BoardPlacement | null = null;
  const limit = Math.round((THETA_MAX * 180) / Math.PI);
  for (let degrees = 0; degrees <= limit; degrees += stepDegrees) {
    for (const sign of degrees === 0 ? [1] : [1, -1]) {
      const placement = placeBoard(
        trail,
        worldTrail,
        index,
        (sign * degrees * Math.PI) / 180,
        planetRadius,
      );
      if (placement && (!best || placement.score > best.score))
        best = placement;
    }
  }
  return best;
};

/**
 * Choose exactly NODE_COUNT stops around the loop, with consecutive spacing
 * kept between MIN_STOP_SPACING and MAX_STOP_SPACING, maximising the total
 * placement score. Greedy picking can't promise that - it happily leaves a
 * long empty stretch with every stop crowded into the good water at one end -
 * so this is a cyclic dynamic programme over trail samples.
 */
const chooseStops = (
  candidates: (BoardPlacement | null)[],
  sampleSpacing: number,
): number[] | null => {
  const n = candidates.length;
  const minGap = Math.round(MIN_STOP_SPACING / sampleSpacing);
  const maxGap = Math.round(MAX_STOP_SPACING / sampleSpacing);
  let bestScore = -Infinity;
  let bestPlan: number[] | null = null;

  for (let first = 0; first < Math.min(n, maxGap); first++) {
    if (!candidates[first]) continue;
    const score = Array.from({ length: NODE_COUNT }, () =>
      new Float64Array(n).fill(-Infinity),
    );
    const previous = Array.from({ length: NODE_COUNT }, () =>
      new Int32Array(n).fill(-1),
    );
    score[0][first] = candidates[first]!.score;

    for (let stop = 1; stop < NODE_COUNT; stop++) {
      for (let k = 0; k < n; k++) {
        const here = candidates[k];
        if (!here) continue;
        for (let gap = minGap; gap <= maxGap; gap++) {
          const from = (k - gap + n) % n;
          const total = score[stop - 1][from] + here.score;
          if (total > score[stop][k]) {
            score[stop][k] = total;
            previous[stop][k] = from;
          }
        }
      }
    }

    for (let last = 0; last < n; last++) {
      const total = score[NODE_COUNT - 1][last];
      if (total === -Infinity || total <= bestScore) continue;
      const closing = (first - last + n) % n;
      if (closing < minGap || closing > maxGap) continue;
      const plan = [last];
      for (let stop = NODE_COUNT - 1; stop > 0; stop--) {
        plan.unshift(previous[stop][plan[0]]);
      }
      bestScore = total;
      bestPlan = plan;
    }
  }
  return bestPlan;
};

export interface PathNode {
  /** Unit direction of the stop itself - where the activation mat sits, on the trail. */
  direction: Vector3;
  /** Unit tangent: the trail's direction of travel through the stop. */
  approach: Vector3;
  /** Unit tangent at the stop: the billboard's facing axis, from mat toward board. */
  boardAxis: Vector3;
  /** Unit direction of the billboard itself. */
  boardDirection: Vector3;
  /** Signed angle from `approach` to `boardAxis`, radians; |value| <= THETA_MAX. */
  facingOffset: number;
}

interface Trail {
  /** Closed loop of unit directions. */
  points: Vector3[];
  /** Index into `points` of each stop, in travel order. */
  stops: number[];
  nodes: PathNode[];
}

const buildTrail = (planetRadius: number): Trail => {
  const points = relaxTrail(seedLoop(planetRadius), planetRadius);
  const worldTrail = new Float64Array(points.length * 3);
  points.forEach((p, k) => {
    worldTrail[k * 3] = p.x * planetRadius;
    worldTrail[k * 3 + 1] = p.y * planetRadius;
    worldTrail[k * 3 + 2] = p.z * planetRadius;
  });

  const candidates = points.map((_, k) =>
    bestPlacementAt(points, worldTrail, k, planetRadius, 3),
  );
  const spacing = loopLength(points, planetRadius) / points.length;
  const stops =
    chooseStops(candidates, spacing) ??
    // Never expected with the shipped layout (the tests pin that it isn't
    // needed) - but a future CONTINENTS edit that leaves too little water
    // should degrade to evenly spaced stops, not take the whole scene down.
    Array.from({ length: NODE_COUNT }, (_, i) =>
      Math.round((i * points.length) / NODE_COUNT),
    );

  const nodes = stops.map((index) => {
    // Re-solve the chosen stops' boards at 1 degree rather than 3.
    const placement =
      bestPlacementAt(points, worldTrail, index, planetRadius, 1) ??
      candidates[index];
    const approach = tangentOf(points, index);
    const axis = placement?.axis ?? approach;
    return {
      direction: points[index].clone(),
      approach,
      boardAxis: axis,
      boardDirection:
        placement?.direction ??
        stepAlong(points[index], axis, BOARD_SETBACK / planetRadius),
      facingOffset: placement?.facingOffset ?? 0,
    };
  });

  return { points, stops, nodes };
};

// Building the trail relaxes an elastic band and searches every trail sample
// for a billboard placement - far too expensive to redo per call (pathFrameAt
// runs for every ring sample and every minimap frame). CONTINENTS is static,
// so for a given planet radius the answer never changes: compute it once.
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
 * `t` is a fraction of the way around the closed loop, not a longitude: the
 * trail is a free curve on the sphere, not a function of longitude.
 * Everything that needs to sit "on the trail" - the mats, the spawn point,
 * the visual ring, the minimap - goes through this, so they can never drift
 * out of sync with each other.
 */
export const pathFrameAt = (
  radius: number,
  t: number,
  center: Vector3 = new Vector3(),
): PathFrame => {
  // Routing is measured against the planet's own surface radius, not `radius`:
  // `radius` is whichever shell is being sampled, but a continent's outline is
  // defined in the tangent plane at the surface (see planetTerrain.ts).
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
 * the picture's face normal is the group's local -X: pointing +X along the
 * board's axis - from its mat toward the board - turns the picture back
 * toward the mat and the ship crossing it. A mat built the same way has its
 * local +X along the trail.
 */
const orientationFacing = (normal: Vector3, facing: Vector3): Quaternion =>
  buildSurfaceOrientation(normal, new Vector3().crossVectors(facing, normal));

/**
 * One billboard per project, standing in open water beside the trail and
 * turned back toward the ship's approach, with its activation mat on the
 * trail in front of it. The ship crosses the mat - triggering the project -
 * and carries on past the billboard on a gentle curve, never into it.
 */
export const calculatedBoardPositionsAndRotations = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): PositionedBoard[] => {
  const shellRadius = getShellRadius(planet);
  const { nodes } = trailFor(planet.radius);

  return items.map((item, i) => {
    const node = nodes[i % nodes.length];
    const boardAxis = node.boardAxis
      .clone()
      .addScaledVector(
        node.boardDirection,
        -node.boardAxis.dot(node.boardDirection),
      )
      .normalize();
    const position = node.boardDirection
      .clone()
      .multiplyScalar(shellRadius)
      .add(planet.center);
    const matPosition = node.direction
      .clone()
      .multiplyScalar(planet.radius + MAT_LIFT)
      .add(planet.center);

    return {
      ...item,
      position: position.toArray() as [number, number, number],
      quaternion: orientationFacing(
        node.boardDirection,
        boardAxis,
      ).toArray() as [number, number, number, number],
      matPosition: matPosition.toArray() as [number, number, number],
      matQuaternion: orientationFacing(
        node.direction,
        node.approach,
      ).toArray() as [number, number, number, number],
    };
  });
};

// How far back along the trail from the first stop the ship starts, as a
// fraction of the whole loop - just enough that the player begins on the
// approach, already lined up on the first billboard.
const SPAWN_LEAD = 0.035;

/**
 * Where the ship spawns: on the trail a short way before the first project's
 * mat, so the player starts facing something to fly toward rather than
 * sitting on top of it.
 */
export const spawnTransform = (
  items: boardJsonProps[],
  planet: Planet = getActivePlanet(),
): { position: Vector3; orientation: Quaternion } => {
  const shellRadius = getShellRadius(planet);
  const { points, stops } = trailFor(planet.radius);
  const firstStop = items.length > 0 ? stops[0] / points.length : 0;

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

/** Each project's stop as a fraction of the way around the loop. */
export const boardTrailParameters = (
  planet: Planet = getActivePlanet(),
): number[] => {
  const { points, stops } = trailFor(planet.radius);
  return stops.map((index) => index / points.length);
};

/** The stops' geometry, for anything that needs the approach/board relationship. */
export const trailNodes = (planet: Planet = getActivePlanet()): PathNode[] =>
  trailFor(planet.radius).nodes;
