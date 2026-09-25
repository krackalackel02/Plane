import { describe, test, expect } from "vitest";
import { resolveExhaustMode } from "./mode";

describe("resolveExhaustMode", () => {
  test("falls back to 'clouds' when nothing is set", () => {
    expect(resolveExhaustMode()).toBe("clouds");
  });

  test("falls back to 'clouds' for an unrecognised override", () => {
    expect(resolveExhaustMode("not-a-real-mode")).toBe("clouds");
  });

  test("honours a valid override", () => {
    expect(resolveExhaustMode("particles")).toBe("particles");
    expect(resolveExhaustMode("voxels")).toBe("voxels");
  });
});
