import { describe, test, expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  BOARD_SIDE_OFFSET,
  boardSideOffset,
  boardVisualTransform,
  calculatedBoardPositionsAndRotations,
  pathFrameAt,
  spawnTransform,
} from "./calculatedBoardPositionsAndRotations";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { pointOnSphere, surfaceNormal } from "../../utils/planetSurface";
import { boardJsonProps } from "../types/boardTypes";
import { Planet } from "../../utils/planets";
import { CONTINENTS, outlineRadiusAt } from "../planet/planetTerrain";

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

describe("boardVisualTransform", () => {
  // Regression test: this is the actual bug being fixed - collision was
  // built from the board's centerline anchor (where the activation zone
  // and the ship's own flight path sit) instead of where the board is
  // actually rendered, so flying straight over a zone - nowhere near the
  // (sideways-offset) board - bumped the ship anyway.
  test("is offset sideways from the centerline anchor, not equal to it", () => {
    const [board] = calculatedBoardPositionsAndRotations(items, testPlanet);
    const visual = boardVisualTransform(board, 0, testPlanet);

    expect(visual.position).not.toEqual(board.position);

    const anchorPos = new Vector3(...board.position);
    const visualPos = new Vector3(...visual.position);
    // Not exactly BOARD_SIDE_OFFSET: re-projecting the tangent-plane offset
    // back onto the sphere (see the "stays exactly on the shell" test
    // below) pulls it in slightly, since the chord is shorter than the
    // flat offset it was measured along.
    expect(visualPos.distanceTo(anchorPos)).toBeGreaterThan(
      BOARD_SIDE_OFFSET * 0.9,
    );
    expect(visualPos.distanceTo(anchorPos)).toBeLessThanOrEqual(
      BOARD_SIDE_OFFSET,
    );
  });

  test("alternates sides by index, first board on the left", () => {
    expect(boardSideOffset(0)).toBeLessThan(0);
    expect(boardSideOffset(1)).toBeGreaterThan(0);
    expect(boardSideOffset(0)).toBe(-boardSideOffset(1));
  });

  // Regression test: this is the actual bug being fixed - a naive tangent-
  // plane offset bulges outward off the sphere (its distance from the
  // planet's center grows with how far sideways it's shifted). Re-
  // projecting onto the shell fixes that.
  test("stays exactly on the shell, unlike a naive (un-reprojected) tangent-plane offset", () => {
    const [board] = calculatedBoardPositionsAndRotations(items, testPlanet);
    const visual = boardVisualTransform(board, 0, testPlanet);
    const visualPos = new Vector3(...visual.position);
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;

    expect(visualPos.distanceTo(testPlanet.center)).toBeCloseTo(shellRadius, 5);

    // The un-reprojected version - what the anchor's flat tangent-plane
    // offset alone would give - does bulge outward, confirming the
    // reprojection is actually doing something here (not a no-op on a
    // flat test setup).
    const anchorQuaternion = new Quaternion(...board.quaternion);
    const anchorPos = new Vector3(...board.position);
    const naivePos = new Vector3(0, 0, boardSideOffset(0))
      .applyQuaternion(anchorQuaternion)
      .add(anchorPos);
    expect(naivePos.distanceTo(testPlanet.center)).toBeGreaterThan(shellRadius);
  });

  // Regression test: the naive version also keeps the anchor's own normal
  // as its "up", which stops matching the true radial direction once the
  // board has moved sideways - rebuilding the orientation fresh at the
  // landing point fixes that too.
  test("its up (local Y) matches the true radial direction at its own position, not the anchor's", () => {
    const [board] = calculatedBoardPositionsAndRotations(items, testPlanet);
    const visual = boardVisualTransform(board, 0, testPlanet);
    const visualPos = new Vector3(...visual.position);
    const visualQuaternion = new Quaternion(...visual.quaternion);

    const trueNormal = visualPos.clone().sub(testPlanet.center).normalize();
    const localUp = new Vector3(0, 1, 0).applyQuaternion(visualQuaternion);
    expect(localUp.distanceTo(trueNormal)).toBeLessThan(1e-5);
  });
});

describe("pathFrameAt", () => {
  // Regression test: continents/islands are now scattered freely across
  // the whole sphere (see planetTerrain.ts) rather than confined to a
  // keep-out band, so it's the trail itself that has to detour around
  // wherever they land (see pathLatitude's islandBumpDeg). This checks
  // that detour actually works: sampling the whole loop densely, the
  // trail's closest approach to every landmass must still clear the same
  // corridor a board/activation zone actually needs.
  test("never runs through a continent/island - clears every landmass by the required corridor", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const corridorHalfWidth = 12 + 3.35 + 4 + 3; // mirrors the module's own CORRIDOR_HALF_WIDTH
    const pathSamples = 720;
    const pathPoints = Array.from(
      { length: pathSamples },
      (_, i) =>
        pathFrameAt(
          shellRadius,
          (i / pathSamples) * Math.PI * 2,
          testPlanet.center,
        ).position,
    );

    for (const c of CONTINENTS) {
      const islandCenter = pointOnSphere(
        testPlanet.radius,
        c.lat,
        c.lon,
        testPlanet.center,
      );
      let maxRadius = 0;
      for (let b = 0; b < 36; b++) {
        maxRadius = Math.max(
          maxRadius,
          outlineRadiusAt(c, (b / 36) * Math.PI * 2),
        );
      }

      let minClearance = Infinity;
      for (const p of pathPoints) {
        const clearance = p.distanceTo(islandCenter) - maxRadius;
        if (clearance < minClearance) minClearance = clearance;
      }
      expect(minClearance).toBeGreaterThan(corridorHalfWidth);
    }
  });
});
