import { useMemo } from "react";
import { buildSurfaceOrientation } from "../../utils/planetSurface";
import {
  GEOLOGY_GEOMETRY,
  ROCK_COLORS,
  archLayout,
  boulderClusterLayout,
  desertFeatureLayout,
  pineScale,
  propQuaternion,
  propSpin,
  snowPropLayout,
  surfaceQuaternion,
  type GeologyLayout,
  type GeologyTone,
} from "./geology";
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
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

/** Aligns a prop's local +Y to the surface normal, then spins it about that normal. */
const useSurfaceQuaternion = (normal: Vector3, spin: number): Quaternion =>
  useMemo(() => surfaceQuaternion(normal, spin), [normal, spin]);

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

// Slate blue-grey rock, pure white snow, and glassy ice.
const ridgeRockMaterial = new MeshStandardMaterial({
  color: ROCK_COLORS.snow,
  roughness: 0.6,
  flatShading: true,
});
const snowCapMaterial = new MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.5,
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

// --- rock: one palette per biome -----------------------------------------

const rockMaterial = (color: string, roughness: number) =>
  new MeshStandardMaterial({ color, roughness, flatShading: true });

export type Biome = keyof typeof ROCK_COLORS;

/**
 * Each biome's rock tones, so a stone reads as belonging to the land it sits
 * on: its main rock (ROCK_COLORS - terracotta, slate, dark granite), a paler
 * band for strata and smaller stones, and its loose ground - sand on the
 * desert, ice on the snow.
 */
export const BIOME_ROCK_MATERIALS: Record<
  Biome,
  Record<GeologyTone, MeshStandardMaterial>
> = {
  desert: {
    rock: rockMaterial(ROCK_COLORS.desert, 0.85),
    band: rockMaterial("#d0844f", 0.88),
    // A touch warmer than the #e3c896 desert floor, so dunes read against it.
    ground: rockMaterial("#d8b47e", 0.95),
  },
  snow: {
    rock: ridgeRockMaterial,
    band: rockMaterial("#71819a", 0.6),
    // Glossier and a shade bluer than the #e8f4f8 shelf, or an icy hillock
    // would vanish into the ground it stands on.
    ground: new MeshStandardMaterial({
      color: "#cfe5f0",
      roughness: 0.3,
      flatShading: true,
    }),
  },
  forest: {
    rock: rockMaterial(ROCK_COLORS.forest, 0.8),
    band: rockMaterial("#5f6a7d", 0.8),
    ground: rockMaterial(ROCK_COLORS.forest, 0.8),
  },
};

/** Renders a geology layout (see geology.ts): each part a scaled copy of one shared mesh. */
const GeologyParts = ({
  layout,
  biome,
}: {
  layout: GeologyLayout;
  biome: Biome;
}) => (
  <>
    {layout.parts.map((part, i) => (
      <mesh
        key={i}
        geometry={GEOLOGY_GEOMETRY[part.shape]}
        material={BIOME_ROCK_MATERIALS[biome][part.tone]}
        position={part.position}
        quaternion={part.quaternion}
        scale={part.scale}
        castShadow
        receiveShadow
      />
    ))}
  </>
);

export interface GeologyProps extends FeatureProps {
  /** The planet's radius: how fast the ground curves away under a wide prop. */
  planetRadius: number;
}

/** A geology layout stood on its own spot of the planet. */
const GeologyProp = ({
  position,
  normal,
  seed,
  layout,
  biome,
}: FeatureProps & { layout: GeologyLayout; biome: Biome }) => {
  const quaternion = useMemo(
    () => propQuaternion(layout, normal, seed),
    [layout, normal, seed],
  );
  return (
    <group position={position} quaternion={quaternion}>
      <GeologyParts layout={layout} biome={biome} />
    </group>
  );
};

/**
 * A frosted pine, a low icy hillock or a cluster of slate boulders at the foot
 * of the range - small props that give the mountains a sense of scale.
 */
export const SnowProp = ({
  position,
  normal,
  seed,
  planetRadius,
}: GeologyProps) => {
  const layout = useMemo(
    () => snowPropLayout(seed, planetRadius),
    [seed, planetRadius],
  );
  const quaternion = useMemo(
    () =>
      layout
        ? propQuaternion(layout, normal, seed)
        : surfaceQuaternion(normal, propSpin(seed)),
    [layout, normal, seed],
  );

  if (layout) {
    return (
      <group position={position} quaternion={quaternion}>
        <GeologyParts layout={layout} biome="snow" />
      </group>
    );
  }

  return (
    <group position={position} quaternion={quaternion} scale={pineScale(seed)}>
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

// --- desert: dunes, boulders, terraced mesas and arches -------------------

/**
 * One piece of desert texture - a dune, a boulder cluster or a terraced mesa
 * ringed with gravel (see geology.ts). The mix is what keeps the desert from
 * reading as a single unbroken sheet of tan.
 */
export const DesertFeature = ({
  position,
  normal,
  seed,
  planetRadius,
}: GeologyProps) => {
  const layout = useMemo(
    () => desertFeatureLayout(seed, planetRadius),
    [seed, planetRadius],
  );
  return (
    <GeologyProp
      position={position}
      normal={normal}
      seed={seed}
      layout={layout}
      biome="desert"
    />
  );
};

/** A natural sandstone arch standing on open sand. */
export const RockArch = ({
  position,
  normal,
  seed,
  planetRadius,
}: GeologyProps) => {
  const layout = useMemo(
    () => archLayout(seed, planetRadius),
    [seed, planetRadius],
  );
  return (
    <GeologyProp
      position={position}
      normal={normal}
      seed={seed}
      layout={layout}
      biome="desert"
    />
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

/** Dark granite boulders among the forest's trees. */
export const ForestRocks = ({
  position,
  normal,
  seed,
  planetRadius,
}: GeologyProps) => {
  const layout = useMemo(
    () => boulderClusterLayout(seed, planetRadius),
    [seed, planetRadius],
  );
  return (
    <GeologyProp
      position={position}
      normal={normal}
      seed={seed}
      layout={layout}
      biome="forest"
    />
  );
};
