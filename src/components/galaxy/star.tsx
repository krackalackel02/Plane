import React, { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useWorldBounds } from "../../utils/worldBounds";

// Vertical spread for stars - kept independent of the ship's play area
// since the ship never leaves the y=0 plane, but stars are purely
// decorative backdrop and should still fill out the sky above/below it.
const STAR_Y_RANGE = 150;

/**
 * Stars component to render a field of stars in the galaxy, confined to
 * the same world boundary the ship is confined to (see utils/worldBounds)
 * so the starfield reads as "the sky over the playable zone" rather than
 * scattering stars the ship can never actually reach.
 * @param count - Number of stars to render
 * @returns JSX.Element
 */
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  const bounds = useWorldBounds();

  // Generate positions for stars within the world boundary
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        position: [
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          (Math.random() - 0.5) * STAR_Y_RANGE,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
        ] as [number, number, number],
      })),
    [count, bounds],
  );

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
