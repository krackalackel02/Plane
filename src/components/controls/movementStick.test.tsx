import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyProvider, useKeyContext } from "../../context/keyContext";
import MovementStick from "./movementStick";

const KeysDisplay = () => {
  const keys = useKeyContext();
  return <div data-testid="keys">{Array.from(keys).sort().join(",")}</div>;
};

// Track: 130px circle centered at (75, 175). Radius 65, travel = 65-25 = 40.
// Deadzone is 35% of travel (14px) on the COMBINED magnitude.
const TRACK_RECT = {
  top: 110,
  bottom: 240,
  left: 10,
  right: 140,
  height: 130,
  width: 130,
  x: 10,
  y: 110,
  toJSON: () => ({}),
};
const CENTER_X = 75;
const CENTER_Y = 175;

const setup = () => {
  render(
    <KeyProvider>
      <MovementStick />
      <KeysDisplay />
    </KeyProvider>,
  );
  const track = document.querySelector(".circular-stick-track") as HTMLElement;
  track.getBoundingClientRect = vi.fn(() => TRACK_RECT);
  return track;
};

const drag = (track: HTMLElement, dx: number, dy: number) =>
  fireEvent.pointerDown(track, {
    pointerId: 1,
    clientX: CENTER_X + dx,
    clientY: CENTER_Y + dy,
  });

describe("MovementStick", () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
  });

  it("presses nothing within the deadzone", () => {
    const track = setup();
    drag(track, 5, 5); // well under the ~14px combined threshold
    expect(screen.getByTestId("keys")).toHaveTextContent("");
  });

  it("presses w when dragged up past the deadzone", () => {
    const track = setup();
    drag(track, 0, -30);
    expect(screen.getByTestId("keys")).toHaveTextContent("w");
  });

  it("presses s when dragged down past the deadzone", () => {
    const track = setup();
    drag(track, 0, 30);
    expect(screen.getByTestId("keys")).toHaveTextContent("s");
  });

  it("presses d (yaw right) when dragged right past the deadzone", () => {
    const track = setup();
    drag(track, 30, 0);
    expect(screen.getByTestId("keys")).toHaveTextContent("d");
  });

  it("presses a (yaw left) when dragged left past the deadzone", () => {
    const track = setup();
    drag(track, -30, 0);
    expect(screen.getByTestId("keys")).toHaveTextContent("a");
  });

  it("supports throttle and yaw simultaneously on a diagonal", () => {
    const track = setup();
    drag(track, 28, -28); // up-right diagonal, within the clamp radius
    const keys = screen.getByTestId("keys").textContent;
    expect(keys).toContain("w");
    expect(keys).toContain("d");
  });

  it("clamps to the circular edge rather than the corner", () => {
    const track = setup();
    // Way outside the track radius in both axes at once - should still
    // clamp to the circle (magnitude <= travel) and register both
    // directions, not silently drop one because it's "out of bounds".
    drag(track, 500, -500);
    const keys = screen.getByTestId("keys").textContent;
    expect(keys).toContain("w");
    expect(keys).toContain("d");
  });

  it("releases every key and springs back on pointer up", () => {
    const track = setup();
    drag(track, 0, -30);
    expect(screen.getByTestId("keys")).toHaveTextContent("w");

    fireEvent.pointerUp(track, { pointerId: 1 });
    expect(screen.getByTestId("keys")).toHaveTextContent("");
  });

  it("switches axes cleanly when dragged across center", () => {
    const track = setup();
    drag(track, 0, -30); // up
    expect(screen.getByTestId("keys")).toHaveTextContent("w");

    fireEvent.pointerMove(track, {
      pointerId: 1,
      clientX: CENTER_X,
      clientY: CENTER_Y + 30,
    }); // down
    expect(screen.getByTestId("keys")).toHaveTextContent("s");
  });
});
