import React from "react";
import { render, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { KeyProvider, useKeyContext } from "./keyContext";

const captured: string[][] = [];
const Probe = () => {
  const activeKeys = useKeyContext();
  captured.push(Array.from(activeKeys));
  return null;
};

const Scene = () => (
  <KeyProvider>
    <Probe />
  </KeyProvider>
);

const last = () => captured[captured.length - 1];
const press = (key: string) =>
  act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key })));
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("KeyProvider stuck-key recovery", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // The direct regression case: a held key whose keyup never arrives (the
  // OS delivered it to a different tab after a click stole focus, e.g. the
  // project popup's "View Demo" link) must not stay stuck forever.
  test("clears all active keys on window blur", () => {
    render(<Scene />);
    press("w");
    expect(last()).toEqual(["w"]);

    act(() => void window.dispatchEvent(new Event("blur")));
    expect(last()).toEqual([]);
  });

  // Backstop: even if blur itself is somehow missed (or fires from a path
  // this component isn't listening to), the periodic poll independently
  // checks document.hasFocus() and self-heals rather than trusting event
  // delivery alone.
  test("clears stuck keys via periodic poll when focus is lost without a blur event", () => {
    render(<Scene />);
    press("ArrowUp");
    expect(last()).toEqual(["ArrowUp"]);

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    advance(7000);
    expect(last()).toEqual([]);
  });

  // The poll must not touch state while focus genuinely never changed - it
  // shouldn't clear keys that are still legitimately held.
  test("leaves active keys alone while the window still has focus", () => {
    render(<Scene />);
    press("a");
    advance(7000);
    expect(last()).toEqual(["a"]);
  });
});

describe("KeyProvider Caps Lock normalization", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  // With Caps Lock on, the browser reports event.key as an uppercase letter
  // for w/a/s/d, but keys.json binds controls to lowercase strings. Without
  // normalizing, activeKeys would hold "W" while every consumer checks for
  // "w", silently breaking throttle/yaw input whenever Caps Lock is active.
  test("records single-character letter keys as lowercase regardless of Caps Lock", () => {
    render(<Scene />);
    press("W");
    expect(last()).toEqual(["w"]);
  });

  // Multi-character key names (arrows, modifiers) aren't affected by Caps
  // Lock and must be left exactly as the browser reports them.
  test("leaves multi-character key names untouched", () => {
    render(<Scene />);
    press("ArrowLeft");
    expect(last()).toEqual(["ArrowLeft"]);
  });
});
