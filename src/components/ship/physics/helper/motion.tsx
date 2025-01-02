import { AxisType, MotionType } from "../../../types/types";
import { HarmonicMotion } from "../motions/harmonic/harmonic";
import { TranslationMotion } from "../motions/translation/translation";
import { YawMotion } from "../motions/yaw/yaw";
import { deg2rad } from "../../../../utils/3d";
import constants from "../../../../utils/motionConstants.json";
import keys from "../../../../utils/keys.json";

export const Motion = {
  ROLL: "roll" as MotionType,
  PITCH: "pitch" as MotionType,
  YAW: "yaw" as MotionType,
  THROTTLE: "throttle" as MotionType,
};
export const createMotion = (
  type: MotionType,
): YawMotion | HarmonicMotion | TranslationMotion => {
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
