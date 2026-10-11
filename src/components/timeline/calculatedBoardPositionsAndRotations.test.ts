import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  BOARD_CLEARANCE,
  BOARD_SETBACK,
  CORRIDOR_HALF_WIDTH,
  MIN_BOARD_WATER,
  THETA_MAX,
  boardTrailParameters,
  calculatedBoardPositionsAndRotations,
  pathFrameAt,
  spawnTransform,
  trailNodes,
} from "./calculatedBoardPositionsAndRotations";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { surfaceNormal } from "../../utils/planetSurface";
import { boardJsonProps } from "../types/boardTypes";
import { Planet } from "../../utils/planets";
import { surfaceClearanceOf } from "../planet/planetTerrain";

const testPlanet: Planet = {
  id: "test",
  center: new Vector3(0, 0, 0),
  radius: 40,
  shipAltitude: 2.5,
};
const shellRadius = testPlanet.radius + testPlanet.shipAltitude;

const items: boardJsonProps[] = Array.from({ length: 8 }, (_, i) => ({
  id: `board-${i}`,
}));

/** Dense samples of the trail on the cruise shell. */
const trailSamples = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    pathFrameAt(shellRadius, i / count, testPlanet.center),
  );

const trailLength = (() => {
  const samples = trailSamples(2880).map((frame) => frame.position);
  let length = 0;
  for (let i = 0; i < samples.length; i++) {
    length += samples[i].distanceTo(samples[(i + 1) % samples.length]);
  }
  return length;
})();

/** Distance from point P to segment AE. */
const segmentDistance = (P: Vector3, A: Vector3, E: Vector3): number => {
  const AE = E.clone().sub(A);
  const t = Math.max(0, Math.min(1, P.clone().sub(A).dot(AE) / AE.lengthSq()));
  return P.distanceTo(A.clone().addScaledVector(AE, t));
};

describe("spawnTransform", () => {
  test("spawns on the approach to the first stop, facing it, not on top of it", () => {
    const { position, orientation } = spawnTransform(items, testPlanet);
    const [firstBoard] = calculatedBoardPositionsAndRotations(
      items,
      testPlanet,
    );
    const mat = getBoardMatWorldPosition(firstBoard);

    expect(position.distanceTo(mat)).toBeGreaterThan(5);
    // The first stop lies ahead of where the ship faces, not behind it.
    const forward = new Vector3(0, 0, 1).applyQuaternion(orientation);
    expect(forward.dot(mat.clone().sub(position).normalize())).toBeGreaterThan(
      0,
    );
  });

  test("stays on the planet's shell", () => {
    const { position } = spawnTransform(items, testPlanet);
    expect(position.distanceTo(testPlanet.center)).toBeCloseTo(shellRadius, 5);
  });

  test("falls back to a sane point when there are no boards", () => {
    const { position, orientation } = spawnTransform([], testPlanet);
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(orientation.x)).toBe(true);
    expect(position.distanceTo(testPlanet.center)).toBeCloseTo(shellRadius, 5);
  });
});

describe("board placement", () => {
  const boards = calculatedBoardPositionsAndRotations(items, testPlanet);

  // The bug this exists to prevent: boards used to land wherever the trail
  // happened to pass, routinely a few units off a coastline, with the
  // billboard rendering straight through the trees behind it.
  test("every billboard stands in open water", () => {
    expect(boards.length).toBe(items.length);
    for (const board of boards) {
      const water = surfaceClearanceOf(
        testPlanet.radius,
        surfaceNormal(new Vector3(...board.position), testPlanet.center),
      );
      expect(water).toBeGreaterThanOrEqual(MIN_BOARD_WATER - 0.01);
    }
  });

  test("every billboard stands on the cruise shell, upright", () => {
    for (const board of boards) {
      const position = new Vector3(...board.position);
      expect(position.distanceTo(testPlanet.center)).toBeCloseTo(
        shellRadius,
        5,
      );
      const up = new Vector3(0, 1, 0).applyQuaternion(
        new Quaternion(...board.quaternion),
      );
      expect(
        up.distanceTo(surfaceNormal(position, testPlanet.center)),
      ).toBeLessThan(1e-5);
    }
  });

  // The mat is on the trail, so the ship crosses it on the approach; the
  // billboard stands BOARD_SETBACK behind it along its own facing axis.
  test("each mat lies on the planet's surface, on the trail", () => {
    const trail = trailSamples(2880).map((frame) =>
      frame.position.clone().setLength(testPlanet.radius),
    );
    for (const board of boards) {
      const mat = getBoardMatWorldPosition(board);
      expect(mat.length()).toBeCloseTo(testPlanet.radius + 0.3, 5);
      const onSurface = mat.clone().setLength(testPlanet.radius);
      const nearest = Math.min(...trail.map((p) => p.distanceTo(onSurface)));
      expect(nearest).toBeLessThan(0.5);
    }
  });

  test("each billboard faces back toward its own mat, standing behind it", () => {
    for (const board of boards) {
      const position = new Vector3(...board.position);
      const mat = getBoardMatWorldPosition(board).setLength(shellRadius);
      // Local +X is the facing axis (PictureFrame's baked -90deg Y rotation
      // puts the picture normal on local -X): it points from mat to board,
      // so the picture faces the mat and the ship crossing it.
      const facing = new Vector3(1, 0, 0).applyQuaternion(
        new Quaternion(...board.quaternion),
      );
      const fromMat = position.clone().sub(mat).normalize();
      expect(facing.dot(fromMat)).toBeGreaterThan(0.98);
      expect(position.distanceTo(mat)).toBeGreaterThan(BOARD_SETBACK * 0.95);
    }
  });

  // The ship carries on past each billboard rather than into it: the board is
  // turned a little off the line of travel and the trail curves gently by.
  test("the trail never runs into a billboard", () => {
    const trail = trailSamples(2880).map((frame) => frame.position);
    for (const board of boards) {
      const centre = new Vector3(...board.position);
      const across = new Vector3(0, 0, 1).applyQuaternion(
        new Quaternion(...board.quaternion),
      );
      const A = centre.clone().addScaledVector(across, 3.35);
      const E = centre.clone().addScaledVector(across, -3.35);
      const closest = Math.min(...trail.map((p) => segmentDistance(p, A, E)));
      expect(closest).toBeGreaterThanOrEqual(BOARD_CLEARANCE);
    }
  });
});

describe("trail stops", () => {
  const nodes = trailNodes(testPlanet);

  // The approach-angle constraint: a billboard may be turned at most THETA_MAX
  // off the trail's direction of travel, so it still reads as facing the
  // oncoming ship - instead of the old right-angle turn out of every stop.
  test("every billboard faces within THETA_MAX of the trail's approach", () => {
    for (const node of nodes) {
      expect(Math.abs(node.facingOffset)).toBeLessThanOrEqual(THETA_MAX + 1e-9);
      const angle = node.approach.angleTo(node.boardAxis);
      expect(angle).toBeCloseTo(Math.abs(node.facingOffset), 5);
      // Both axes lie in the tangent plane at the stop.
      expect(Math.abs(node.approach.dot(node.direction))).toBeLessThan(1e-6);
      expect(Math.abs(node.boardAxis.dot(node.direction))).toBeLessThan(1e-6);
    }
  });

  test("stops are spread around the planet, not bunched together", () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const separation =
          (nodes[i].direction.angleTo(nodes[j].direction) * 180) / Math.PI;
        expect(separation).toBeGreaterThan(30);
      }
    }
  });

  // The spacing constraint, measured along the trail itself.
  test("consecutive stops are evenly paced along the trail", () => {
    const params = boardTrailParameters(testPlanet);
    for (let i = 0; i < params.length; i++) {
      const gap =
        ((params[(i + 1) % params.length] - params[i] + 1) % 1) * trailLength;
      expect(gap).toBeGreaterThan(20);
      expect(gap).toBeLessThan(65);
    }
  });
});

describe("pathFrameAt", () => {
  // Regression test, and the one that matters most: it samples the loop
  // densely - the curve the ship actually flies - and measures clearance in
  // great-circle angles. An earlier version compared a chord distance against
  // a tangent-plane radius, repeated the router's own bug, and passed while
  // the trail ran 16 world units inside the snow continent.
  test("never runs through a landmass - clears every coastline by the required corridor", () => {
    let worstClearance = Infinity;
    let worstAt = 0;
    trailSamples(2880).forEach((frame, i) => {
      const clearance = surfaceClearanceOf(
        testPlanet.radius,
        surfaceNormal(frame.position, testPlanet.center),
      );
      if (clearance < worstClearance) {
        worstClearance = clearance;
        worstAt = i / 2880;
      }
    });
    expect(
      worstClearance,
      `worst clearance ${worstClearance.toFixed(2)}u at t=${worstAt.toFixed(3)}`,
    ).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
  });

  test("is continuous - no teleporting between neighbouring samples", () => {
    const samples = trailSamples(1440).map((frame) => frame.position);
    let longestStep = 0;
    for (let i = 0; i < samples.length; i++) {
      longestStep = Math.max(
        longestStep,
        samples[i].distanceTo(samples[(i + 1) % samples.length]),
      );
    }
    expect(longestStep).toBeLessThan(3);
  });

  // The point of the optimisation: no kinks. The previous layout turned a
  // right angle at every stop; here the trail's heading may only drift a few
  // degrees per unit travelled, and never folds back on itself.
  test("is smooth - no sharp kinks and no hairpins", () => {
    const frames = trailSamples(1440);
    const stepLength = trailLength / frames.length;
    let sharpestDegreesPerUnit = 0;
    for (let i = 0; i < frames.length; i++) {
      const turn =
        (frames[i].tangent.angleTo(frames[(i + 1) % frames.length].tangent) *
          180) /
        Math.PI;
      sharpestDegreesPerUnit = Math.max(
        sharpestDegreesPerUnit,
        turn / stepLength,
      );
    }
    expect(sharpestDegreesPerUnit).toBeLessThan(12);

    // A hairpin turns ~180 degrees within a short stretch; nothing here
    // turns more than 120 over any 30 units of trail.
    const window = Math.round(15 / stepLength);
    for (let i = 0; i < frames.length; i++) {
      const before =
        frames[(i - window + frames.length) % frames.length].tangent;
      const after = frames[(i + window) % frames.length].tangent;
      expect((before.angleTo(after) * 180) / Math.PI).toBeLessThan(120);
    }
  });

  test("closes seamlessly where the loop wraps", () => {
    const before = pathFrameAt(shellRadius, 1 - 1e-4, testPlanet.center);
    const after = pathFrameAt(shellRadius, 1e-4, testPlanet.center);
    expect(before.position.distanceTo(after.position)).toBeLessThan(0.2);
    expect(before.tangent.dot(after.tangent)).toBeGreaterThan(0.99);
  });
});
