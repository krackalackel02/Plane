import { describe, it, expect } from "vitest";
import { hasAnyRealControlKey, isBoostEngaged } from "./boost";

describe("hasAnyRealControlKey", () => {
  it("is false with no keys held", () => {
    expect(hasAnyRealControlKey(new Set())).toBe(false);
  });

  it("is false when only the exhaust key is held", () => {
    expect(hasAnyRealControlKey(new Set([" "]))).toBe(false);
  });

  it("is true when a throttle key is held", () => {
    expect(hasAnyRealControlKey(new Set(["w"]))).toBe(true);
  });

  it("is true when a yaw key is held", () => {
    expect(hasAnyRealControlKey(new Set(["a"]))).toBe(true);
  });

  it("is true when a roll or pitch key is held", () => {
    expect(hasAnyRealControlKey(new Set(["ArrowLeft"]))).toBe(true);
    expect(hasAnyRealControlKey(new Set(["ArrowUp"]))).toBe(true);
  });
});

describe("isBoostEngaged", () => {
  it("is false when only Shift is held, with no other input", () => {
    expect(isBoostEngaged(new Set(["Shift"]))).toBe(false);
  });

  it("is false when Shift is held with only the exhaust key", () => {
    expect(isBoostEngaged(new Set(["Shift", " "]))).toBe(false);
  });

  it("is true when Shift is held together with throttle", () => {
    expect(isBoostEngaged(new Set(["Shift", "w"]))).toBe(true);
  });

  it("is true when Shift is held together with yaw", () => {
    expect(isBoostEngaged(new Set(["Shift", "d"]))).toBe(true);
  });

  it("is false when a real control key is held but Shift is not", () => {
    expect(isBoostEngaged(new Set(["w"]))).toBe(false);
  });
});
