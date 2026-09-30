import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  CORRIDOR_HALF_WIDTH,
  MIN_BOARD_WATER,
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

const items: boardJsonProps[] = Array.from({ length: 8 }, (_, i) => ({
  id: `board-${i}`,
}));

describe("spawnTransform", () => {
  test("spawns on the shell, ahead of (not on top of) the first board's activation zone", () => {
    const { position } = spawnTransform(items, testPlanet);
    const [firstBoard] = calculatedBoardPositionsAndRotations(
      items,
      testPlanet,
    );
    const zoneWorldPosition = getBoardMatWorldPosition(
      firstBoard.position,
      firstBoard.quaternion,
    );

    const spawnNormal = surfaceNormal(position, testPlanet.center);
    const zoneNormal = surfaceNormal(zoneWorldPosition, testPlanet.center);
    const spawnLon = Math.atan2(spawnNormal.x, spawnNormal.z);
    const zoneLon = Math.atan2(zoneNormal.x, zoneNormal.z);

    // Spawn sits at a strictly lower longitude than the zone (i.e. before
    // it, given the ship travels toward increasing longitude), not
    // coincident with or past it.
    expect(spawnLon).toBeLessThan(zoneLon);
    expect(zoneLon - spawnLon).toBeGreaterThan(0.05);

    // And it's a safe distance away - not touching the zone or its board.
    expect(position.distanceTo(zoneWorldPosition)).toBeGreaterThan(5);
  });

  test("stays on the planet's shell", () => {
    const { position } = spawnTransform(items, testPlanet);
    expect(position.distanceTo(testPlanet.center)).toBeCloseTo(
      testPlanet.radius + testPlanet.shipAltitude,
      5,
    );
  });

  test("falls back to a sane point when there are no boards", () => {
    const { position, orientation } = spawnTransform([], testPlanet);
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(orientation.x)).toBe(true);
    expect(position.distanceTo(testPlanet.center)).toBeCloseTo(
      testPlanet.radius + testPlanet.shipAltitude,
      5,
    );
  });
});

describe("board placement", () => {
  // The bug this exists to prevent: stops used to be spaced by longitude
  // along the routed trail, so each landed wherever that trail happened to
  // pass - routinely a few units off a coastline, with the billboard
  // rendering straight through the trees behind it. Stops are searched for
  // open water now, and this is what keeps them there.
  test("every board's activation mat sits in genuinely open water", () => {
    const boards = calculatedBoardPositionsAndRotations(items, testPlanet);
    expect(boards.length).toBe(items.length);

    for (const board of boards) {
      const mat = getBoardMatWorldPosition(board.position, board.quaternion);
      const water = surfaceClearanceOf(
        testPlanet.radius,
        surfaceNormal(mat, testPlanet.center),
      );
      // A little under MIN_BOARD_WATER: the mat sits MAT_OFFSET in front of
      // the board's own searched point, so it can be marginally nearer land
      // than the point itself was.
      expect(water).toBeGreaterThan(MIN_BOARD_WATER - 6);
    }
  });

  test("no board is over land", () => {
    for (const board of calculatedBoardPositionsAndRotations(
      items,
      testPlanet,
    )) {
      const position = new Vector3(...board.position);
      expect(
        surfaceClearanceOf(
          testPlanet.radius,
          surfaceNormal(position, testPlanet.center),
        ),
      ).toBeGreaterThan(0);
    }
  });

  test("stands on the cruise shell, facing the ship's line of approach", () => {
    const boards = calculatedBoardPositionsAndRotations(items, testPlanet);
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const nodes = trailNodes(testPlanet);

    boards.forEach((board, i) => {
      const position = new Vector3(...board.position);
      expect(position.distanceTo(testPlanet.center)).toBeCloseTo(
        shellRadius,
        5,
      );

      // Up is the true radial direction at its own spot.
      const quaternion = new Quaternion(...board.quaternion);
      const up = new Vector3(0, 1, 0).applyQuaternion(quaternion);
      expect(
        up.distanceTo(surfaceNormal(position, testPlanet.center)),
      ).toBeLessThan(1e-5);

      // Local +X runs along the approach, which (given PictureFrame's baked
      // -90deg Y rotation puts the picture normal on local -X) is what makes
      // the board face the oncoming ship.
      const localX = new Vector3(1, 0, 0).applyQuaternion(quaternion);
      expect(localX.dot(nodes[i].approach)).toBeGreaterThan(0.95);
    });
  });

  // The whole point of the L: the mat is between the ship and the board, so
  // arriving triggers the project before the ship can reach the billboard.
  test("the activation mat sits in front of its board, on the approach side", () => {
    const boards = calculatedBoardPositionsAndRotations(items, testPlanet);
    const nodes = trailNodes(testPlanet);

    boards.forEach((board, i) => {
      const anchor = new Vector3(...board.position);
      const mat = getBoardMatWorldPosition(board.position, board.quaternion);
      const toMat = mat.clone().sub(anchor).normalize();
      // The mat lies back along the approach direction from the board.
      expect(toMat.dot(nodes[i].approach)).toBeLessThan(-0.9);
    });
  });
});

describe("trail nodes", () => {
  test("every stop turns a true right angle out of its zone", () => {
    for (const node of trailNodes(testPlanet)) {
      // Approach and exit are both unit tangents at the node.
      expect(node.approach.length()).toBeCloseTo(1, 6);
      expect(node.exit.length()).toBeCloseTo(1, 6);
      expect(Math.abs(node.approach.dot(node.exit))).toBeLessThan(1e-6);
      // Both lie in the tangent plane.
      expect(Math.abs(node.approach.dot(node.direction))).toBeLessThan(1e-6);
      expect(Math.abs(node.exit.dot(node.direction))).toBeLessThan(1e-6);
    }
  });

  test("stops are spread around the planet, not bunched together", () => {
    const nodes = trailNodes(testPlanet);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const separation =
          (nodes[i].direction.angleTo(nodes[j].direction) * 180) / Math.PI;
        expect(separation).toBeGreaterThan(30);
      }
    }
  });

  test("each stop itself sits in open water", () => {
    for (const node of trailNodes(testPlanet)) {
      expect(
        surfaceClearanceOf(testPlanet.radius, node.direction),
      ).toBeGreaterThanOrEqual(MIN_BOARD_WATER - 0.01);
    }
  });
});

describe("pathFrameAt", () => {
  // Regression test, and the one that matters most: landmasses are scattered
  // freely across the whole sphere (see planetTerrain.ts) and now cover about
  // half of it, so it's the trail that has to route around them. This samples
  // the loop densely - i.e. the *interpolated* curve the ship actually flies,
  // not just the router's own knots, which is where clearance is thinnest.
  //
  // Measured with surfaceClearanceOf, which works in great-circle angles.
  // The previous version of this test compared a straight-line chord distance
  // to a continent's centroid against outlineRadiusAt, a tangent-plane
  // radius - two different measures of the same coastline. It therefore
  // repeated the exact bug the router had, and passed while the trail ran
  // 16 world units *inside* the snow continent.
  test("never runs through a landmass - clears every coastline by the required corridor", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const pathSamples = 2880;

    let worstClearance = Infinity;
    let worstAt = 0;
    for (let i = 0; i < pathSamples; i++) {
      const t = i / pathSamples;
      const { position } = pathFrameAt(shellRadius, t, testPlanet.center);
      const clearance = surfaceClearanceOf(
        testPlanet.radius,
        surfaceNormal(position, testPlanet.center),
      );
      if (clearance < worstClearance) {
        worstClearance = clearance;
        worstAt = t;
      }
    }

    expect(
      worstClearance,
      `worst clearance ${worstClearance.toFixed(2)}u at t=${worstAt.toFixed(3)}`,
    ).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
  });

  // Regression test for the jagged trail: an earlier router picked each
  // longitude's latitude independently, so it jumped branches between
  // neighbouring samples. The trail deliberately turns right angles now, so
  // the invariant is continuity of *position* rather than of heading - no
  // sample may be far from the one before it.
  test("is continuous - no teleporting between neighbouring samples", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const samples = 1440;
    let previous = pathFrameAt(shellRadius, 0, testPlanet.center).position;
    let longestStep = 0;

    for (let i = 1; i <= samples; i++) {
      const here = pathFrameAt(
        shellRadius,
        i / samples,
        testPlanet.center,
      ).position;
      longestStep = Math.max(longestStep, here.distanceTo(previous));
      previous = here;
    }

    // The whole loop is a few hundred units long; a jump would be tens.
    expect(longestStep).toBeLessThan(3);
  });

  // The trail has to close on itself: it's one loop around the planet, and a
  // seam at lon 0 would show up as a kink in the ring and a wrong board facing
  // right where the ship spawns.
  test("closes seamlessly where the loop wraps", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const before = pathFrameAt(shellRadius, 1 - 1e-4, testPlanet.center);
    const after = pathFrameAt(shellRadius, 1e-4, testPlanet.center);
    expect(before.position.distanceTo(after.position)).toBeLessThan(0.2);
    expect(before.tangent.dot(after.tangent)).toBeGreaterThan(0.99);
  });
});
