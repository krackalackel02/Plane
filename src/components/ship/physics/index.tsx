import { useEffect, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { Motion, createMotion } from "./helper/motion";
import { useKeyContext } from "../../../context/keyContext";

// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const Physics: React.FC<{
  groupRef: React.RefObject<Group>;
}> = ({ groupRef }) => {
  const motions = useRef({
    [Motion.ROLL]: createMotion(Motion.ROLL),
    [Motion.PITCH]: createMotion(Motion.PITCH),
    [Motion.YAW]: createMotion(Motion.YAW),
    [Motion.THROTTLE]: createMotion(Motion.THROTTLE),
  });

  const activeKeys = useKeyContext();

  useEffect(() => {
    if (!groupRef.current) return;

    // Attach each motion to the group
    Object.values(motions.current).forEach((motion) => {
      if (groupRef.current) motion.attachTo(groupRef.current);
    });

    return () => {
      // Cleanup each motion
      Object.values(motions.current).forEach((motion) => motion.cleanup());
    };
  }, [groupRef]);

  useFrame((_, delta) => {
    // Update each motion
    Object.values(motions.current).forEach((motion) =>
      motion.update(delta, activeKeys),
    );
  });

  return null;
};

export default Physics;
