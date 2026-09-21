import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyProvider, useKeyContext } from "../../context/keyContext";
import LinearStick from "./linearStick";

const KeysDisplay = () => {
  const keys = useKeyContext();
  return <div data-testid="keys">{Array.from(keys).sort().join(",")}</div>;
};

// Track: 150 long, 60 thick, centered at 175 on the driven axis.
// halfLength 75, travel = 75-25 = 50. Deadzone is 35% of travel (17.5px).
const VERTICAL_RECT = {
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
const HORIZONTAL_RECT = {
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

const setup = (orientation: "vertical" | "horizontal") => {
  render(
    <KeyProvider>
      <LinearStick
        orientation={orientation}
        positiveKey="POS"
        negativeKey="NEG"
        positiveLabel="+"
        negativeLabel="-"
      />
      <KeysDisplay />
    </KeyProvider>,
  );
  const track = document.querySelector(".linear-stick-track") as HTMLElement;
  track.getBoundingClientRect = vi.fn(() =>
    orientation === "vertical" ? VERTICAL_RECT : HORIZONTAL_RECT,
  );
  return track;
};

describe("LinearStick", () => {
  beforeEach(() => {
    // jsdom doesn't implement pointer capture; stub it so the handler runs.
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
  });

  describe("vertical (up = positive)", () => {
    it("presses nothing for a small move within the deadzone", () => {
      const track = setup("vertical");
      fireEvent.pointerDown(track, { pointerId: 1, clientY: 165 }); // 10px, < 17.5px
      expect(screen.getByTestId("keys")).toHaveTextContent("");
    });

    it("presses the positive key when dragged up past the deadzone", () => {
      const track = setup("vertical");
      fireEvent.pointerDown(track, { pointerId: 1, clientY: 130 }); // 45px up
      expect(screen.getByTestId("keys")).toHaveTextContent("POS");
    });

    it("presses the negative key when dragged down past the deadzone", () => {
      const track = setup("vertical");
      fireEvent.pointerDown(track, { pointerId: 1, clientY: 220 }); // 45px down
      expect(screen.getByTestId("keys")).toHaveTextContent("NEG");
    });

    it("releases and springs back to center on pointer up", () => {
      const track = setup("vertical");
      fireEvent.pointerDown(track, { pointerId: 1, clientY: 130 });
      expect(screen.getByTestId("keys")).toHaveTextContent("POS");

      fireEvent.pointerUp(track, { pointerId: 1 });
      expect(screen.getByTestId("keys")).toHaveTextContent("");
    });

    it("switches axis cleanly when dragged across center", () => {
      const track = setup("vertical");
      fireEvent.pointerDown(track, { pointerId: 1, clientY: 130 });
      expect(screen.getByTestId("keys")).toHaveTextContent("POS");

      fireEvent.pointerMove(track, { pointerId: 1, clientY: 220 });
      expect(screen.getByTestId("keys")).toHaveTextContent("NEG");
    });
  });

  describe("horizontal (right = positive)", () => {
    it("presses the positive key when dragged right past the deadzone", () => {
      const track = setup("horizontal");
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 220 }); // 45px right
      expect(screen.getByTestId("keys")).toHaveTextContent("POS");
    });

    it("presses the negative key when dragged left past the deadzone", () => {
      const track = setup("horizontal");
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 130 }); // 45px left
      expect(screen.getByTestId("keys")).toHaveTextContent("NEG");
    });

    it("presses nothing for a small move within the deadzone", () => {
      const track = setup("horizontal");
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 185 }); // 10px
      expect(screen.getByTestId("keys")).toHaveTextContent("");
    });
  });
});
