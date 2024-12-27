import { useEffect, useRef } from "react";
import { Group } from "three";
import { Motion } from "./motion";
import KeyHandler from "../helper/keyHandler";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const Physics: React.FC<{
  groupRef: React.RefObject<Group>;
}> = ({ groupRef }) => {
  const rollMotion = useRef(
    new Motion({
      axis: "z",
      stiffness: 50,
      damping: 4,
      maxAngle: Math.PI / 6,
      positiveKey: "ArrowRight",
      negativeKey: "ArrowLeft",
    }),
  );

  const pitchMotion = useRef(
    new Motion({
      axis: "x",
      stiffness: 50,
      damping: 4,
      maxAngle: Math.PI / 12,
      positiveKey: "ArrowUp",
      negativeKey: "ArrowDown",
    }),
  );

  useEffect(() => {
    if (!groupRef.current) return;

    const roll = rollMotion.current;
    const pitch = pitchMotion.current;

    roll.attachTo(groupRef.current);
    pitch.attachTo(groupRef.current);

    return () => {
      roll.cleanup();
      pitch.cleanup();
    };
  }, [groupRef]);

  const handleKeyDown = (e: KeyboardEvent) => {
    rollMotion.current.handleKeyDown(e);
    pitchMotion.current.handleKeyDown(e);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    rollMotion.current.handleKeyUp(e);
    pitchMotion.current.handleKeyUp(e);
  };

  return <KeyHandler onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} />;
};

export default Physics;
