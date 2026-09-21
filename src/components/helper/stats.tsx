import React from "react";
import { Stats as ThreeStats } from "@react-three/drei";

// Import environment context to access configuration
import { useEnvironment } from "../../context/envContext";

/**
 * Stats component for displaying performance metrics
 * @returns JSX.Element | null
 */
const Stats: React.FC = () => {
  // Get environment configuration
  const { showStats } = useEnvironment();
  // Conditionally render stats based on environment setting
  return showStats ? <ThreeStats /> : null;
};

export default Stats;
