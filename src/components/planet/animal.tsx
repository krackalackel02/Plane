import { useMemo } from "react";
import {
  BoxGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

export type AnimalVariant = "sheep" | "cow";

// Shared across every animal instance, like the trees above.
const legGeometry = new BoxGeometry(0.12, 0.35, 0.12);
const sheepBodyGeometry = new IcosahedronGeometry(0.42, 0);
const sheepHeadGeometry = new BoxGeometry(0.22, 0.22, 0.26);
const cowBodyGeometry = new BoxGeometry(0.75, 0.42, 0.42);
const cowHeadGeometry = new BoxGeometry(0.26, 0.26, 0.3);
const cowPatchGeometry = new BoxGeometry(0.3, 0.22, 0.44);

const sheepWoolMaterial = new MeshStandardMaterial({
  color: "#f5f1e8",
  roughness: 0.85,
  flatShading: true,
});
const sheepFaceMaterial = new MeshStandardMaterial({
  color: "#3a3a3a",
  roughness: 0.6,
});
const cowBodyMaterial = new MeshStandardMaterial({
  color: "#f2f2f2",
  roughness: 0.7,
  flatShading: true,
});
const cowPatchMaterial = new MeshStandardMaterial({
  color: "#2b2b2b",
  roughness: 0.7,
  flatShading: true,
});

const UP = new Vector3(0, 1, 0);

export interface AnimalProps {
  position: Vector3;
  normal: Vector3;
  /** Rotation around the surface normal (facing direction), radians. */
  heading: number;
  variant: AnimalVariant;
  scale?: number;
}

/**
 * A simple low-poly grazing animal, standing upright on the surface (local
 * +Y aligned to the outward normal, same "surface-normal alignment"
 * convention as trees/clouds), facing an arbitrary heading so a herd
 * doesn't all stare the same way.
 */
const Animal = ({
  position,
  normal,
  heading,
  variant,
  scale = 1,
}: AnimalProps) => {
  const quaternion = useMemo(() => {
    const align = new Quaternion().setFromUnitVectors(UP, normal);
    const spin = new Quaternion().setFromAxisAngle(normal, heading);
    return spin.multiply(align);
  }, [normal, heading]);

  const isSheep = variant === "sheep";

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      {[
        [0.22, 0.18, 0.15],
        [0.22, 0.18, -0.15],
        [-0.22, 0.18, 0.15],
        [-0.22, 0.18, -0.15],
      ].map(([x, y, z], i) => (
        <mesh
          key={i}
          geometry={legGeometry}
          material={isSheep ? sheepFaceMaterial : cowPatchMaterial}
          position={[x, y, z]}
          castShadow
        />
      ))}
      {isSheep ? (
        <>
          <mesh
            geometry={sheepBodyGeometry}
            material={sheepWoolMaterial}
            position={[0, 0.42, 0]}
            castShadow
          />
          <mesh
            geometry={sheepHeadGeometry}
            material={sheepFaceMaterial}
            position={[0.42, 0.44, 0]}
            castShadow
          />
        </>
      ) : (
        <>
          <mesh
            geometry={cowBodyGeometry}
            material={cowBodyMaterial}
            position={[0, 0.4, 0]}
            castShadow
          />
          <mesh
            geometry={cowPatchGeometry}
            material={cowPatchMaterial}
            position={[-0.15, 0.48, 0]}
            castShadow
          />
          <mesh
            geometry={cowHeadGeometry}
            material={cowBodyMaterial}
            position={[0.55, 0.42, 0]}
            castShadow
          />
        </>
      )}
    </group>
  );
};

export default Animal;
