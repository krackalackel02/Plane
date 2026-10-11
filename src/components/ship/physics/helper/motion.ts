import { AxisType } from "../../../types/controlTypes"; // Import types
import { HarmonicMotion } from "../motions/harmonic/harmonic"; // Import HarmonicMotion class
import { deg2rad } from "../../../../utils/3d"; // Utility to convert degrees to radians
import constants from "../../../../utils/motionConstants.json"; // Import motion constants
import keys from "../../../../utils/keys.json"; // Import key mappings

// Cosmetic tilt motions - roll and pitch are purely visual banking that
// layers on top of the ship's actual surface heading (see PlanetMotion),
// which is why only these two go through this factory now.
export const Motion = {
  ROLL: "roll" as const,
  PITCH: "pitch" as const,
};

export type CosmeticMotionType = (typeof Motion)[keyof typeof Motion];

// Factory to create a cosmetic roll/pitch HarmonicMotion instance
export const createMotion = (type: CosmeticMotionType): HarmonicMotion =>
  new HarmonicMotion({
    axis: constants[type].axis as AxisType,
    stiffness: constants[type].stiffness,
    damping: constants[type].damping,
    maxAngle: deg2rad(constants[type].maxAngle),
    positiveKey: keys[type].positive,
    negativeKey: keys[type].negative,
  });
