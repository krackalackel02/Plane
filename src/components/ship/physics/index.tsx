import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

import { useControls } from "leva"; // Leva for UI controls

// Motion helper utilities
import { Motion, createMotion } from "./helper/motion";
import { useKeyContext } from "../../../context/keyContext";
import { useScene } from "../../../context/sceneContext";
import motionConstants from "../../../utils/motionConstants.json";
import { createSaveButton } from "../../../utils/3d";

/**
 * Default motion parameters for ship physics
 * Used as fallback and for initializing controls
 * - roll: Roll motion parameters
 * - pitch: Pitch motion parameters
 * - yaw: Yaw motion parameters
 * - throttle: Throttle motion parameters
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/prop-types */
const defaultMotionParams = {
  roll: {
    stiffness: 50,
    damping: 4,
    maxAngle: 30,
    axis: "z",
  },
  pitch: {
    stiffness: 50,
    damping: 4,
    maxAngle: 15,
    axis: "x",
  },
  yaw: {
    decayFactor: 0.9,
    axis: "y",
    acceleration: 0.5,
    maxSpeed: 5,
  },
  throttle: {
    acceleration: 0.5,
    maxSpeed: 2,
    decayFactor: 0.85,
  },
};

/**
 * Get control properties for a specific motion parameter
 * @param key id of control
 * @returns control properties
 */
const getControlProps = (key: string) => {
  if (key === "decayFactor") return { min: 0, max: 1, step: 0.05 };
  if (key === "stiffness") return { min: 0, max: 100, step: 1 };
  if (key === "damping") return { min: 0, max: 10, step: 0.1 };
  if (key === "maxAngle") return { min: 0, max: 90, step: 1 };
  if (key === "acceleration") return { min: 0, max: 1, step: 0.01 };
  if (key === "maxSpeed") return { min: 0, max: 100, step: 1 };
  return { min: 0, max: 10, step: 1 };
};

/**
 * Props for Physics component
 * - groupRef: Reference to the ship's group object
 * - helper: Optional boolean to enable motion parameter controls
 */
interface PhysicsProps {
  helper?: boolean; // Optional prop
}

const Physics: React.FC<PhysicsProps> = ({ helper = false }) => {
  // Initialize motion parameters state
  const initialParams: Record<keyof typeof defaultMotionParams, any> = {
    roll: { ...defaultMotionParams.roll, ...motionConstants.roll },
    pitch: { ...defaultMotionParams.pitch, ...motionConstants.pitch },
    yaw: { ...defaultMotionParams.yaw, ...motionConstants.yaw },
    throttle: { ...defaultMotionParams.throttle, ...motionConstants.throttle },
  };

  const { shipRef: groupRef } = useScene();

  const [params, setParams] = useState(initialParams);

  // Refs to motion instances
  const motions = useRef({
    [Motion.ROLL]: createMotion(Motion.ROLL),
    [Motion.PITCH]: createMotion(Motion.PITCH),
    [Motion.YAW]: createMotion(Motion.YAW),
    [Motion.THROTTLE]: createMotion(Motion.THROTTLE),
  });

  const activeKeys = useKeyContext();

  // Setup Leva controls if helper is enabled
  if (helper) {
    (Object.keys(params) as Array<keyof typeof params>).forEach((type) => {
      const config = params[type];
      useControls(
        type,
        Object.entries(config).reduce(
          (acc, [key, value]) => {
            if (typeof value !== "number") return acc;
            const { min, max, step } = getControlProps(key);
            acc[key] = {
              value,
              min,
              max,
              step,
              onChange: (value: number) =>
                setParams((prev) => ({
                  ...prev,
                  [type]: { ...prev[type], [key]: value },
                })),
            };
            return acc;
          },
          {} as Record<string, any>,
        ),
        [params],
      );
    });

    useControls({
      Save: createSaveButton(params, "motionConstants.json"),
    });
  }

  // Attach motions to the group on mount
  useEffect(() => {
    if (!groupRef.current) return;

    Object.values(motions.current).forEach((motion) => {
      if (groupRef.current) motion.attachTo(groupRef.current);
    });

    return () => {
      Object.values(motions.current).forEach((motion) => motion.cleanup());
    };
  }, [groupRef]);

  // Update motions each frame
  useFrame((_, delta) => {
    Object.entries(motions.current).forEach(([type, motion]) => {
      const config = params[type as keyof typeof params];
      motion.updateConfig(config);
      motion.update(delta, activeKeys);
    });
  });

  return null;
};

export default Physics;
