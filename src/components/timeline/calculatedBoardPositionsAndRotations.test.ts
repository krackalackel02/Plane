import { describe, test, expect } from "vitest";
import { Vector3 } from "three";
import {
  BOARD_SIDE_OFFSET,
  boardSideOffset,
  boardVisualTransform,
  calculatedBoardPositionsAndRotations,
  spawnTransform,
} from "./calculatedBoardPositionsAndRotations";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { surfaceNormal } from "../../utils/planetSurface";
import { boardJsonProps } from "../types/boardTypes";
import { Planet } from "../../utils/planets";

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
    const visual = boardVisualTransform(board, 0);

    expect(visual.position).not.toEqual(board.position);

    const anchorPos = new Vector3(...board.position);
    const visualPos = new Vector3(...visual.position);
    expect(visualPos.distanceTo(anchorPos)).toBeCloseTo(BOARD_SIDE_OFFSET, 5);
  });

  test("alternates sides by index", () => {
    expect(boardSideOffset(0)).toBeGreaterThan(0);
    expect(boardSideOffset(1)).toBeLessThan(0);
    expect(boardSideOffset(0)).toBe(-boardSideOffset(1));
  });

  test("stays close to the shell (a straight tangent-plane offset bulges slightly outward, not follows the curve)", () => {
    const [board] = calculatedBoardPositionsAndRotations(items, testPlanet);
    const visual = boardVisualTransform(board, 0);
    const visualPos = new Vector3(...visual.position);
    const shellRadius = testPlanet.radius + testPlanet.shipAltitude;
    // Exactly sqrt(shellRadius^2 + BOARD_SIDE_OFFSET^2) for a flat lateral
    // offset - well within a couple of board-lengths of the shell itself.
    expect(visualPos.distanceTo(testPlanet.center)).toBeGreaterThan(
      shellRadius,
    );
    expect(visualPos.distanceTo(testPlanet.center)).toBeLessThan(
      shellRadius + 5,
    );
  });
});
