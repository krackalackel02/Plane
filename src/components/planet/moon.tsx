import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { createMoonTexture } from "./moonTexture";

const MOON_SEGMENTS = 14;
// Arbitrary fixed local axis treated as the moon's "near side" - which
// axis doesn't matter (the crater texture has no real near/far side of
// its own), only that tidal lock (see below) keeps it consistently
// pointed at the planet.
const FACING_AXIS = new Vector3(0, 0, 1);

export interface MoonProps {
  /** Radius of the moon itself, in world units. */
  size: number;
  /** Radius of its circular orbit around the planet's own center (the group this renders inside is already centered there). */
  orbitRadius: number;
  /** Orbital angular speed, radians/sec - sign sets direction. */
  orbitSpeed: number;
  /** Tilt of the orbital plane, degrees - rotated around the same world
   * +Z axis lon=0 points along (see planetSurface's pointOnSphere), so a
   * moon's longitude-0 crossing always sits at (0,0,orbitRadius)
   * regardless of tilt, letting `phase` below place it at a specific
   * longitude independent of inclination. */
  inclinationDeg: number;
  /** Starting orbital angle, radians - matches planetSurface's lon
   * convention, so passing a ship-spawn longitude here starts the moon
   * near where the player is actually looking at load time. */
  phase: number;
  /** Tints the (otherwise shared, grey) crater texture - lets two moons read as visually distinct bodies rather than identical spheres at different sizes. */
  tint: string;
}

/**
 * A small moon that continuously orbits the planet on a circular, tilted
 * path - driven directly off the render clock in useFrame rather than
 * React state, so it never causes a re-render. Tidally locked like the
 * real Moon: rather than spinning independently, it re-faces the planet's
 * center every frame, so the same side always points inward and it only
 * completes one full rotation (relative to the stars) per orbit.
 */
const Moon = ({
  size,
  orbitRadius,
  orbitSpeed,
  inclinationDeg,
  phase,
  tint,
}: MoonProps) => {
  const orbitGroupRef = useRef<Group>(null);
  const spinRef = useRef<Mesh>(null);
  const inclination = (inclinationDeg * Math.PI) / 180;
  const texture = useMemo(() => createMoonTexture(), []);
  const direction = useRef(new Vector3()).current;
  const quaternion = useRef(new Quaternion()).current;

  useFrame((state) => {
    const angle = state.clock.elapsedTime * orbitSpeed + phase;
    // Untilted position first (x0, 0, z0), lon-style (x=sin, z=cos), then
    // tilted by rotating around world +Z - which leaves the lon=0 point
    // (0,0,orbitRadius) fixed, so `phase` alone controls where the moon
    // starts regardless of inclination.
    const x0 = orbitRadius * Math.sin(angle);
    const z0 = orbitRadius * Math.cos(angle);
    const x = x0 * Math.cos(inclination);
    const y = x0 * Math.sin(inclination);
    orbitGroupRef.current?.position.set(x, y, z0);

    if (spinRef.current) {
      // Tidal lock: face the planet's center (the origin of the outer,
      // already-planet-centered group this renders inside), not an
      // independently accumulating spin.
      direction.set(-x, -y, -z0).normalize();
      quaternion.setFromUnitVectors(FACING_AXIS, direction);
      spinRef.current.quaternion.copy(quaternion);
    }
  });

  return (
    <group ref={orbitGroupRef}>
      <mesh ref={spinRef} castShadow>
        <sphereGeometry args={[size, MOON_SEGMENTS, MOON_SEGMENTS]} />
        <meshStandardMaterial
          map={texture}
          color={tint}
          roughness={0.9}
          flatShading
        />
      </mesh>
    </group>
  );
};

export default Moon;
