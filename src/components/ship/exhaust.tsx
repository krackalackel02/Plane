import KeyHandler from "../helper/keyHandler";
import ParticleGenerator from "./particleGenerator";
import { useState } from "react";
// Disable react/prop-types for this file
/* eslint-disable react/prop-types */
const Jet: React.FC<{
  coneAngle?: number;
  position: [number, number, number];
}> = ({ coneAngle = Math.PI / 6, position = [0, 0, 0] }) => {
  const [exhaust, setExhaust] = useState(false); // Track particle generator state
  const handleExhaustKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") setExhaust(true);
  };

  const handleExhaustKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") setExhaust(false);
  };

  return (
    <>
      <ParticleGenerator
        active={exhaust}
        position={position}
        count={200}
        coneAngle={coneAngle}
      />
      <KeyHandler
        onKeyDown={handleExhaustKeyDown}
        onKeyUp={handleExhaustKeyUp}
      />
    </>
  );
};

const Exhaust: React.FC = () => {
  const right: [number, number, number] = [-0.5, 0.75, -0.5]; // Right position
  const left: [number, number, number] = [0.5, 0.75, -0.5]; // Left position
  return (
    <>
      <Jet position={left} />
      <Jet position={right} />
    </>
  );
};

export default Exhaust;
