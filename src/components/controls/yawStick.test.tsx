import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyProvider, useKeyContext } from "../../context/keyContext";
import YawStick from "./yawStick";

const KeysDisplay = () => {
  const keys = useKeyContext();
  return <div data-testid="keys">{Array.from(keys).sort().join(",")}</div>;
};

// Deadzone/spring-back behavior is covered by linearStick.test.tsx; this
// just confirms YawStick wires up the correct (and correctly-signed)
// keys.json keys — right must turn the nose right ("d"), not left.
const TRACK_RECT = {
  top: 0,
  bottom: 60,
  left: 100,
  right: 250,
  height: 60,
  width: 150,
  x: 100,
  y: 0,
  toJSON: () => ({}),
};

const setup = () => {
  render(
    <KeyProvider>
      <YawStick />
      <KeysDisplay />
    </KeyProvider>,
  );
  const track = document.querySelector(".linear-stick-track") as HTMLElement;
  track.getBoundingClientRect = vi.fn(() => TRACK_RECT);
  return track;
};

describe("YawStick", () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
  });

  it("presses d (yaw right) when dragged right", () => {
    const track = setup();
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 220 });
    expect(screen.getByTestId("keys")).toHaveTextContent("d");
  });

  it("presses a (yaw left) when dragged left", () => {
    const track = setup();
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 130 });
    expect(screen.getByTestId("keys")).toHaveTextContent("a");
  });
});
