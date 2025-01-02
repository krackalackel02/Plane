import { useEffect, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { Motion, createMotion } from "./motion";
import { useKeyContext } from "../../../context/keyContext";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const Physics: React.FC<{
  groupRef: React.RefObject<Group>;
}> = ({ groupRef }) => {
  const rollMotion = useRef(createMotion(Motion.ROLL));
  const pitchMotion = useRef(createMotion(Motion.PITCH));
  const yawMotion = useRef(createMotion(Motion.YAW));
  const throttleMotion = useRef(createMotion(Motion.THROTTLE));

  const activeKeys = useKeyContext();

  useEffect(() => {
    if (!groupRef.current) return;

    const roll = rollMotion.current;
    const pitch = pitchMotion.current;
    const yaw = yawMotion.current;
    const throttle = throttleMotion.current;

    roll.attachTo(groupRef.current);
    pitch.attachTo(groupRef.current);
    yaw.attachTo(groupRef.current);
    throttle.attachTo(groupRef.current);

    return () => {
      roll.cleanup();
      pitch.cleanup();
      yaw.cleanup();
      throttle.cleanup();
    };
  }, [groupRef]);

  useFrame((_, delta) => {
    rollMotion.current.update(delta, activeKeys);
    pitchMotion.current.update(delta, activeKeys);
    yawMotion.current.update(delta, activeKeys);
    throttleMotion.current.update(delta, activeKeys);
  });

  return null;
};

export default Physics;
