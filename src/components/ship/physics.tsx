import { useEffect, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { BaseMotion, HarmonicMotion } from "./motion";
import KeyHandler from "../helper/keyHandler";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const Physics: React.FC<{
  groupRef: React.RefObject<Group>;
}> = ({ groupRef }) => {
  const rollMotion = useRef(
    new HarmonicMotion({
      axis: "z",
      stiffness: 50,
      damping: 4,
      maxAngle: Math.PI / 6,
      positiveKey: "ArrowRight",
      negativeKey: "ArrowLeft",
    }),
  );

  const pitchMotion = useRef(
    new HarmonicMotion({
      axis: "x",
      stiffness: 50,
      damping: 4,
      maxAngle: Math.PI / 12,
      positiveKey: "ArrowUp",
      negativeKey: "ArrowDown",
    }),
  );

  const yawMotion = useRef(
    new BaseMotion({
      axis: "y",
      positiveKey: "a",
      negativeKey: "d",
      rateIncrement: 2,
      maxRate: 5,
      decayFactor: 0.9,
    }),
  );

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
