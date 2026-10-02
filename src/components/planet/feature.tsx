import { useMemo } from "react";
import { buildSurfaceOrientation } from "../../utils/planetSurface";
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
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

type Vec3 = [number, number, number];

/**
 * A closed low-poly solid from vertices and triangles, wound so every face
 * points outward (away from `inside`), flat-shaded. Building the mountain by
 * hand rather than from a cone is what gives it a ridge *line* along the top -
 * an arete - instead of a single point.
 */
const solid = (
  vertices: Vec3[],
  faces: [number, number, number][],
  inside: Vec3,
): BufferGeometry => {
  const out: number[] = [];
  for (const [ia, ib, ic] of faces) {
    const a = vertices[ia];
    let [b, c] = [vertices[ib], vertices[ic]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const centroid = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    const outward = [
      centroid[0] - inside[0],
      centroid[1] - inside[1],
      centroid[2] - inside[2],
    ];
    if (
      normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] <
      0
    )
      [b, c] = [c, b];
    out.push(...a, ...b, ...c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(out, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * One crest segment, its ridge line running along local Z: an irregular
 * hexagonal base rising to two summit points, the far one a little lower so
 * the crest is asymmetric. Base at y = 0, summit at y = 1, unit footprint.
 */
const CREST_VERTICES: Vec3[] = [
  [0.0, 0, 1.0],
  [0.72, 0, 0.5],
  [0.78, 0, -0.52], // base, one side
  [0.0, 0, -1.0],
  [-0.7, 0, -0.48],
  [-0.8, 0, 0.55], // base, other side
  [0.04, 1, 0.42],
  [-0.05, 0.9, -0.44], // the arete
];
const CREST_FACES: [number, number, number][] = [
  [0, 1, 6],
  [1, 2, 6],
  [2, 7, 6],
  [2, 3, 7],
  [3, 4, 7],
  [4, 5, 7],
  [5, 6, 7],
  [5, 0, 6],
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 4],
  [0, 4, 5], // underside
];
// Which summit each base vertex's flank rises to.
const SUMMIT_OF = [6, 6, 7, 7, 7, 6];
/** The snow cap covers this top fraction of each peak. */
const SNOW_CAP_FRACTION = 0.4;
const crestGeometry = solid(CREST_VERTICES, CREST_FACES, [0, 0.35, 0]);

/**
 * The snow cap: the rock's own cross-section a little below SNOW_CAP_FRACTION
 * from the top, up to the same arete, inflated a touch so it sits proud of the
 * rock instead of z-fighting with it. Each base corner is cut at a slightly
 * different height along its flank, which is what makes the snowline wavy and
 * irregular rather than a level ring. Built in the rock's own unit space, so
 * the cap mesh shares the rock's transform exactly.
 */
const capGeometry = (() => {
  // Where along each flank the snowline sits, as a fraction of the way to the
  // summit: SNOW_CAP_FRACTION from the top, give or take a little per corner.
  const cuts = [-0.04, 0.06, -0.02, 0.04, -0.05, 0.02].map(
    (jitter) => 1 - SNOW_CAP_FRACTION + jitter,
  );
  const vertices: Vec3[] = CREST_VERTICES.map((v, i) => {
    if (i >= 6) return v;
    const top = CREST_VERTICES[SUMMIT_OF[i]];
    const t = cuts[i];
    return [
      v[0] + (top[0] - v[0]) * t,
      v[1] + (top[1] - v[1]) * t,
      v[2] + (top[2] - v[2]) * t,
    ];
  });
  const pivot: Vec3 = [0, 0.78, 0];
  const inflated = vertices.map(
    (v): Vec3 => [
      pivot[0] + (v[0] - pivot[0]) * 1.05,
      pivot[1] + (v[1] - pivot[1]) * 1.03,
      pivot[2] + (v[2] - pivot[2]) * 1.05,
    ],
  );
  return solid(inflated, CREST_FACES, [0, 0.8, 0]);
})();
const iceSlabGeometry = new BoxGeometry(1, 0.14, 1.5);
const hillockGeometry = new IcosahedronGeometry(1, 0);

// Slate blue-grey rock, pure white snow, ice-blue ground and ice.
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
const iceSlabMaterial = new MeshStandardMaterial({
  color: "#cfe7f2",
  roughness: 0.25,
  metalness: 0.05,
  flatShading: true,
});

// How far a segment's base sinks into the ground, so it merges into the ice
// shelf instead of sitting on it with a visible seam.
const RIDGE_EMBED = 0.25;

export interface FeatureProps {
  position: Vector3;
  normal: Vector3;
  seed: number;
}

export interface RidgeProps extends FeatureProps {
  /** Unit tangent: the direction the chain runs here. */
  along: Vector3;
  height: number;
  width: number;
}

/**
 * One segment of a mountain chain: a slate crest with its arete running along
 * the chain, a white cap over its top SNOW_CAP_FRACTION, and - on the taller
 * peaks - an ice slab jutting from one flank.
 *
 * Segments overlap their neighbours along the chain, so a run of them renders
 * as one continuous crest. Each is a little asymmetric (stretched along the
 * chain, squashed across it, leant off plumb by its own seed); a row of
 * upright identical shapes is exactly what reads as artificial.
 */
export const Ridge = ({
  position,
  normal,
  seed,
  along,
  height,
  width,
}: RidgeProps) => {
  const quaternion = useMemo(() => {
    const base = buildSurfaceOrientation(normal, along);
    const lean = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (seed - 0.5) * 0.2,
    );
    return base.multiply(lean);
  }, [normal, along, seed]);

  const across = width * (0.85 + seed * 0.25);
  const length = width * (1.5 + seed * 0.4);
  const hasIce = seed > 0.62 && height > 4.5;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={crestGeometry}
        material={ridgeRockMaterial}
        position={[0, -RIDGE_EMBED, 0]}
        scale={[across, height + RIDGE_EMBED, length]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={capGeometry}
        material={snowCapMaterial}
        // Same transform as the rock: the cap was built in its unit space.
        position={[0, -RIDGE_EMBED, 0]}
        scale={[across, height + RIDGE_EMBED, length]}
        castShadow
      />
      {hasIce && (
        <mesh
          geometry={iceSlabGeometry}
          material={iceSlabMaterial}
          position={[
            across * (seed > 0.8 ? 0.45 : -0.45),
            height * 0.55,
            length * 0.1,
          ]}
          rotation={[0.15, seed * 0.8, seed > 0.8 ? -0.55 : 0.55]}
          scale={[width * 0.7, 1, width * 0.6]}
          castShadow
        />
      )}
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
