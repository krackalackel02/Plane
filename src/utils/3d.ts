import { button } from "leva";
import { Color, ColorMapEntry, Range } from "../components/types/types";
import { Box3 } from "three";

/**
 * Precompute ranges for color mapping based on lifetime limits
 * @param colorMap - Array of color map entries
 * @returns Array of precomputed ranges
 */
export const precomputeRanges = (colorMap: ColorMapEntry[]): Range[] =>
  colorMap.map((_, i) =>
    i < colorMap.length - 1
      ? { start: colorMap[i].limit, end: colorMap[i + 1].limit }
      : null,
  );

/**
 * Interpolate between two colors based on a factor t
 * @param start - The starting color
 * @param end - The ending color
 * @param t - The interpolation factor (0 to 1)
 * @returns The interpolated color
 */
export const interpolateColor = (
  start: Color,
  end: Color,
  t: number,
): Color => [
  start[0] + t * (end[0] - start[0]),
  start[1] + t * (end[1] - start[1]),
  start[2] + t * (end[2] - start[2]),
];

/**
 * Get the color from the lifetime ratio using the color map and precomputed ranges
 * @param ratio - The lifetime ratio (0 to 1)
 * @param colorMap - Array of color map entries
 * @param precomputedRanges - Array of precomputed ranges
 * @returns The interpolated color
 */
export const getColorFromLifetime = (
  ratio: number,
  colorMap: ColorMapEntry[],
  precomputedRanges: Range[],
): Color => {
  for (let i = 0; i < precomputedRanges.length; i++) {
    const range = precomputedRanges[i];
    if (range && ratio <= range.start && ratio > range.end) {
      const t = (ratio - range.end) / (range.start - range.end);
      return interpolateColor(colorMap[i].color, colorMap[i + 1].color, t);
    }
  }
  return colorMap[colorMap.length - 1].color;
};

/**
 * Generate a random position within a cube defined by the given range.
 * @param range - The size of the cube
 * @returns A random position within the cube
 */
export const generateRandomPosition = (
  range: number,
): [number, number, number] => [
  (Math.random() - 0.5) * range,
  (Math.random() - 0.5) * range,
  (Math.random() - 0.5) * range,
];

/**
 * Compute the scale factor for a 3D object based on its dimensions and bounding box.
 * @param dimensions - The desired dimensions of the object
 * @param bbox - The bounding box of the object
 * @returns The scale factor to fit the object within the bounding box
 */
export const computeScale = (
  dimensions: { x: number; y: number; z: number },
  bbox: Box3,
) => {
  const scaleX = dimensions.x / (bbox.max.x - bbox.min.x);
  const scaleY = dimensions.y / (bbox.max.y - bbox.min.y);
  const scaleZ = dimensions.z / (bbox.max.z - bbox.min.z);
  return Math.min(scaleX, scaleY, scaleZ);
};

/**
 * Convert degrees to radians.
 * @param deg - The angle in degrees.
 * @returns The angle in radians.
 */
export const deg2rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Create a save button for downloading JSON data.
 * @param data - The data to be saved.
 * @param filename - The name of the file to save.
 * @returns A button component.
 */
export const createSaveButton = (data: unknown, filename: string) =>
  button(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
