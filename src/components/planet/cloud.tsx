import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CylinderGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

export type CloudVariant = "plain" | "rain" | "snow";

// Shared across every cloud instance rather than one geometry/material per
// mesh - four lobe sizes are enough to build every cloud in the scene out of
// (see LOBE_LAYOUT).
const lobeGeometries = [
  new IcosahedronGeometry(1.05, 0),
  new IcosahedronGeometry(0.85, 0),
  new IcosahedronGeometry(0.62, 0),
  new IcosahedronGeometry(0.45, 0),
];
const plainMaterial = new MeshStandardMaterial({
  color: "#fbfdff",
  roughness: 0.85,
  flatShading: true,
});
// Still darker than a fair-weather cloud, but kept well up the grey scale:
// at a low flat-shaded poly count a mid-grey lobe cluster reads as a pile of
// rocks sitting on the ground rather than as an overcast cloud.
const rainMaterial = new MeshStandardMaterial({
  color: "#dfe5ec",
  roughness: 0.85,
  flatShading: true,
});
const snowCloudMaterial = new MeshStandardMaterial({
  color: "#f2f6fb",
  roughness: 0.85,
  flatShading: true,
});
const materialFor = (variant: CloudVariant): MeshStandardMaterial =>
  variant === "rain"
    ? rainMaterial
    : variant === "snow"
      ? snowCloudMaterial
      : plainMaterial;

// A single lobe layout, reused (scaled/tinted per variant) by every cloud:
// a wide, roughly flat-bottomed bank of puffs with a second tier stacked on
// top for volume, and some spread along z as well as x so it reads as a
// solid mass from any angle rather than a thin row of balls seen edge-on.
// Centred on the origin so `scale` grows it evenly in both directions.
const LOBE_LAYOUT: { geo: number; x: number; y: number; z: number }[] = [
  // lower tier - the broad base
  { geo: 1, x: -1.85, y: -0.05, z: 0.15 },
  { geo: 0, x: -0.95, y: 0.02, z: -0.2 },
  { geo: 0, x: 0, y: 0, z: 0.18 },
  { geo: 0, x: 0.95, y: 0.02, z: -0.15 },
  { geo: 1, x: 1.8, y: -0.05, z: 0.2 },
  { geo: 2, x: 2.5, y: -0.12, z: -0.1 },
  { geo: 2, x: -2.45, y: -0.1, z: -0.12 },
  // upper tier - the billowing top
  { geo: 1, x: -0.55, y: 0.72, z: 0.05 },
  { geo: 1, x: 0.5, y: 0.78, z: -0.1 },
  { geo: 2, x: 1.4, y: 0.6, z: 0.12 },
  { geo: 3, x: -1.35, y: 0.6, z: -0.05 },
];

const rainGeometry = new CylinderGeometry(0.03, 0.03, 0.8, 4);
const rainMeshMaterial = new MeshStandardMaterial({
  color: "#7dd3fc",
  transparent: true,
  opacity: 0.55,
  roughness: 0.3,
});
const snowGeometry = new SphereGeometry(0.08, 6, 6);
const snowMeshMaterial = new MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.4,
});

const UP = new Vector3(0, 1, 0);
// Just under the lobe layout's lowest edge, so precipitation appears to
// leave the cloud's underside rather than its middle.
const CLOUD_BASE_Y = -1.15;
const FALL_SPAN = 3.2;

export interface CloudProps {
  position: Vector3;
  normal: Vector3;
  scale?: number;
  variant?: CloudVariant;
  /** How many rain streaks / snow particles fall beneath it ("rain"/"snow" variants only). */
  precipitationCount?: number;
}

/**
 * A low-poly puffy cloud (a wide bank of icosahedron lobes, per the
 * claymation reference) floating just above the surface, oriented so its
 * own "down" points at the ground beneath it. "rain" and "snow" variants
 * add a handful of falling streaks/particles underneath, looping through a
 * fixed fall span rather than recycling through object pooling - the
 * precipitation counts are deliberately small (a few per cloud) to keep
 * the per-frame cost down across the whole scene.
 */
const Cloud = ({
  position,
  normal,
  scale = 1,
  variant = "plain",
  precipitationCount = 5,
}: CloudProps) => {
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, normal),
    [normal],
  );
  const material = materialFor(variant);
  const dropRefs = useRef<(Mesh | null)[]>([]);
  const dropOffsets = useMemo(
    () =>
      // Spread to match the (much wider) lobe layout above, so precipitation
      // falls from under the whole cloud rather than just its middle.
      Array.from({ length: precipitationCount }, (_, i) => ({
        x: Math.sin(i * 12.9) * 2.2,
        z: Math.sin(i * 7.7 + 1) * 0.5,
        speed: 0.8 + Math.sin(i * 3.1) * 0.2 + 0.6,
        phase: i * 0.9,
      })),
    [precipitationCount],
  );

  useFrame((state) => {
    if (variant === "plain") return;
    const t = state.clock.elapsedTime;
    dropRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const { speed, phase } = dropOffsets[i];
      const fall = ((t * speed + phase) % 1) * FALL_SPAN;
      mesh.position.y = CLOUD_BASE_Y - fall;
    });
  });

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      {LOBE_LAYOUT.map((lobe, i) => (
        <mesh
          key={i}
          geometry={lobeGeometries[lobe.geo]}
          material={material}
          position={[lobe.x, lobe.y, lobe.z]}
          castShadow
        />
      ))}
      {variant === "rain" &&
        dropOffsets.map((drop, i) => (
          <mesh
            key={i}
            ref={(el) => (dropRefs.current[i] = el)}
            geometry={rainGeometry}
            material={rainMeshMaterial}
            position={[drop.x, CLOUD_BASE_Y, drop.z]}
          />
        ))}
      {variant === "snow" &&
        dropOffsets.map((drop, i) => (
          <mesh
            key={i}
            ref={(el) => (dropRefs.current[i] = el)}
            geometry={snowGeometry}
            material={snowMeshMaterial}
            position={[drop.x, CLOUD_BASE_Y, drop.z]}
          />
        ))}
    </group>
  );
};

export default Cloud;
