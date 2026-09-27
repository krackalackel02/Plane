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

  // Boost ring: travel (base radius) is 40px, BOOST_RING_WIDTH is 24px, so
  // the ring spans 40-64px from center. Engage fires at 60% across it
  // (~54.4px), disengage falls back at 30% (~47.2px).
  it("does not engage boost while still within the base radius", () => {
    const track = setup();
    drag(track, 0, -40); // exactly at the base radius, not into the ring yet
    const keys = screen.getByTestId("keys").textContent;
    expect(keys).toContain("w");
    expect(keys).not.toContain("Shift");
  });

  it("snaps into boost once pulled past the engage point in the ring", () => {
    const track = setup();
    drag(track, 0, -55); // past the 60% engage point of the boost ring
    const keys = screen.getByTestId("keys").textContent;
    expect(keys).toContain("w");
    expect(keys).toContain("Shift");
  });

  it("stays boosting inside the disengage band (hysteresis)", () => {
    const track = setup();
    drag(track, 0, -55); // engage
    expect(screen.getByTestId("keys")).toHaveTextContent("Shift");

    fireEvent.pointerMove(track, {
      pointerId: 1,
      clientX: CENTER_X,
      clientY: CENTER_Y - 50, // still above the 30% disengage point (~47.2px)
    });
    expect(screen.getByTestId("keys")).toHaveTextContent("Shift");
  });

  it("disengages boost once pulled back under the disengage point", () => {
    const track = setup();
    drag(track, 0, -55); // engage
    expect(screen.getByTestId("keys")).toHaveTextContent("Shift");

    fireEvent.pointerMove(track, {
      pointerId: 1,
      clientX: CENTER_X,
      clientY: CENTER_Y - 40, // back at the base radius, under the disengage point
    });
    expect(screen.getByTestId("keys")).not.toHaveTextContent("Shift");
  });

  it("releases boost on pointer up", () => {
    const track = setup();
    drag(track, 0, -70); // well past the ring, definitely boosting
    expect(screen.getByTestId("keys")).toHaveTextContent("Shift");

    fireEvent.pointerUp(track, { pointerId: 1 });
    expect(screen.getByTestId("keys")).toHaveTextContent("");
  });

  it("caps the knob's boosting travel at the ring's outer edge", () => {
    const track = setup();
    drag(track, 0, -500); // far beyond the ring
    const knob = document.querySelector(".circular-stick-knob") as HTMLElement;
    expect(knob.className).toContain("is-boosting");
    // travel (40) + BOOST_RING_WIDTH (24) = 64px max, snapped straight up.
    expect(knob.style.transform).toContain("translate(0px, -64px)");
  });
});
