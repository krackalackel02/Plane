import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { eastNorthAt } from "../../utils/planetSurface";

/**
 * The biomes' rock and sand props as pure layout: which pieces each prop is
 * built from, and where every piece sits in the prop's own frame - +Y along
 * the surface normal, the point it stands on at the origin. feature.tsx
 * renders exactly these parts and the tests measure exactly these parts
 * (every piece meets the ground, nothing overhangs the coast, the rocks
 * genuinely vary), so what's tested is what's drawn.
 */

export type Vec3 = [number, number, number];

/** Per-biome rock: terracotta sandstone, slate, dark granite. */
export const ROCK_COLORS = {
  desert: "#b85b37",
  snow: "#52627a",
  forest: "#4a5568",
} as const;

const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

/** An independent 0..1 draw from a seed, so a prop's size isn't tied to its kind. */
export const reseed = (seed: number, salt: number): number => {
  const x = Math.sin(seed * 9301.7 + salt * 49297.3) * 233280.9;
  return x - Math.floor(x);
};

// --- the shared unit meshes ------------------------------------------------

// A mesa stratum: a slab with this many sides, tapering slightly to its top
// face...
const TERRACE_SIDES = 10;
const TERRACE_TOP = 0.96;
// ...whose top face holds a circle this big, however the slab is turned.
export const TERRACE_TOP_INNER =
  TERRACE_TOP * Math.cos(Math.PI / TERRACE_SIDES);
// An icosahedron's inscribed sphere, as a fraction of its circumradius.
const ICOSAHEDRON_INRADIUS = 0.7947;

/**
 * A dune: an ellipsoid reshaped so it rises from the sand in a gentle,
 * concave toe to a peaked crest, and with that crest pushed downwind (+X) -
 * a long windward back and a short, steep slip face, which is what makes a
 * mound of sand read as a dune rather than a pebble. Widest at y = 0, where
 * neither reshaping applies, so its footprint is still the unit circle.
 */
const buildDuneGeometry = (): BufferGeometry => {
  const geometry = new SphereGeometry(1, 12, 8);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    if (y <= 0) continue;
    positions.setX(i, x + 0.6 * y * (1 - Math.abs(x)));
    positions.setY(i, y ** 1.7);
  }
  geometry.computeVertexNormals();
  return geometry;
};

// Rings along the arch, and corners round each ring.
const ARCH_RINGS = 14;
const ARCH_SIDES = 6;

/**
 * The arch's fin as one swept solid: an irregular six-sided cross-section
 * carried along a slightly lopsided half-circle, flared where it meets the
 * ground and thinning to a slender crown - a carved rock span rather than a
 * bent pipe. Unit space: the feet stand on y = 0 round x = +-1, the crown
 * near y = 1. Each foot's ring lies exactly flat on y = 0, open, to be buried.
 */
const buildArchGeometry = (): BufferGeometry => {
  const rings: Vector3[][] = [];
  const centres: Vector3[] = [];
  for (let k = 0; k <= ARCH_RINGS; k++) {
    const t = k / ARCH_RINGS;
    const u = Math.PI * t;
    const foot = k === 0 || k === ARCH_RINGS;
    // Lopsided: the crown sits a little off-centre.
    const centre = new Vector3(
      Math.cos(u) - 0.07 * Math.sin(2 * u),
      foot ? 0 : Math.sin(u),
      0,
    );
    // Outward from the arch's middle, within its plane - horizontal at the
    // feet, so each foot's ring lies flat.
    const outward = new Vector3(Math.cos(u), foot ? 0 : Math.sin(u), 0);
    outward.normalize();
    const legness = Math.abs(2 * t - 1) ** 1.6;
    const flare = foot ? 1.2 : 1;
    const radial = (0.14 + 0.15 * legness) * flare; // within the arch's plane
    const depth = (0.2 + 0.12 * legness) * flare; // across it
    const ringSeed = 0.5 + k * 0.13;
    const ring: Vector3[] = [];
    for (let j = 0; j < ARCH_SIDES; j++) {
      const phi = (j / ARCH_SIDES) * TAU + (reseed(ringSeed, j) - 0.5) * 0.4;
      ring.push(
        centre
          .clone()
          .addScaledVector(
            outward,
            Math.cos(phi) * radial * (0.85 + reseed(ringSeed, 10 + j) * 0.3),
          )
          .add(
            new Vector3(
              0,
              0,
              Math.sin(phi) * depth * (0.85 + reseed(ringSeed, 20 + j) * 0.3),
            ),
          ),
      );
    }
    rings.push(ring);
    centres.push(centre);
  }

  // Two triangles per quad between neighbouring rings, each wound to face
  // away from the fin's own centreline there.
  const out: number[] = [];
  const pushOutward = (a: Vector3, b: Vector3, c: Vector3, axis: Vector3) => {
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    const [p, q] = normal.dot(centroid.sub(axis)) < 0 ? [c, b] : [b, c];
    out.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
  };
  for (let k = 0; k < ARCH_RINGS; k++) {
    const axis = centres[k]
      .clone()
      .add(centres[k + 1])
      .multiplyScalar(0.5);
    for (let j = 0; j < ARCH_SIDES; j++) {
      const next = (j + 1) % ARCH_SIDES;
      const a = rings[k][j];
      const b = rings[k][next];
      const c = rings[k + 1][next];
      const d = rings[k + 1][j];
      pushOutward(a, b, c, axis);
      pushOutward(a, c, d, axis);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(out, 3));
  geometry.computeVertexNormals();
  return geometry;
};

export type GeologyShape = "terrace" | "dune" | "rock" | "arch";

/**
 * The unit meshes every part is a scaled copy of, shared by every prop: a
 * ten-sided slab for mesa strata, a wind-sheared mound for dunes, an
 * icosahedron for anything rocky, and the swept arch fin.
 */
export const GEOLOGY_GEOMETRY: Record<GeologyShape, BufferGeometry> = {
  terrace: new CylinderGeometry(TERRACE_TOP, 1, 1, TERRACE_SIDES),
  dune: buildDuneGeometry(),
  rock: new IcosahedronGeometry(1, 0),
  arch: buildArchGeometry(),
};

// --- layout ------------------------------------------------------------------

/**
 * How a part meets whatever is under it - which is also what the tests check:
 * - "rim": stands on the ground all the way round (dunes, hillocks, a mesa's
 *   bottom stratum), so its outer edge must reach the ground on every side;
 * - "base": a compact rock that only needs its underside buried;
 * - "ends": the arch, whose two open feet must be buried and nothing else;
 * - "stacked": rests on the part below it rather than on the ground.
 */
export type GeologyContact = "rim" | "base" | "ends" | "stacked";

/** Which of its biome's materials a part takes: main rock, paler band, or loose ground (sand, ice). */
export type GeologyTone = "rock" | "band" | "ground";

export interface GeologyPart {
  shape: GeologyShape;
  contact: GeologyContact;
  tone: GeologyTone;
  position: Vec3;
  quaternion: Quaternion;
  scale: Vec3;
}

export interface GeologyLayout {
  parts: GeologyPart[];
  /** How far any part reaches across the ground from the prop's own centre. */
  footprint: number;
  /**
   * Turned to the prevailing wind rather than spun at random: local +X runs
   * downwind (see propQuaternion). Dunes, so a dune field lines up.
   */
  downwind?: boolean;
}

// How far past the ground itself a grounded piece is sunk, so it reads as
// rooted in the surface rather than balanced on it.
const EMBED = 0.08;

/** Spins about the local vertical, after leaning `tilt` radians toward bearing `lean`. */
const orientation = (spin: number, tilt = 0, lean = 0): Quaternion =>
  new Quaternion()
    .setFromAxisAngle(UP, spin)
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(Math.cos(lean), 0, Math.sin(lean)),
        tilt,
      ),
    );

/**
 * A prop's orientation on the planet: local +Y up the surface normal, spun
 * about it. The single definition the renderer and the tests share.
 */
export const surfaceQuaternion = (normal: Vector3, spin: number): Quaternion =>
  new Quaternion()
    .setFromAxisAngle(normal, spin)
    .multiply(new Quaternion().setFromUnitVectors(UP, normal));

/** How a whole prop is spun about its own surface normal. */
export const propSpin = (seed: number): number => reseed(seed, 7) * TAU;

/**
 * Local +X due east - the prevailing wind's downwind direction - +Y up the
 * normal, then turned `jitter` radians about it.
 */
const windQuaternion = (normal: Vector3, jitter: number): Quaternion => {
  const { east } = eastNorthAt(normal);
  const south = east.clone().cross(normal);
  return new Quaternion()
    .setFromRotationMatrix(new Matrix4().makeBasis(east, normal, south))
    .multiply(new Quaternion().setFromAxisAngle(UP, jitter));
};

/** Where a layout faces on the planet: downwind for dunes, otherwise spun by its seed. */
export const propQuaternion = (
  layout: GeologyLayout,
  normal: Vector3,
  seed: number,
): Quaternion =>
  layout.downwind
    ? windQuaternion(normal, (reseed(seed, 8) - 0.5) * 0.4)
    : surfaceQuaternion(normal, propSpin(seed));

/**
 * How far the planet's surface has fallen away below a prop's own tangent
 * plane at `distance` from its centre. A wide piece built flat on that plane
 * would hover by this much at its edge, so every grounded piece is lowered by
 * it. Pass the planet's bare radius: the true ground sits a little further out
 * (it adds the land's height), so this slightly overestimates the fall -
 * sinking a piece a hair too deep rather than leaving it floating.
 */
export const groundDrop = (distance: number, curvatureRadius: number): number =>
  curvatureRadius -
  Math.sqrt(Math.max(0, curvatureRadius ** 2 - distance ** 2));

/**
 * A boulder or pebble on the ground at (x, z): scaled, spun and leaned off
 * plumb. Any line through an icosahedron's centre reaches at least its
 * inscribed radius, so with its centre this low it is buried by over half its
 * narrowest radius whichever way it leans - and it is lowered further by the
 * ground's fall-away at its far edge, not just at its centre.
 */
const groundedRock = (
  x: number,
  z: number,
  scale: Vec3,
  spin: number,
  tilt: number,
  lean: number,
  tone: GeologyTone,
  curvatureRadius: number,
): GeologyPart => {
  const narrowest = Math.min(...scale) * ICOSAHEDRON_INRADIUS;
  const reach = Math.hypot(x, z) + Math.max(...scale);
  return {
    shape: "rock",
    contact: "base",
    tone,
    position: [x, narrowest * 0.4 - groundDrop(reach, curvatureRadius), z],
    quaternion: orientation(spin, tilt, lean),
    scale,
  };
};

const PEBBLE_TONES: GeologyTone[] = ["band", "rock", "ground"];

/**
 * A terraced sandstone mesa: three or four strata, each a little oval, set a
 * little off-centre and stepped in from the one beneath, banded alternately
 * terracotta and ochre and flat on top - with clumps of gravel weathered off
 * it lying round its foot.
 */
export const mesaLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  const baseRadius = 2.2 + reseed(seed, 1) * 1.6;
  const strata = 3 + Math.round(reseed(seed, 2));
  const stratumHeight = 0.8 + reseed(seed, 3) * 0.4;

  const parts: GeologyPart[] = [];
  // Each stratum's widest and narrowest radius (it's an oval).
  let major = baseRadius;
  let minor = baseRadius * (0.88 + reseed(seed, 4) * 0.12);
  let x = 0;
  let z = 0;
  let bottom = -(groundDrop(major, curvatureRadius) + EMBED);
  for (let i = 0; i < strata; i++) {
    if (i > 0) {
      // Its widest reach fits inside the circle the stratum below's top face
      // holds, with room left over to sit off-centre without overhanging -
      // an overhang would float.
      const room = TERRACE_TOP_INNER * minor;
      const nextMajor = room * (0.84 + reseed(seed, 10 + i) * 0.1);
      const offset = (room - nextMajor) * 0.5 * reseed(seed, 20 + i);
      const angle = reseed(seed, 30 + i) * TAU;
      x += Math.cos(angle) * offset;
      z += Math.sin(angle) * offset;
      major = nextMajor;
      minor = major * (0.88 + reseed(seed, 40 + i) * 0.12);
      // Sit a hair into the stratum below rather than exactly on it.
      bottom -= 0.02;
    }
    // Strata differ in thickness, as real bedding does.
    const top =
      bottom +
      0.02 * Math.min(i, 1) +
      stratumHeight * (0.75 + reseed(seed, 50 + i) * 0.5);
    parts.push({
      shape: "terrace",
      contact: i === 0 ? "rim" : "stacked",
      tone: i % 2 === 0 ? "rock" : "band",
      position: [x, (bottom + top) / 2, z],
      quaternion: orientation(reseed(seed, 60 + i) * TAU),
      scale: [major, top - bottom, minor],
    });
    bottom = top;
  }

  // Gravel: a few clumps of two or three stones round the foot.
  let footprint = baseRadius;
  const clumps = 5 + Math.floor(reseed(seed, 70) * 3);
  let stone = 0;
  for (let c = 0; c < clumps; c++) {
    const bearing = ((c + reseed(seed, 71 + c) * 0.6) / clumps) * TAU;
    const distance = baseRadius * (1.12 + reseed(seed, 80 + c) * 0.16);
    const stones = 2 + Math.round(reseed(seed, 90 + c));
    for (let s = 0; s < stones; s++, stone++) {
      const size = 0.2 + reseed(seed, 100 + stone) * 0.26;
      const along = bearing + (s - (stones - 1) / 2) * (0.5 / distance) * 1.4;
      const scale: Vec3 = [
        size,
        size * (0.7 + reseed(seed, 130 + stone) * 0.4),
        size * (0.8 + reseed(seed, 160 + stone) * 0.3),
      ];
      parts.push(
        groundedRock(
          Math.cos(along) * distance,
          Math.sin(along) * distance,
          scale,
          reseed(seed, 190 + stone) * TAU,
          reseed(seed, 220 + stone) * 0.6,
          reseed(seed, 250 + stone) * TAU,
          PEBBLE_TONES[stone % PEBBLE_TONES.length],
          curvatureRadius,
        ),
      );
      footprint = Math.max(footprint, distance + Math.max(...scale));
    }
  }

  return { parts, footprint };
};

/**
 * A dune: a long ridge of sand lying across the wind, its gentle back to
 * windward and its steep slip face downwind (local +X; see propQuaternion).
 */
export const duneLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  const length = 2.8 + reseed(seed, 4) * 2.4; // along the crest
  const breadth = length * (0.42 + reseed(seed, 6) * 0.14); // with the wind
  const height = 1.6 + reseed(seed, 5) * 1;
  return {
    parts: [
      {
        shape: "dune",
        contact: "rim",
        tone: "ground",
        position: [0, -(groundDrop(length, curvatureRadius) + EMBED), 0],
        quaternion: orientation(0),
        scale: [breadth, height, length],
      },
    ],
    footprint: length,
    downwind: true,
  };
};

/**
 * Two to four boulders of a biome's rock: one big, the rest smaller and
 * gathered round it, each with its own squash, spin and lean.
 */
export const boulderClusterLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  const count = 2 + Math.floor(reseed(seed, 140) * 3);
  const base = 0.55 + reseed(seed, 141) * 0.75;
  const parts: GeologyPart[] = [];
  let footprint = 0;
  for (let i = 0; i < count; i++) {
    const size = base * (i === 0 ? 1 : 0.4 + reseed(seed, 150 + i) * 0.4);
    const angle = reseed(seed, 160 + i) * TAU;
    const distance = i === 0 ? 0 : base * (0.9 + reseed(seed, 170 + i) * 0.7);
    const scale: Vec3 = [
      size,
      size * (0.6 + reseed(seed, 180 + i) * 0.5),
      size * (0.8 + reseed(seed, 190 + i) * 0.35),
    ];
    parts.push(
      groundedRock(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        scale,
        reseed(seed, 200 + i) * TAU,
        reseed(seed, 210 + i) * 0.6,
        reseed(seed, 220 + i) * TAU,
        i === 0 || reseed(seed, 230 + i) < 0.5 ? "rock" : "band",
        curvatureRadius,
      ),
    );
    footprint = Math.max(footprint, distance + Math.max(...scale));
  }
  return { parts, footprint };
};

/** The furthest an arch fin of this size reaches across the ground. */
const archFinReach = (span: number, thickness: number): number => {
  const positions = GEOLOGY_GEOMETRY.arch.getAttribute("position");
  let reach = 0;
  for (let i = 0; i < positions.count; i++) {
    reach = Math.max(
      reach,
      Math.hypot(positions.getX(i) * span, positions.getZ(i) * thickness),
    );
  }
  return reach;
};

/**
 * A natural sandstone arch: the swept fin, its open feet sunk below the
 * ground, with a few fallen stones lying round each foot. It stands plumb -
 * an arch leaning off true reads as broken.
 */
export const archLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  const span = 3.2 + reseed(seed, 240) * 1.4; // centreline half-span
  const rise = 3.2 + reseed(seed, 241) * 1.4; // centreline height
  const thickness = 1.6 + reseed(seed, 242) * 0.5;
  const reach = archFinReach(span, thickness);
  const parts: GeologyPart[] = [
    {
      shape: "arch",
      contact: "ends",
      tone: "rock",
      position: [0, -(groundDrop(reach, curvatureRadius) + EMBED), 0],
      quaternion: orientation(0),
      scale: [span, rise, thickness],
    },
  ];
  let footprint = reach;
  for (const side of [-1, 1]) {
    for (let s = 0; s < 3; s++) {
      const salt = 300 + (side + 1) * 10 + s;
      const bearing = (s / 3) * TAU + reseed(seed, salt) * 1.2;
      const distance = span * (0.45 + reseed(seed, salt + 40) * 0.15);
      const size = 0.25 + reseed(seed, salt + 80) * 0.3;
      const scale: Vec3 = [size, size * 0.75, size * 0.9];
      const x = side * span + Math.cos(bearing) * distance;
      const z = Math.sin(bearing) * distance;
      parts.push(
        groundedRock(
          x,
          z,
          scale,
          reseed(seed, salt + 120) * TAU,
          reseed(seed, salt + 160) * 0.5,
          reseed(seed, salt + 200) * TAU,
          s === 0 ? "rock" : "band",
          curvatureRadius,
        ),
      );
      footprint = Math.max(footprint, Math.hypot(x, z) + size);
    }
  }
  return { parts, footprint };
};

/** A low, faceted mound of ice, sunk so its widest girth is underground. */
export const hillockLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  const width = 1.1 + reseed(seed, 260) * 2.2;
  const height = 0.7 + reseed(seed, 261) * 0.6;
  return {
    parts: [
      {
        shape: "rock",
        contact: "rim",
        tone: "ground",
        position: [0, -(groundDrop(width, curvatureRadius) + EMBED), 0],
        quaternion: orientation(reseed(seed, 262) * TAU),
        scale: [width, height, width * 0.78],
      },
    ],
    footprint: width,
  };
};

export type DesertKind = "dune" | "rocks" | "mesa";

export const desertKindOf = (seed: number): DesertKind =>
  seed < 0.45 ? "dune" : seed < 0.78 ? "rocks" : "mesa";

/** One piece of desert texture: a dune, a boulder cluster or a terraced mesa. */
export const desertFeatureLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout => {
  switch (desertKindOf(seed)) {
    case "dune":
      return duneLayout(seed, curvatureRadius);
    case "mesa":
      return mesaLayout(seed, curvatureRadius);
    default:
      return boulderClusterLayout(seed, curvatureRadius);
  }
};

export type SnowPropKind = "pine" | "hillock" | "boulders";

export const snowPropKindOf = (seed: number): SnowPropKind =>
  seed > 0.55 ? "pine" : seed > 0.25 ? "hillock" : "boulders";

/** A frosted pine's group scale - the one snow prop that isn't geology. */
export const pineScale = (seed: number): number => 0.7 + seed * 0.8;
// The pine cone mesh's base radius (feature.tsx's frostedPineGeometry).
const PINE_RADIUS = 0.45;

/** An icy hillock or a cluster of slate boulders (null for a frosted pine). */
export const snowPropLayout = (
  seed: number,
  curvatureRadius: number,
): GeologyLayout | null => {
  switch (snowPropKindOf(seed)) {
    case "pine":
      return null;
    case "hillock":
      return hillockLayout(seed, curvatureRadius);
    default:
      return boulderClusterLayout(seed, curvatureRadius);
  }
};

export const snowPropFootprint = (
  seed: number,
  curvatureRadius: number,
): number =>
  snowPropLayout(seed, curvatureRadius)?.footprint ??
  PINE_RADIUS * pineScale(seed);
