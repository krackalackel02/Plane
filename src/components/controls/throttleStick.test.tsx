import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyProvider, useKeyContext } from "../../context/keyContext";
import ThrottleStick from "./throttleStick";

const KeysDisplay = () => {
  const keys = useKeyContext();
  return <div data-testid="keys">{Array.from(keys).sort().join(",")}</div>;
};

// Deadzone/spring-back behavior is covered by linearStick.test.tsx; this
// just confirms ThrottleStick wires up the correct keys.json keys.
const TRACK_RECT = {
  top: 100,
  bottom: 250,
  left: 0,
  right: 60,
  height: 150,
  width: 60,
  x: 0,
  y: 100,
  toJSON: () => ({}),
};

const setup = () => {
  render(
    <KeyProvider>
      <ThrottleStick />
      <KeysDisplay />
    </KeyProvider>,
  );
  const track = document.querySelector(".linear-stick-track") as HTMLElement;
  track.getBoundingClientRect = vi.fn(() => TRACK_RECT);
  return track;
};

describe("ThrottleStick", () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
  });

  it("presses w when dragged up", () => {
    const track = setup();
    fireEvent.pointerDown(track, { pointerId: 1, clientY: 130 });
    expect(screen.getByTestId("keys")).toHaveTextContent("w");
  });

  it("presses s when dragged down", () => {
    const track = setup();
    fireEvent.pointerDown(track, { pointerId: 1, clientY: 220 });
    expect(screen.getByTestId("keys")).toHaveTextContent("s");
  });
});
