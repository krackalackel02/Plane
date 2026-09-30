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

// Mirrors the module's own CORRIDOR_HALF_WIDTH (ship half-width + safety
// margin). Kept as a literal on purpose: if the module's value changes, this
// test should have to be looked at rather than silently following along.
const CORRIDOR_HALF_WIDTH = 2.5 + 4.5;

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
    let worstLonDeg = 0;
    for (let i = 0; i < pathSamples; i++) {
      const lon = (i / pathSamples) * Math.PI * 2;
      const { position } = pathFrameAt(shellRadius, lon, testPlanet.center);
      const clearance = surfaceClearanceOf(
        testPlanet.radius,
        surfaceNormal(position, testPlanet.center),
      );
      if (clearance < worstClearance) {
        worstClearance = clearance;
        worstLonDeg = (lon * 180) / Math.PI;
      }
    }

    expect(
      worstClearance,
      `worst clearance ${worstClearance.toFixed(2)}u at lon ${worstLonDeg.toFixed(0)}`,
    ).toBeGreaterThan(CORRIDOR_HALF_WIDTH);
  });

  // Regression test for the jagged, apparently self-crossing trail: the old
  // router chose each longitude's latitude independently, so where a landmass
  // split the safe latitudes into a northern and a southern branch,
  // neighbouring longitudes picked opposite branches and the trail jumped
  // tens of degrees between them. A bounded second difference is what rules
  // that out - and it also keeps pathFrameAt's finite-differenced tangent
  // meaningful, which is what boards take their facing from.
  test("is smooth - no sudden latitude jumps anywhere around the loop", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const samples = 720;
    const latitudeAt = (i: number): number => {
      const lon = (i / samples) * Math.PI * 2;
      const { position } = pathFrameAt(shellRadius, lon, testPlanet.center);
      return Math.asin(
        Math.max(-1, Math.min(1, surfaceNormal(position, testPlanet.center).y)),
      );
    };

    const latitudes = Array.from({ length: samples }, (_, i) => latitudeAt(i));
    let worstJumpDeg = 0;
    let worstCurvatureDeg = 0;
    for (let i = 0; i < samples; i++) {
      const behind = latitudes[(i - 1 + samples) % samples];
      const here = latitudes[i];
      const ahead = latitudes[(i + 1) % samples];
      worstJumpDeg = Math.max(
        worstJumpDeg,
        (Math.abs(ahead - here) * 180) / Math.PI,
      );
      worstCurvatureDeg = Math.max(
        worstCurvatureDeg,
        (Math.abs(ahead - 2 * here + behind) * 180) / Math.PI,
      );
    }

    // At half-degree longitude steps a smooth weave moves well under a degree
    // of latitude per step; the old router jumped by 40+ here.
    expect(worstJumpDeg).toBeLessThan(2);
    expect(worstCurvatureDeg).toBeLessThan(1);
  });

  // The trail has to close on itself: it's one loop around the planet, and a
  // seam at lon 0 would show up as a kink in the ring and a wrong board facing
  // right where the ship spawns.
  test("closes seamlessly at the longitude seam", () => {
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    const before = pathFrameAt(
      shellRadius,
      Math.PI * 2 - 1e-4,
      testPlanet.center,
    );
    const after = pathFrameAt(shellRadius, 1e-4, testPlanet.center);
    expect(before.position.distanceTo(after.position)).toBeLessThan(0.05);
    expect(before.tangent.dot(after.tangent)).toBeGreaterThan(0.999);
  });
});
