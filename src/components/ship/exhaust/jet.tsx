/* eslint-disable react/prop-types */
import ParticleGenerator from "./particleGenerator";
import constants from "../../../utils/constants.json";
import { deg2rad } from "../../../utils/3d";

interface JetProps {
  coneAngle?: number;
  position: [number, number, number];
  active: boolean;
  reverse: boolean;
}

const Jet: React.FC<JetProps> = ({
  coneAngle = deg2rad(constants.exhaust.coneAngle),
  position = [0, 0, 0],
  active,
  reverse,
}) => {
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
