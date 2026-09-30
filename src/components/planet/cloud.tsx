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

// Shared across every cloud instance - a handful of lobes in a shrinking
// row (see the low-poly-cloud reference) rather than one geometry/material
// per mesh.
const lobeGeometries = [
  new IcosahedronGeometry(0.55, 0),
  new IcosahedronGeometry(0.42, 0),
  new IcosahedronGeometry(0.32, 0),
  new IcosahedronGeometry(0.24, 0),
];
const plainMaterial = new MeshStandardMaterial({
  color: "#f4f7fb",
  roughness: 0.75,
  flatShading: true,
});
const rainMaterial = new MeshStandardMaterial({
  color: "#c3ccd6",
  roughness: 0.7,
  flatShading: true,
});
const snowCloudMaterial = new MeshStandardMaterial({
  color: "#e9eef5",
  roughness: 0.75,
  flatShading: true,
});
const materialFor = (variant: CloudVariant): MeshStandardMaterial =>
  variant === "rain"
    ? rainMaterial
    : variant === "snow"
      ? snowCloudMaterial
      : plainMaterial;

// A single lobe layout, reused (scaled/tinted per variant) by every cloud -
// a shrinking row of puffs plus a couple stacked on top for volume.
const LOBE_LAYOUT: { geo: number; x: number; y: number; z: number }[] = [
  { geo: 0, x: 0, y: 0, z: 0 },
  { geo: 1, x: 0.75, y: -0.05, z: 0.05 },
  { geo: 2, x: 1.35, y: -0.1, z: -0.05 },
  { geo: 3, x: 1.8, y: -0.12, z: 0.05 },
  { geo: 1, x: -0.6, y: 0.05, z: -0.1 },
  { geo: 2, x: 0.25, y: 0.42, z: 0.1 },
];

const rainGeometry = new CylinderGeometry(0.02, 0.02, 0.5, 4);
const rainMeshMaterial = new MeshStandardMaterial({
  color: "#7dd3fc",
  transparent: true,
  opacity: 0.55,
  roughness: 0.3,
});
const snowGeometry = new SphereGeometry(0.05, 6, 6);
const snowMeshMaterial = new MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.4,
});

const UP = new Vector3(0, 1, 0);
const FALL_SPAN = 2.5;

export interface CloudProps {
  position: Vector3;
  normal: Vector3;
  scale?: number;
  variant?: CloudVariant;
  /** How many rain streaks / snow particles fall beneath it ("rain"/"snow" variants only). */
  precipitationCount?: number;
}

/**
 * A low-poly puffy cloud (a shrinking row of icosahedron lobes, per the
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
      Array.from({ length: precipitationCount }, (_, i) => ({
        x: (Math.sin(i * 12.9) * 0.5 - 0.25) * 1.6,
        z: (Math.sin(i * 7.7 + 1) * 0.5 - 0.25) * 1.2,
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
      mesh.position.y = -0.4 - fall;
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
            position={[drop.x, -0.4, drop.z]}
          />
        ))}
      {variant === "snow" &&
        dropOffsets.map((drop, i) => (
          <mesh
            key={i}
            ref={(el) => (dropRefs.current[i] = el)}
            geometry={snowGeometry}
            material={snowMeshMaterial}
            position={[drop.x, -0.4, drop.z]}
          />
        ))}
    </group>
  );
};

export default Cloud;
