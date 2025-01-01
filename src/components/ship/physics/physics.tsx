import { useEffect, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { Motion, createMotion } from "./motion";
import KeyHandler from "../../helper/keyHandler";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */

const ROLL = createMotion(Motion.ROLL);
const PITCH = createMotion(Motion.PITCH);
const YAW = createMotion(Motion.YAW);

const Physics: React.FC<{
  groupRef: React.RefObject<Group>;
}> = ({ groupRef }) => {
  const rollMotion = useRef(ROLL);

  const pitchMotion = useRef(PITCH);

  const yawMotion = useRef(YAW);

  useEffect(() => {
    if (!groupRef.current) return;

    const roll = rollMotion.current;
    const pitch = pitchMotion.current;
    const yaw = yawMotion.current;

    roll.attachTo(groupRef.current);
    pitch.attachTo(groupRef.current);
    yaw.attachTo(groupRef.current);

    return () => {
      roll.cleanup();
      pitch.cleanup();
      yaw.cleanup();
    };
  }, [groupRef]);

  useFrame((_, delta) => {
    yawMotion.current.update(delta);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    rollMotion.current.handleKeyDown(e);
    pitchMotion.current.handleKeyDown(e);
    yawMotion.current.handleKeyDown(e);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    rollMotion.current.handleKeyUp(e);
    pitchMotion.current.handleKeyUp(e);
    yawMotion.current.handleKeyUp(e);
  };

  return <KeyHandler onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} />;
};

export default Physics;
