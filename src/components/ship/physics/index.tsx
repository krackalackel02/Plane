import { useEffect, useRef, useState } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { useControls, button } from "leva";
import { Motion, createMotion } from "./helper/motion";
import { useKeyContext } from "../../../context/keyContext";
import motionConstants from "../../../utils/motionConstants.json";
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

const getControlProps = (key: string) => {
  if (key === "decayFactor") return { min: 0, max: 1, step: 0.05 };
  if (key === "stiffness") return { min: 0, max: 100, step: 1 };
  if (key === "damping") return { min: 0, max: 10, step: 0.1 };
  if (key === "maxAngle") return { min: 0, max: 90, step: 1 };
  if (key === "acceleration") return { min: 0, max: 1, step: 0.01 };
  if (key === "maxSpeed") return { min: 0, max: 100, step: 1 };
  return { min: 0, max: 10, step: 1 };
};
interface PhysicsProps {
  groupRef: React.RefObject<Group>; // This already exists
  helper?: boolean; // Optional prop
}

const Physics: React.FC<PhysicsProps> = ({ groupRef, helper = false }) => {
  const initialParams: Record<keyof typeof defaultMotionParams, any> = {
    roll: { ...defaultMotionParams.roll, ...motionConstants.roll },
    pitch: { ...defaultMotionParams.pitch, ...motionConstants.pitch },
    yaw: { ...defaultMotionParams.yaw, ...motionConstants.yaw },
    throttle: { ...defaultMotionParams.throttle, ...motionConstants.throttle },
  };

  const [params, setParams] = useState(initialParams);

  const motions = useRef({
    [Motion.ROLL]: createMotion(Motion.ROLL),
    [Motion.PITCH]: createMotion(Motion.PITCH),
    [Motion.YAW]: createMotion(Motion.YAW),
    [Motion.THROTTLE]: createMotion(Motion.THROTTLE),
  });

  const activeKeys = useKeyContext();

  if (helper) {
    (Object.keys(params) as Array<keyof typeof params>).forEach((type) => {
      const config = params[type];
      useControls(
        type,
        Object.entries(config).reduce(
          (acc, [key, value]) => {
            if (typeof value === "number") {
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
            }
            return acc;
          },
          {} as Record<string, any>,
        ),
        [params],
      );
    });

    useControls({
      Save: button(() => {
        const blob = new Blob([JSON.stringify(params, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "motionConstants.json";
        a.click();
        URL.revokeObjectURL(url);
      }),
    });
  }

  useEffect(() => {
    if (!groupRef.current) return;

    Object.values(motions.current).forEach((motion) => {
      if (groupRef.current) motion.attachTo(groupRef.current);
    });

    return () => {
      Object.values(motions.current).forEach((motion) => motion.cleanup());
    };
  }, [groupRef]);

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
