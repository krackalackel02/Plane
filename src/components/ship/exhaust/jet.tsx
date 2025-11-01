/* eslint-disable react/prop-types */
import constants from "../../../utils/constants.json"; // Import constants for exhaust configuration
import { deg2rad } from "../../../utils/3d"; // Utility to convert degrees to radians
import { log } from "../../../utils/common";
import ParticleGenerator from "./particleGenerator"; // Particle generator component

interface JetProps {
  coneAngle?: number; // Cone angle in radians
  position: [number, number, number]; // Position of the jet
  active: boolean; // Whether the jet is active
  reverse: boolean; // Whether the jet is in reverse mode
}

const Jet: React.FC<JetProps> = ({
  coneAngle = deg2rad(constants.exhaust.coneAngle),
  position = [0, 0, 0],
  active,
  reverse,
}) => {
  log(`[Render] [Jet] active prop is: ${active}`);
  return (
    <ParticleGenerator
      active={active}
      reverse={reverse}
      position={position}
      count={200}
      coneAngle={coneAngle}
    />
  );
};

export default Jet;
