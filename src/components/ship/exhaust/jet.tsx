/* eslint-disable react/prop-types */
import constants from "../../../utils/constants.json"; // Import constants for exhaust configuration
import { deg2rad } from "../../../utils/3d"; // Utility to convert degrees to radians

import ExhaustGenerator from "./generator"; // Mode-dispatching exhaust generator

interface JetProps {
  coneAngle?: number; // Cone angle in radians
  position: [number, number, number]; // Position of the jet
  active: boolean; // Whether the jet is active
  reverse: boolean; // Whether the jet is in reverse mode
  boost?: boolean; // Whether the boost key is held
}

const Jet: React.FC<JetProps> = ({
  coneAngle = deg2rad(constants.exhaust.coneAngle),
  position = [0, 0, 0],
  active,
  reverse,
  boost = false,
}) => {
  return (
    <ExhaustGenerator
      active={active}
      reverse={reverse}
      position={position}
      coneAngle={coneAngle}
      boost={boost}
    />
  );
};

export default Jet;
