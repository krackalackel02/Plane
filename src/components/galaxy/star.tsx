import React from "react";
import { Instances, Instance } from "@react-three/drei";
import { generateRandomPosition } from "../../utils/3d";
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  // Helper function to generate random positions

  // Generate positions for stars
  const stars = Array.from({ length: count }).map(() => ({
    position: generateRandomPosition(200), // Ensure the tuple type
  }));

  return (
    <Instances limit={count} range={count}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial color="white" />
      {stars.map((star, index) => (
        <Instance key={index} position={star.position} /> // Correctly typed as [number, number, number]
      ))}
    </Instances>
  );
};

export default Stars;
