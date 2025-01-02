import React from "react";
import { Stats as ThreeStats } from "@react-three/drei";
import { useEnvironment } from "../../context/envContext";

const Stats: React.FC = () => {
  const { showStats } = useEnvironment();

  return showStats ? <ThreeStats /> : null;
};

export default Stats;
