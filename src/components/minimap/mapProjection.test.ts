import { describe, test, expect } from "vitest";
import {
  arrowRotationForYaw,
  computeWorldToMapProjection,
  type WorldPoint,
} from "./mapProjection";

const SIZE = 200;
const PADDING_RATIO = 0.22;

describe("computeWorldToMapProjection", () => {
  const boards: WorldPoint[] = [
    { id: "ahead", position: [0, 0, 20] },
    { id: "behind", position: [0, 0, -20] },
    { id: "right", position: [20, 0, 0] },
    { id: "left", position: [-20, 0, 0] },
  ];

  test("a board ahead of the ship (+z) maps above center - reads as north", () => {
    const { toMap } = computeWorldToMapProjection(boards, SIZE, PADDING_RATIO);
    const [, shipY] = toMap(0, 0);
    const [, aheadY] = toMap(0, 20);
    const [, behindY] = toMap(0, -20);

    expect(aheadY).toBeLessThan(shipY);
    expect(behindY).toBeGreaterThan(shipY);
  });

  // X is flipped along with Z (see computeWorldToMapProjection's doc
  // comment) so the map's left/right matches the ship's own left/right,
  // not raw world +x/-x.
  test("positive world x maps to the left of center", () => {
    const { toMap } = computeWorldToMapProjection(boards, SIZE, PADDING_RATIO);
    const [shipX] = toMap(0, 0);
    const [rightX] = toMap(20, 0);
    const [leftX] = toMap(-20, 0);

    expect(rightX).toBeLessThan(shipX);
    expect(leftX).toBeGreaterThan(shipX);
  });

  test("the ship's own boardPoints land at the same coordinates toMap would compute", () => {
    const { toMap, boardPoints } = computeWorldToMapProjection(
      boards,
      SIZE,
      PADDING_RATIO,
    );
    const ahead = boardPoints.find((p) => p.id === "ahead")!;
    const [x, y] = toMap(0, 20);

    expect(ahead.x).toBeCloseTo(x);
    expect(ahead.y).toBeCloseTo(y);
  });

  test("a single board (or none) still floors the span instead of zooming to a point", () => {
    const { toMap } = computeWorldToMapProjection(
      [{ id: "only", position: [0, 0, 0] }],
      SIZE,
      PADDING_RATIO,
    );
    const [x, y] = toMap(0, 0);

    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("arrowRotationForYaw", () => {
  // TranslationMotion's forward vector at yaw is (sin(yaw), cos(yaw)) in
  // (x, z) - this is the same convention translation.tsx uses to move the
  // ship, so a regression here would silently desync the arrow from the
  // ship's actual heading.
  const forwardVector = (yaw: number) => ({
    dx: Math.sin(yaw),
    dz: Math.cos(yaw),
  });

  test("at yaw 0 the arrow points straight up (north), matching a ship that starts facing the boards", () => {
    const { toMap } = computeWorldToMapProjection(
      [{ id: "ahead", position: [0, 0, 20] }],
      SIZE,
      PADDING_RATIO,
    );
    const { dx, dz } = forwardVector(0);
    const [shipX, shipY] = toMap(0, 0);
    const [movedX, movedY] = toMap(dx, dz);

    // Moving one step forward should read as "up" on the map (smaller y)
    // with no horizontal drift, and the arrow's rotation should be 0 - an
    // untransformed "point up" glyph - to match.
    expect(movedY).toBeLessThan(shipY);
    expect(movedX).toBeCloseTo(shipX);
    // toBeCloseTo (not toBe) since -yaw at yaw=0 is -0, not +0.
    expect(arrowRotationForYaw(0)).toBeCloseTo(0);
  });

  test("rotation stays in lockstep with the ship's yaw for an arbitrary heading", () => {
    const yaw = Math.PI / 3; // 60 degrees, an arbitrary non-axis-aligned heading
    const { dx, dz } = forwardVector(yaw);

    // Screen-space forward vector after the map's x/z flip.
    const screenForward = { x: -dx, y: -dz };

    // Rotating the canvas's default "up" glyph (0, -1) by ctx.rotate(theta)
    // in a y-down space maps it to (sin(theta), -cos(theta)).
    const rotated = {
      x: Math.sin(arrowRotationForYaw(yaw)),
      y: -Math.cos(arrowRotationForYaw(yaw)),
    };

    expect(rotated.x).toBeCloseTo(screenForward.x);
    expect(rotated.y).toBeCloseTo(screenForward.y);
  });

  // keyContext's determineControlState defines "turning left" as the 'a'
  // key (yaw.positive), i.e. increasing rotation.y. A regression test for
  // the exact bug reported: increasing yaw away from 0 must rotate the
  // map arrow counter-clockwise (12 o'clock towards 9 o'clock), matching
  // a real north-up map, not clockwise (towards 3 o'clock).
  test("increasing yaw (the game's 'turn left') rotates the arrow counter-clockwise", () => {
    const smallLeftTurn = 0.2; // radians, well short of wrapping past +-PI/2

    expect(arrowRotationForYaw(smallLeftTurn)).toBeLessThan(0);
  });
});
