import { useMemo } from "react";
import {
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

/**
 * The props that give each biome its texture: a mountain range on the snow
 * continent, rocks/dunes/mesas on the desert, and low shrubs filling in
 * between the forest's trees. Without these each landmass renders as one
 * enormous flat slab of a single colour.
 *
 * Every geometry and material here is shared across all instances rather than
 * created per mesh - there are a couple of hundred of these in the scene, and
 * they're only a handful of distinct shapes.
 */

const WORLD_UP = new Vector3(0, 1, 0);

/** Aligns a prop's local +Y to the surface normal, then spins it about that normal. */
const useSurfaceQuaternion = (normal: Vector3, spin: number): Quaternion =>
  useMemo(() => {
    const align = new Quaternion().setFromUnitVectors(WORLD_UP, normal);
    return new Quaternion().setFromAxisAngle(normal, spin).multiply(align);
  }, [normal, spin]);

// --- snow: mountain ridges ----------------------------------------------

// Few radial segments, so each cone is a faceted, asymmetric wedge rather
// than a smooth circular pyramid - and rotating each instance about its own
// axis makes the facets of neighbouring segments disagree, which is what
// stops a chain reading as a row of identical cones.
const ridgeGeometry = new ConeGeometry(1, 1, 5);
const ridgeCapGeometry = new ConeGeometry(1, 1, 5);
const hillockGeometry = new IcosahedronGeometry(1, 0);

// Slate blue-grey rock under pure white caps, on an ice-blue ground.
const ridgeRockMaterial = new MeshStandardMaterial({
  color: "#52627a",
  roughness: 0.6,
  flatShading: true,
});
const snowCapMaterial = new MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.5,
  flatShading: true,
});
const iceMaterial = new MeshStandardMaterial({
  color: "#e8f4f8",
  roughness: 0.65,
  flatShading: true,
});

/** Fraction of a peak's height covered by its snow cap. */
const SNOW_CAP_FRACTION = 0.4;

export interface FeatureProps {
  position: Vector3;
  normal: Vector3;
  seed: number;
}

export interface RidgeProps extends FeatureProps {
  /** Compass bearing the ridge line runs along, radians. */
  bearing: number;
  height: number;
  width: number;
}

/**
 * One segment of a mountain ridge: a faceted rock wedge with a pure-white cap
 * over its top SNOW_CAP_FRACTION.
 *
 * Segments are placed close enough together along a chain (see scatterRidges)
 * that they interpenetrate, so a run of them renders as one continuous crest
 * rather than separate summits. Each is deliberately asymmetric - squashed
 * across the ridge line, stretched along it, and rolled slightly off vertical
 * by its own seed - because a row of upright symmetric cones is exactly what
 * reads as artificial. The snow cap is rotated independently of the rock
 * beneath it, which breaks the snowline into an irregular, wavy join instead
 * of a clean horizontal ring.
 */
export const Ridge = ({
  position,
  normal,
  seed,
  bearing,
  height,
  width,
}: RidgeProps) => {
  // Align up to the surface, then turn so the segment's long axis follows the
  // ridge line, then lean it a little off plumb.
  const quaternion = useMemo(() => {
    const align = new Quaternion().setFromUnitVectors(WORLD_UP, normal);
    const turn = new Quaternion().setFromAxisAngle(normal, bearing);
    const lean = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      (seed - 0.5) * 0.24,
    );
    return turn.multiply(align).multiply(lean);
  }, [normal, bearing, seed]);

  // Narrow across the ridge, long along it - a crest, not a pyramid.
  const across = width * (0.72 + seed * 0.3);
  const along = width * (1.35 + seed * 0.55);
  const capHeight = height * SNOW_CAP_FRACTION;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={ridgeGeometry}
        material={ridgeRockMaterial}
        position={[0, height / 2, 0]}
        rotation={[0, seed * Math.PI * 2, 0]}
        scale={[across, height, along]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={ridgeCapGeometry}
        material={snowCapMaterial}
        position={[0, height - capHeight / 2, 0]}
        // A different spin from the rock below, so the two faceted silhouettes
        // disagree and the snowline comes out wavy rather than a clean ring.
        rotation={[0, seed * Math.PI * 2 + 0.7, 0]}
        scale={[
          across * SNOW_CAP_FRACTION * 1.08,
          capHeight,
          along * SNOW_CAP_FRACTION * 1.08,
        ]}
        castShadow
      />
    </group>
  );
};

/**
 * A low icy hillock or a frosted pine at the foot of the range - small props
 * that give the mountains a sense of scale.
 */
export const SnowProp = ({ position, normal, seed }: FeatureProps) => {
  const quaternion = useSurfaceQuaternion(normal, seed * Math.PI * 2);
  const isPine = seed > 0.55;

  if (isPine) {
    const scale = 0.7 + seed * 0.8;
    return (
      <group position={position} quaternion={quaternion} scale={scale}>
        <mesh
          geometry={frostedTrunkGeometry}
          material={frostedTrunkMaterial}
          position={[0, 0.35, 0]}
          castShadow
        />
        <mesh
          geometry={frostedPineGeometry}
          material={frostedPineMaterial}
          position={[0, 1.1, 0]}
          castShadow
        />
        <mesh
          geometry={frostedPineGeometry}
          material={snowCapMaterial}
          position={[0, 1.62, 0]}
          scale={0.62}
          castShadow
        />
      </group>
    );
  }

  const width = 1.1 + seed * 2.2;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={hillockGeometry}
        material={iceMaterial}
        scale={[width, 0.4 + seed * 0.5, width * 0.78]}
        castShadow
        receiveShadow
      />
    </group>
  );
};

const frostedTrunkGeometry = new CylinderGeometry(0.07, 0.11, 0.7, 5);
const frostedPineGeometry = new ConeGeometry(0.45, 1.1, 6);
const frostedTrunkMaterial = new MeshStandardMaterial({
  color: "#5d5148",
  roughness: 0.9,
});
const frostedPineMaterial = new MeshStandardMaterial({
  color: "#2f5d4a",
  roughness: 0.7,
  flatShading: true,
});

// --- desert: rocks, dunes and mesas --------------------------------------

const boulderGeometry = new IcosahedronGeometry(1, 0);
const duneGeometry = new SphereGeometry(1, 8, 5);
const mesaGeometry = new CylinderGeometry(1, 1.25, 1, 7);

const sandstoneMaterial = new MeshStandardMaterial({
  color: "#c8a06a",
  roughness: 0.9,
  flatShading: true,
});
const duneMaterial = new MeshStandardMaterial({
  color: "#dcbe8e",
  roughness: 0.95,
  flatShading: true,
});
const mesaMaterial = new MeshStandardMaterial({
  color: "#b98e5c",
  roughness: 0.88,
  flatShading: true,
});

/**
 * One piece of desert texture, chosen off its own seed: a low wind-smoothed
 * dune, a cluster of sandstone boulders, or a flat-topped mesa. The mix is
 * what keeps the desert from reading as a single unbroken sheet of tan.
 */
export const DesertFeature = ({ position, normal, seed }: FeatureProps) => {
  const quaternion = useSurfaceQuaternion(normal, seed * Math.PI * 2);
  const kind = seed < 0.45 ? "dune" : seed < 0.8 ? "rocks" : "mesa";

  if (kind === "dune") {
    const width = 2.6 + seed * 5;
    const height = 0.5 + seed * 0.9;
    return (
      <group position={position} quaternion={quaternion}>
        <mesh
          geometry={duneGeometry}
          material={duneMaterial}
          scale={[width, height, width * 0.62]}
          castShadow
          receiveShadow
        />
      </group>
    );
  }

  if (kind === "mesa") {
    const width = 1.8 + seed * 1.6;
    const height = 1.6 + seed * 2.4;
    return (
      <group position={position} quaternion={quaternion}>
        <mesh
          geometry={mesaGeometry}
          material={mesaMaterial}
          position={[0, height / 2, 0]}
          scale={[width, height, width]}
          castShadow
          receiveShadow
        />
      </group>
    );
  }

  const scale = 0.5 + seed * 0.7;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={boulderGeometry}
        material={sandstoneMaterial}
        position={[0, scale * 0.55, 0]}
        scale={scale}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={boulderGeometry}
        material={sandstoneMaterial}
        position={[scale * 1.35, scale * 0.35, scale * 0.5]}
        scale={scale * 0.62}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={boulderGeometry}
        material={sandstoneMaterial}
        position={[-scale * 1.1, scale * 0.3, -scale * 0.7]}
        scale={scale * 0.5}
        castShadow
        receiveShadow
      />
    </group>
  );
};

// --- forest: bushes and shrubs -------------------------------------------

const bushGeometry = new IcosahedronGeometry(0.5, 0);
const shrubMaterialDark = new MeshStandardMaterial({
  color: "#2f7a3c",
  roughness: 0.7,
  flatShading: true,
});
const shrubMaterialLight = new MeshStandardMaterial({
  color: "#68b348",
  roughness: 0.7,
  flatShading: true,
});

/**
 * A low clump of shrubbery - two or three overlapping lobes at ground level.
 * Much smaller than a tree, and far more numerous, which is what makes the
 * forest floor read as undergrowth rather than bare lawn between trunks.
 */
export const Bush = ({ position, normal, seed }: FeatureProps) => {
  const quaternion = useSurfaceQuaternion(normal, seed * Math.PI * 2);
  const scale = 0.55 + seed * 0.75;
  const material = seed > 0.5 ? shrubMaterialLight : shrubMaterialDark;

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <mesh
        geometry={bushGeometry}
        material={material}
        position={[0, 0.4, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={bushGeometry}
        material={material}
        position={[0.42, 0.28, 0.2]}
        scale={0.68}
        castShadow
      />
      <mesh
        geometry={bushGeometry}
        material={material}
        position={[-0.36, 0.26, -0.24]}
        scale={0.58}
        castShadow
      />
    </group>
  );
};
