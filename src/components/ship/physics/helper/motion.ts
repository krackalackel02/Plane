import { AxisType, MotionType } from "../../../types/controlTypes"; // Import types
import { HarmonicMotion } from "../motions/harmonic/harmonic"; // Import HarmonicMotion class
import { TranslationMotion } from "../motions/translation/translation"; // Import TranslationMotion class
import { YawMotion } from "../motions/yaw/yaw"; // Import YawMotion class
import { deg2rad } from "../../../../utils/3d"; // Utility to convert degrees to radians
import constants from "../../../../utils/motionConstants.json"; // Import motion constants
import keys from "../../../../utils/keys.json"; // Import key mappings

/**
 * Enumeration of available motion types.
 * Includes roll, pitch, yaw, and throttle motions.
 */
export const Motion = {
  ROLL: "roll" as MotionType,
  PITCH: "pitch" as MotionType,
  YAW: "yaw" as MotionType,
  THROTTLE: "throttle" as MotionType,
};

/**
 * Creates a motion instance based on the specified type.
 * @param type  - The type of motion to create (roll, pitch, yaw, throttle).
 * @returns A motion instance of the specified type.
 */
export const createMotion = (
  type: MotionType,
): YawMotion | HarmonicMotion | TranslationMotion => {
  // Extract positive and negative keys for the motion type
  const positiveKey = keys[type].positive;
  const negativeKey = keys[type].negative;

  // Create motion instance based on type
  if (type === "roll" || type === "pitch") {
    // Create HarmonicMotion for roll and pitch
    return new HarmonicMotion({
      axis: constants[type].axis as AxisType,
      stiffness: constants[type].stiffness,
      damping: constants[type].damping,
      maxAngle: deg2rad(constants[type].maxAngle),
      positiveKey,
      negativeKey,
    });
  } else if (type === "yaw") {
    // Create YawMotion for yaw
    return new YawMotion({
      axis: constants[type].axis as AxisType,
      positiveKey,
      negativeKey,
      decayFactor: constants[type].decayFactor,
      maxSpeed: constants[type].maxSpeed,
      acceleration: constants[type].acceleration,
    });
  } else {
    // Create TranslationMotion for throttle
    return new TranslationMotion({
      positiveKey,
      negativeKey,
      decayFactor: constants[type].decayFactor,
      maxSpeed: constants[type].maxSpeed,
      acceleration: constants[type].acceleration,
    });
  }
};
