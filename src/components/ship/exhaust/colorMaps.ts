import { ColorMapEntry } from "../../types/colourTypes";

// Original saturated spectrum for the plain-dot "particles" mode: close/fast
// particles (lifetime near 1) are blue, aging to red then yellow as they
// slow down and drift further from the ship.
export const particleColorMap: ColorMapEntry[] = [
  { limit: 1, color: [0, 0, 1] }, // Blue
  { limit: 0.9, color: [1, 0, 0] }, // Red
  { limit: 0.5, color: [1, 1, 0] }, // Yellow
];

// Matte spectrum for the volumetric "clouds" and "voxels" modes - same
// close/fast-to-slow/far concept, toned down from neon-saturated to flat,
// richer-than-pastel blues/reds/yellows.
export const matteColorMap: ColorMapEntry[] = [
  { limit: 1, color: [0.24, 0.44, 0.69] }, // Matte blue
  { limit: 0.9, color: [0.75, 0.27, 0.23] }, // Matte red
  { limit: 0.5, color: [0.85, 0.63, 0.21] }, // Matte gold/yellow
];

// Shared boost look, applied the same modest way by every render mode so
// "you're boosting" reads consistently regardless of which one is active:
// a bit bigger, a bit brighter, and tinted toward this hot blue.
export const BOOST_SIZE_MULTIPLIER = 1.3;
export const BOOST_BRIGHTNESS = 1.2;
export const BOOST_COLOR_BLEND = 0.35; // how far toward BOOST_TINT a boosted particle sits
export const BOOST_TINT: [number, number, number] = [0.4, 0.75, 1];

// Mixes a particle's own lifetime color toward BOOST_TINT and brightens it.
// Only called for live particles - callers should leave dead ones at [0,0,0].
export const applyBoostTint = (
  r: number,
  g: number,
  b: number,
): [number, number, number] => [
  (r * (1 - BOOST_COLOR_BLEND) + BOOST_TINT[0] * BOOST_COLOR_BLEND) *
    BOOST_BRIGHTNESS,
  (g * (1 - BOOST_COLOR_BLEND) + BOOST_TINT[1] * BOOST_COLOR_BLEND) *
    BOOST_BRIGHTNESS,
  (b * (1 - BOOST_COLOR_BLEND) + BOOST_TINT[2] * BOOST_COLOR_BLEND) *
    BOOST_BRIGHTNESS,
];
