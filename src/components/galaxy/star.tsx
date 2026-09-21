import React from "react";
import { Instances, Instance } from "@react-three/drei";

// Utility to generate random positions
import { generateRandomPosition } from "../../utils/3d";

/**
 * Stars component to render a field of stars in the galaxy
 * @param count - Number of stars to render
 * @returns JSX.Element
 */
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  const starRange = 200; // Range for star positions in x, y, z

  // Generate positions for stars
  const stars = Array.from({ length: count }).map(() => ({
    position: generateRandomPosition(starRange), // Ensure the tuple type
  }));

  const geometry: [number, number, number] = [0.1, 8, 8]; // Sphere geometry: radius, widthSegments, heightSegments
  const starColor = "white"; // Star color

  return (
    <Instances limit={count} range={count}>
      <sphereGeometry args={geometry} />
      <meshBasicMaterial color={starColor} />
      {stars.map((star, index) => (
        <Instance key={index} position={star.position} /> // Correctly typed as [number, number, number]
      ))}
    </Instances>
  );
};

export default Stars;
