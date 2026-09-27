import React, { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useWorldBounds } from "../../utils/worldBounds";

// Vertical spread for stars - kept independent of the ship's play area
// since the ship never leaves the y=0 plane, but stars are purely
// decorative backdrop and should still fill out the sky above/below it.
const STAR_Y_RANGE = 150;
// Stars spawn across a disk this many times wider than the ship's actual
// travel boundary. The boundary is where the ship physically stops, not
// where the sky should stop - a starfield capped at that same radius goes
// visibly empty the moment the ship reaches the edge and looks toward it.
const STAR_FIELD_RADIUS_MULTIPLIER = 4;

/**
 * Stars component to render a field of stars in the galaxy. Spans a disk
 * much larger than the ship's cylindrical travel boundary (see
 * utils/worldBounds) so the sky still reads as full when the ship is
 * pressed right up against the edge of where it's allowed to fly.
 * @param count - Number of stars to render
 * @returns JSX.Element
 */
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  const bounds = useWorldBounds();
  const fieldRadius = bounds.radius * STAR_FIELD_RADIUS_MULTIPLIER;

  // Generate positions uniformly within the star field's disk (sqrt of a
  // uniform random radius fraction gives uniform area density - a plain
  // linear radius would bunch stars up near the center instead).
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const radius = fieldRadius * Math.sqrt(Math.random());
        return {
          position: [
            bounds.centerX + radius * Math.cos(angle),
            (Math.random() - 0.5) * STAR_Y_RANGE,
            bounds.centerZ + radius * Math.sin(angle),
          ] as [number, number, number],
        };
      }),
    [count, bounds, fieldRadius],
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
