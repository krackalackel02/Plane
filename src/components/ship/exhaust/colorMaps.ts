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
