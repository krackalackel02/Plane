import React from "react";
import { render } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";

// Mutable stand-in for three's DefaultLoadingManager state, as surfaced by
// drei's useProgress. Tests mutate this and rerender to simulate assets
// loading over time.
const progressState = { active: false, loaded: 0, total: 0 };

vi.mock("@react-three/drei", () => ({
  useProgress: () => ({ ...progressState }),
}));

import { LoadingProvider, useLoading } from "./loadingContext";

const captured: number[] = [];
const Probe = () => {
  const { progress } = useLoading();
  captured.push(progress);
  return null;
};

describe("LoadingProvider progress", () => {
  // Regression test: drei's own `progress` field rescales its 0-100 baseline
  // every time a new batch of assets starts (e.g. board thumbnails kicking
  // off after the ship model finishes), which makes the displayed percentage
  // visibly jump backwards. See user report - the bar should only ever climb.
  test("never decreases even when new assets are discovered mid-load", () => {
    captured.length = 0;

    const { rerender } = render(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    // Ship model: 1 of 1 loaded.
    Object.assign(progressState, { active: true, loaded: 1, total: 1 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    // Board thumbnails start arriving - denominator grows faster than the
    // numerator, which is exactly where the raw ratio (and drei's own
    // `progress`) would dip back down.
    Object.assign(progressState, { active: true, loaded: 1, total: 9 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    Object.assign(progressState, { active: true, loaded: 5, total: 9 });
    rerender(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );

    for (let i = 1; i < captured.length; i++) {
      expect(captured[i]).toBeGreaterThanOrEqual(captured[i - 1]);
    }
    // Confirms the 100% peak from the first batch was actually recorded
    // (i.e. the assertion above isn't vacuously true from a flat 0).
    expect(Math.max(...captured)).toBeCloseTo(100, 5);
  });
});
