import { describe, expect, test } from "vitest";
import { Vector3 } from "three";
import { FILL_LIGHT_POSITION, KEY_LIGHT } from "./lightRig";
import { getActivePlanet } from "../../utils/planets";

const planet = getActivePlanet();
// The tallest things on the planet - cloud puffs over the peaks - stand no
// more than this far above its surface.
const TALLEST = 15;
const reach = planet.radius + TALLEST;

describe("light rig", () => {
  // The regression: the key light once sat inside the planet, so the whole
  // hemisphere facing it was behind its shadow camera and had no shadows.
  test("the shadow-casting light stands outside the planet and everything on it", () => {
    const distance = new Vector3(...KEY_LIGHT.position).distanceTo(
      planet.center,
    );
    expect(distance).toBeGreaterThan(reach);
  });

  test("its shadow camera's depth range spans the whole planet, near side to far", () => {
    const distance = new Vector3(...KEY_LIGHT.position).distanceTo(
      planet.center,
    );
    expect(KEY_LIGHT.shadowNear).toBeGreaterThan(0);
    expect(KEY_LIGHT.shadowNear).toBeLessThan(distance - reach);
    expect(KEY_LIGHT.shadowFar).toBeGreaterThan(distance + reach);
  });

  test("its shadow camera's frustum covers the planet's whole disc", () => {
    expect(KEY_LIGHT.shadowExtent).toBeGreaterThanOrEqual(reach);
    // ...without wasting resolution far beyond it.
    expect(KEY_LIGHT.shadowExtent).toBeLessThan(reach * 1.5);
  });

  test("the fill light also stands outside the planet, on the far side from the key", () => {
    const fill = new Vector3(...FILL_LIGHT_POSITION);
    expect(fill.distanceTo(planet.center)).toBeGreaterThan(reach);
    expect(fill.dot(new Vector3(...KEY_LIGHT.position))).toBeLessThan(0);
  });
});
