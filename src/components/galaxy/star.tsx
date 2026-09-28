import React, { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { getActivePlanet, getShellRadius } from "../../utils/planets";

// Vertical spread for stars - kept independent of the planet's radius since
// the sky is purely decorative backdrop and should fill out the space
// above/below the ship's cruise shell too.
const STAR_Y_RANGE = 150;
// Stars spawn across a disk this many times wider than the planet's own
// shell - a starfield capped at the planet's own radius would look far too
// close and go visibly empty near it.
const STAR_FIELD_RADIUS_MULTIPLIER = 4;

/**
 * Stars component to render a field of stars in the galaxy. Spans a disk
 * much larger than the planet's shell (see utils/planets) so the sky still
 * reads as full no matter where on the planet the ship is flying.
 * @param count - Number of stars to render
 * @returns JSX.Element
 */
const Stars: React.FC<{ count?: number }> = ({ count = 1000 }) => {
  const planet = getActivePlanet();
  const fieldRadius = getShellRadius(planet) * STAR_FIELD_RADIUS_MULTIPLIER;

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
            planet.center.x + radius * Math.cos(angle),
            planet.center.y + (Math.random() - 0.5) * STAR_Y_RANGE,
            planet.center.z + radius * Math.sin(angle),
          ] as [number, number, number],
        };
      }),
    [count, planet, fieldRadius],
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
