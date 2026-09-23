import React from "react";
import { render, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable stand-in for three's DefaultLoadingManager state, as surfaced by
// drei's useProgress. Tests mutate this and rerender to simulate assets
// loading over time.
const progressState = { active: false, loaded: 0, total: 0 };
const setProgress = (patch: Partial<typeof progressState>) => {
  Object.assign(progressState, patch);
};

vi.mock("@react-three/drei", () => ({
  useProgress: () => ({ ...progressState }),
}));

import { LoadingProvider, useLoading } from "./loadingContext";

type Sample = { ready: boolean; progress: number };
const captured: Sample[] = [];
const Probe = () => {
  const { ready, progress } = useLoading();
  captured.push({ ready, progress });
  return null;
};

const renderProvider = () =>
  render(
    <LoadingProvider>
      <Probe />
    </LoadingProvider>,
  );

const Scene = () => (
  <LoadingProvider>
    <Probe />
  </LoadingProvider>
);

const last = () => captured[captured.length - 1];
const progressValues = () => captured.map((s) => s.progress);
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("LoadingProvider progress", () => {
  beforeEach(() => {
    captured.length = 0;
    setProgress({ active: false, loaded: 0, total: 0 });
    // Fake both setTimeout (the settle debounce) and requestAnimationFrame
    // (the climb/finish animation) so a single vi.advanceTimersByTime call
    // deterministically drives the whole curve.
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("climbs toward 99% over the average-load estimate and holds there while still loading", () => {
    const { rerender } = renderProvider();

    // Genuinely in-progress loading, so the "nothing ever started" fallback
    // doesn't kick in and short-circuit this test.
    setProgress({ active: true, loaded: 2, total: 9 });
    rerender(<Scene />);

    advance(500); // half of the ~1s average-load estimate
    const halfway = last().progress;
    expect(halfway).toBeGreaterThan(30);
    expect(halfway).toBeLessThan(70);

    // Well past the estimate, but the (mocked) manager never reported done.
    advance(2000);
    expect(last().progress).toBeCloseTo(99, 5);
    expect(last().ready).toBe(false);

    // Keeps holding at 99% rather than creeping past it while still loading.
    advance(1000);
    expect(last().progress).toBeCloseTo(99, 5);

    const values = progressValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  test("spins to 100 and becomes ready once assets settle as done", () => {
    const { rerender } = renderProvider();

    setProgress({ active: true, loaded: 0, total: 9 });
    rerender(<Scene />);
    advance(500);
    expect(last().progress).toBeLessThan(99);
    expect(last().ready).toBe(false);

    setProgress({ active: false, loaded: 9, total: 9 });
    rerender(<Scene />);

    // Still inside the settle-debounce window - not done yet.
    advance(100);
    expect(last().ready).toBe(false);

    // Past the settle window, with time for the finish spin too.
    advance(500);
    expect(last().progress).toBe(100);
    expect(last().ready).toBe(true);

    const values = progressValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  // Regression test for the real bug this was built to catch: a board's
  // shared material textures live behind its own thumbnail texture in the
  // component tree (Material is a child of Board, and Board suspends on its
  // own texture before ever rendering children) - so they aren't requested
  // until a first wave of loads (ship model + thumbnails) already resolved.
  // The loading manager goes idle between waves, not just once at the very
  // end, so a single "went idle" snapshot would report done far too early.
  test("does not finish while a later wave of assets is still loading", () => {
    const { rerender } = renderProvider();

    // First wave: ship model + board thumbnails.
    setProgress({ active: true, loaded: 0, total: 9 });
    rerender(<Scene />);
    advance(50);

    setProgress({ active: false, loaded: 9, total: 9 });
    rerender(<Scene />);

    // Second wave starts (e.g. shared board material textures, unlocked by
    // the first board's thumbnail resolving) before the settle window from
    // the first wave has elapsed.
    advance(100);
    setProgress({ active: true, loaded: 9, total: 13 });
    rerender(<Scene />);

    // Even given plenty of time, must not report done - the second wave is
    // still in flight and was never actually finished.
    advance(2000);
    expect(last().ready).toBe(false);
    expect(last().progress).toBeLessThan(100);

    // Second wave finishes and this time truly stays settled.
    setProgress({ active: false, loaded: 13, total: 13 });
    rerender(<Scene />);
    advance(500);

    expect(last().progress).toBe(100);
    expect(last().ready).toBe(true);
  });
});
