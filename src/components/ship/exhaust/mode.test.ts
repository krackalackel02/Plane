import { describe, test, expect } from "vitest";
import { resolveExhaustMode } from "./mode";

describe("resolveExhaustMode", () => {
  test("falls back to 'voxels' when nothing is set", () => {
    expect(resolveExhaustMode()).toBe("voxels");
  });

  test("falls back to 'voxels' for an unrecognised override", () => {
    expect(resolveExhaustMode("not-a-real-mode")).toBe("voxels");
  });

  test("honours a valid override", () => {
    expect(resolveExhaustMode("particles")).toBe("particles");
    expect(resolveExhaustMode("voxels")).toBe("voxels");
  });
});
