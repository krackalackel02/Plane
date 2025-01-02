import {
  AxisType,
  Color,
  ColorMapEntry,
  MotionType,
  Range,
} from "../components/types/types";
import constants from "../utils/motionConstants.json";
import keys from "../utils/keys.json";
import { BaseMotion } from "../components/ship/physics/motion";
import { HarmonicMotion } from "../components/ship/physics/harmonic";
import { TranslationMotion } from "../components/ship/physics/translation";
import { YawMotion } from "../components/ship/physics/yaw";

export const precomputeRanges = (colorMap: ColorMapEntry[]): Range[] =>
  colorMap.map((_, i) =>
    i < colorMap.length - 1
      ? { start: colorMap[i].limit, end: colorMap[i + 1].limit }
      : null,
  );

export const interpolateColor = (
  start: Color,
  end: Color,
  t: number,
): Color => [
  start[0] + t * (end[0] - start[0]),
  start[1] + t * (end[1] - start[1]),
  start[2] + t * (end[2] - start[2]),
];

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

export const generateRandomPosition = (
  range: number,
): [number, number, number] => [
  (Math.random() - 0.5) * range,
  (Math.random() - 0.5) * range,
  (Math.random() - 0.5) * range,
];

interface BoundingBox {
  max: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
}
export const computeScale = (
  dimensions: { x: number; y: number; z: number },
  bbox: BoundingBox,
) => {
  const scaleX = dimensions.x / (bbox.max.x - bbox.min.x);
  const scaleY = dimensions.y / (bbox.max.y - bbox.min.y);
  const scaleZ = dimensions.z / (bbox.max.z - bbox.min.z);
  return Math.min(scaleX, scaleY, scaleZ);
};

export const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export const Motion = {
  ROLL: "roll" as MotionType,
  PITCH: "pitch" as MotionType,
  YAW: "yaw" as MotionType,
  THROTTLE: "throttle" as MotionType,
};
export const createMotion = (
  type: MotionType,
): BaseMotion | HarmonicMotion | TranslationMotion => {
  const positiveKey = keys[type].positive;
  const negativeKey = keys[type].negative;

  if (type === "roll" || type === "pitch") {
    return new HarmonicMotion({
      axis: constants[type].axis as AxisType,
      stiffness: constants[type].stiffness,
      damping: constants[type].damping,
      maxAngle: deg2rad(constants[type].maxAngle),
      positiveKey,
      negativeKey,
    });
  } else if (type === "yaw") {
    return new YawMotion({
      axis: constants[type].axis as AxisType,
      positiveKey,
      negativeKey,
      rateIncrement: constants[type].rateIncrement,
      maxRate: constants[type].maxRate,
      decayFactor: constants[type].decayFactor,
    });
  } else {
    return new TranslationMotion({
      positiveKey,
      negativeKey,
      decayFactor: constants[type].decayFactor,
      maxSpeed: constants[type].maxSpeed,
      acceleration: constants[type].acceleration,
    });
  }
};
