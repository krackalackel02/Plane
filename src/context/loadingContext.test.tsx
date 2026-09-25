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

const Scene = () => (
  <LoadingProvider>
    <Probe />
  </LoadingProvider>
);

const last = () => captured[captured.length - 1];
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("LoadingProvider", () => {
  beforeEach(() => {
    captured.length = 0;
    setProgress({ active: false, loaded: 0, total: 0 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("progress reflects the manager's real loaded/total ratio", () => {
    const { rerender } = render(<Scene />);

    setProgress({ active: true, loaded: 3, total: 9 });
    rerender(<Scene />);
    expect(last().progress).toBeCloseTo((3 / 9) * 100, 5);

    setProgress({ active: true, loaded: 6, total: 9 });
    rerender(<Scene />);
    expect(last().progress).toBeCloseTo((6 / 9) * 100, 5);
    expect(last().ready).toBe(false);
  });

  test("becomes ready once assets settle as done, and reports 100 once ready", () => {
    const { rerender } = render(<Scene />);

    setProgress({ active: true, loaded: 0, total: 9 });
    rerender(<Scene />);
    expect(last().ready).toBe(false);

    setProgress({ active: false, loaded: 9, total: 9 });
    rerender(<Scene />);

    // Still inside the settle-debounce window - not done yet.
    advance(100);
    expect(last().ready).toBe(false);

    // Past the settle window.
    advance(200);
    expect(last().ready).toBe(true);
    expect(last().progress).toBe(100);
  });

  // Regression test for the real bug this was built to catch: a board's
  // shared material textures live behind its own thumbnail texture in the
  // component tree (Material is a child of Board, and Board suspends on its
  // own texture before ever rendering children) - so they aren't requested
  // until a first wave of loads (ship model + thumbnails) already resolved.
  // The loading manager goes idle between waves, not just once at the very
  // end, so a single "went idle" snapshot would report done far too early.
  test("does not finish while a later wave of assets is still loading", () => {
    const { rerender } = render(<Scene />);

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
    advance(200);

    expect(last().ready).toBe(true);
    expect(last().progress).toBe(100);
  });

  test("treats nothing-to-load as done after a short grace period", () => {
    render(<Scene />);

    expect(last().ready).toBe(false);
    advance(400);
    expect(last().ready).toBe(true);
  });

  // Regression test: the first wave (ship model + thumbnails) can hit a
  // genuine 100% ratio before a second wave (board material textures) is
  // even discovered, since the manager only knows about items that have
  // actually started. Without clamping, the displayed number would slide
  // backwards (e.g. 100 -> 93) as the denominator grows - which reads as
  // broken even though nothing is actually wrong.
  test("displayed progress never decreases, even when a later wave grows the total", () => {
    const { rerender } = render(<Scene />);

    setProgress({ active: true, loaded: 9, total: 9 });
    rerender(<Scene />);
    expect(last().progress).toBe(99); // capped below 100 until ready, see next test

    // Second wave discovered: denominator grows past the numerator, so the
    // raw ratio would drop from 100% to 9/13 ~= 69%.
    setProgress({ active: true, loaded: 9, total: 13 });
    rerender(<Scene />);
    expect(last().progress).toBeGreaterThanOrEqual(99);

    setProgress({ active: false, loaded: 13, total: 13 });
    rerender(<Scene />);
    advance(200);
    expect(last().progress).toBe(100);
  });

  // Regression test: `ready` (which gates the fade-out and the camera intro)
  // used to only flip after the bar had already been sitting at a genuine
  // 100% for the full SETTLE_MS window, reading as a dead pause once
  // "100%" was already on screen. The bar should never show 100% until the
  // instant it's actually true - capped at 99% for the entire wait instead.
  test("never displays 100% before ready - only exactly at the same instant", () => {
    const { rerender } = render(<Scene />);

    setProgress({ active: true, loaded: 9, total: 9 });
    rerender(<Scene />);

    setProgress({ active: false, loaded: 9, total: 9 });
    rerender(<Scene />);

    // Through the entire settle-debounce wait, it must read <100, not 100.
    advance(100);
    expect(last().ready).toBe(false);
    expect(last().progress).toBeLessThan(100);

    advance(50);
    expect(last().ready).toBe(false);
    expect(last().progress).toBeLessThan(100);

    // The instant it becomes ready, progress is 100 in that same update.
    advance(50);
    expect(last().ready).toBe(true);
    expect(last().progress).toBe(100);
  });
});
