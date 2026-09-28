import { useMemo } from "react";
import {
  CanvasTexture,
  CircleGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MultiplyBlending,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { pointOnSphere } from "../../utils/planetSurface";
import { LandBlob } from "./planetTerrain";

// World-unit heights of each stacked layer, tallest (outermost) last - real
// extruded geometry rather than a flat painted silhouette, per the
// claymation reference's "volumetric extrusion" / "multi-tiered continent
// layering" direction. Each layer's rim is embedded slightly into the one
// below (see EMBED) so the seam between them - and between the sand layer
// and the ocean sphere - stays hidden rather than reading as a floating
// disc.
const SAND_HEIGHT = 1.6;
const VEG_HEIGHT = 1.15;
const FOREST_HEIGHT = 0.55;
const EMBED = 0.15;

/** Total height a blob's stack rises above the ocean shell - trees (see index.tsx) spawn on top of this, not on the bare ocean radius. */
export const LAND_STACK_HEIGHT =
  SAND_HEIGHT + VEG_HEIGHT + FOREST_HEIGHT - EMBED * 2;

const LATHE_SEGMENTS = 22;

/**
 * A radially-symmetric "plateau" profile for THREE.LatheGeometry: a flat
 * top with a rounded bevel down to the rim, swept 360deg around the local
 * Y axis - the low-poly-clay equivalent of a stamped/molded clay disc.
 */
const plateauProfile = (
  radius: number,
  baseY: number,
  height: number,
  capRatio: number,
): Vector2[] => [
  new Vector2(radius, baseY),
  new Vector2(radius * 0.92, baseY + height * 0.32),
  new Vector2(radius * capRatio, baseY + height * 0.82),
  new Vector2(0, baseY + height),
];

const sandMaterial = new MeshPhysicalMaterial({
  color: "#e3c896",
  roughness: 0.65,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});
const vegMaterial = new MeshPhysicalMaterial({
  color: "#7cc542",
  roughness: 0.65,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});
const forestMaterial = new MeshPhysicalMaterial({
  color: "#2f8e43",
  roughness: 0.65,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});

// Lazily built (needs `document`, unavailable at module-import time in
// non-browser test environments) and cached, since every landmass shares
// the exact same ring gradient - only its geometry's radius differs.
let shadowMaterial: MeshBasicMaterial | null = null;
const getShadowMaterial = (): MeshBasicMaterial => {
  if (shadowMaterial) return shadowMaterial;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  // Transparent under the landmass itself (hidden anyway), darkest right at
  // its base rim, fading back out over open ocean - a baked contact shadow
  // standing in for real SSAO.
  gradient.addColorStop(0, "rgba(8, 16, 14, 0)");
  gradient.addColorStop(0.62, "rgba(8, 16, 14, 0)");
  gradient.addColorStop(0.82, "rgba(8, 16, 14, 0.5)");
  gradient.addColorStop(1, "rgba(8, 16, 14, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  shadowMaterial = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: MultiplyBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return shadowMaterial;
};

const UP = new Vector3(0, 1, 0);

interface LandmassProps {
  blob: LandBlob;
  planetRadius: number;
  center: Vector3;
}

/**
 * One raised, three-tier landmass (sand coastline shelf -> lime vegetation
 * -> small forest-green highlight cap), standing on the ocean sphere at a
 * single blob's lon/lat, local +Y aligned to the outward surface normal so
 * the whole stack sits flush and upright regardless of where on the planet
 * it lands. A soft ring-shaped shadow decal at its base fakes the contact
 * shadow real ambient occlusion would cast where the extruded layers meet
 * the sphere underneath.
 */
const Landmass = ({ blob, planetRadius, center }: LandmassProps) => {
  const { position, quaternion, sandGeo, vegGeo, forestGeo, shadowGeo } =
    useMemo(() => {
      const position = pointOnSphere(planetRadius, blob.lat, blob.lon, center);
      const normal = position.clone().sub(center).normalize();
      const quaternion = new Quaternion().setFromUnitVectors(UP, normal);
      // Arc length at this angular radius - a fine linear approximation at
      // the modest blob sizes in play here (a few tens of degrees at most).
      const worldRadius = blob.radius * planetRadius;

      const sandTop = SAND_HEIGHT - EMBED;
      const vegBase = sandTop - EMBED;
      const vegTop = vegBase + VEG_HEIGHT;
      const forestBase = vegTop - EMBED;

      const sandGeo = new LatheGeometry(
        plateauProfile(worldRadius, -EMBED, SAND_HEIGHT, 0.6),
        LATHE_SEGMENTS,
      );
      const vegGeo = new LatheGeometry(
        plateauProfile(worldRadius * 0.72, vegBase, VEG_HEIGHT, 0.55),
        LATHE_SEGMENTS,
      );
      const forestGeo = new LatheGeometry(
        plateauProfile(worldRadius * 0.4, forestBase, FOREST_HEIGHT, 0.5),
        LATHE_SEGMENTS,
      );
      const shadowGeo = new CircleGeometry(worldRadius * 1.3, 28);

      return { position, quaternion, sandGeo, vegGeo, forestGeo, shadowGeo };
    }, [blob, planetRadius, center]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={shadowGeo}
        material={getShadowMaterial()}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh geometry={sandGeo} material={sandMaterial} />
      <mesh geometry={vegGeo} material={vegMaterial} />
      <mesh geometry={forestGeo} material={forestMaterial} />
    </group>
  );
};

export default Landmass;
