import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import { createMoonTexture } from "./moonTexture";

const MOON_SEGMENTS = 14;

export interface MoonProps {
  /** Radius of the moon itself, in world units. */
  size: number;
  /** Radius of its circular orbit around the planet's own center (the group this renders inside is already centered there). */
  orbitRadius: number;
  /** Orbital angular speed, radians/sec. */
  orbitSpeed: number;
  /** Self-rotation speed, radians/sec. */
  spinSpeed: number;
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
}

/**
 * A small moon that continuously orbits the planet on a circular, tilted
 * path while spinning on its own axis - both driven directly off the
 * render clock in useFrame rather than React state, so neither motion
 * ever causes a re-render.
 */
const Moon = ({
  size,
  orbitRadius,
  orbitSpeed,
  spinSpeed,
  inclinationDeg,
  phase,
}: MoonProps) => {
  const orbitGroupRef = useRef<Group>(null);
  const spinRef = useRef<Mesh>(null);
  const inclination = (inclinationDeg * Math.PI) / 180;
  const texture = useMemo(() => createMoonTexture(), []);

  useFrame((state, delta) => {
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
    if (spinRef.current) spinRef.current.rotation.y += delta * spinSpeed;
  });

  return (
    <group ref={orbitGroupRef}>
      <mesh ref={spinRef}>
        <sphereGeometry args={[size, MOON_SEGMENTS, MOON_SEGMENTS]} />
        <meshStandardMaterial map={texture} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
};

export default Moon;
