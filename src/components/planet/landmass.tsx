import { useMemo } from "react";
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  MeshPhysicalMaterial,
  Shape,
  Vector2,
  Vector3,
} from "three";
import {
  eastNorthAt,
  pointOnSphere,
  surfaceNormal,
} from "../../utils/planetSurface";
import {
  ContinentDef,
  DESERT_HEIGHT,
  GREEN_HEIGHT,
  SNOW_BASE_HEIGHT,
  SNOW_HEIGHT,
  TAN_HEIGHT,
  TERRAIN_EMBED,
  bevelSizeFor,
  bevelThicknessFor,
  capBaseZOffset,
  outlineRadiusAt,
} from "./planetTerrain";

// Outline samples scale with a landmass's size: dense enough on the big
// continents to resolve the narrowest coastline feature - a fjord inlet is a
// notch only ~7 degrees of bearing wide (see planetTerrain's Inlet), and it
// takes a few samples across one to read as an inlet - but no denser than a
// small island's short coastline needs, since every sample becomes a column of
// side-wall triangles.
const outlineSamplesFor = (def: ContinentDef): number =>
  Math.max(48, Math.min(220, Math.round(def.baseRadius * 6.5)));

/** A closed, wavy-coastline outline (see outlineRadiusAt) as a flat 2D THREE.Shape, ready to extrude. */
const buildOutlineShape = (def: ContinentDef, scale: number): Shape => {
  const samples = outlineSamplesFor(def);
  const points: Vector2[] = [];
  for (let i = 0; i < samples; i++) {
    const bearing = (i / samples) * Math.PI * 2;
    const radius = outlineRadiusAt(def, bearing) * scale;
    points.push(
      new Vector2(radius * Math.sin(bearing), radius * Math.cos(bearing)),
    );
  }
  const shape = new Shape();
  shape.moveTo(points[0].x, points[0].y);
  shape.splineThru(points.slice(1));
  shape.closePath();
  return shape;
};

/**
 * Bends a flat, XY-plane extruded shape around the sphere: local x/y is
 * read as an east/north tangent-plane offset from the continent's own
 * centroid, and z as height above the ocean shell. Each vertex is pushed
 * out along the direction from the planet's center through its
 * tangent-plane position, landing at exactly `planetRadius + z + zOffset -
 * embed` - so a shape built with z running 0..depth lands with its base
 * embedded `embed` units into whatever it's sitting on (hiding the seam)
 * and its top at a known, exact height above the surface: this is what
 * guarantees the mesh and heightAt's tree placement (planetTerrain.ts)
 * never disagree about where the ground actually is.
 */
export const wrapGeometryOntoSphere = (
  geometry: BufferGeometry,
  planetRadius: number,
  center: Vector3,
  centroidPos: Vector3,
  east: Vector3,
  north: Vector3,
  zOffset: number,
  embed: number,
) => {
  const position = geometry.getAttribute("position");
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.copy(centroidPos)
      .addScaledVector(east, position.getX(i))
      .addScaledVector(north, position.getY(i))
      .sub(center);
    const targetRadius = planetRadius + position.getZ(i) + zOffset - embed;
    v.normalize().multiplyScalar(targetRadius).add(center);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
};

const greenMaterial = new MeshPhysicalMaterial({
  color: "#7cc542",
  roughness: 0.65,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});
const tanMaterial = new MeshPhysicalMaterial({
  color: "#e3c896",
  roughness: 0.65,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});
const snowMaterial = new MeshPhysicalMaterial({
  color: "#ffffff",
  roughness: 0.45,
  clearcoat: 0.45,
  clearcoatRoughness: 0.2,
});
// The snow continent's base layer: a pale ice-blue shelf (#e8f4f8), so the
// slate mountains and pure-white caps above it read clearly against it rather
// than everything being one white mass.
const snowRockMaterial = new MeshPhysicalMaterial({
  color: "#e8f4f8",
  roughness: 0.6,
  clearcoat: 0.3,
  clearcoatRoughness: 0.3,
});

// bevelThickness/bevelSize come from planetTerrain so heightAt derives the
// same top surface this actually produces - a bevelled extrusion runs from
// -bevelThickness to depth + bevelThickness, not 0 to depth.
const extrudeSettings = (depth: number) => ({
  depth,
  bevelEnabled: true,
  bevelThickness: bevelThicknessFor(depth),
  bevelSize: bevelSizeFor(depth),
  bevelSegments: 3,
  // Per *control point*, not per shape: three.js subdivides a spline into
  // curveSegments x points.length. The outline is already sampled every
  // OUTLINE_SAMPLES bearings, so anything above a couple here only multiplies
  // the mesh - at 20 it turned a radius-5 island into 72k triangles and all
  // six landmasses into ~600k, taking seconds to build at load.
  curveSegments: 2,
});

/**
 * Longest triangle edge (world units) allowed on a landmass before it gets
 * subdivided, so that bending it onto the sphere actually bends its interior
 * and not just its rim.
 *
 * This matters because ExtrudeGeometry triangulates its caps from the outline
 * vertices ALONE - it creates no interior vertices whatsoever. wrapGeometry-
 * OntoSphere can therefore only move the rim onto the sphere, and every cap
 * triangle stays a flat plane spanning the chord between its rim points. On a
 * small island that's an invisible facet. On a continent spanning ~50 degrees
 * of arc it's a flat slab that visibly slices straight through the planet,
 * which is exactly what the big continents looked like until this was added.
 *
 * A flat chord of length L sags L^2/(8R) below the sphere, so at R = 40 an
 * edge of 5 sags under 0.08 world units - comfortably below SURFACE_OFFSET,
 * for a few hundred extra triangles per landmass, built once at mount.
 */
const MAX_SURFACE_EDGE = 5;
// Hard ceiling on subdivision output, so a pathological CONTINENTS edit can't
// spin this into millions of triangles. The real landmasses come in far under
// it (a few hundred triangles per cap).
const MAX_SUBDIVIDED_TRIANGLES = 200_000;

/**
 * Splits every triangle whose longest edge exceeds `maxEdge`, repeatedly, by
 * halving that edge - so the result has interior vertices dense enough that
 * bending it onto a sphere bends the whole surface rather than only its rim.
 *
 * Deliberately position-only: these landmass materials are untextured solid
 * colours and normals get recomputed after the wrap, so carrying UVs and
 * stale normals through the split would be work with nothing reading it.
 * (three-stdlib ships a TessellateModifier, but its package exports only the
 * barrel entry point, which pulls a canvas-dependent module in and breaks
 * under the jsdom test environment.)
 */
const subdivideForCurvature = (
  geometry: BufferGeometry,
  maxEdge: number,
): BufferGeometry => {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertexAt = (i: number): Vector3 => {
    const n = index ? index.getX(i) : i;
    return new Vector3(position.getX(n), position.getY(n), position.getZ(n));
  };

  const sourceCount = index ? index.count : position.count;
  const pending: [Vector3, Vector3, Vector3][] = [];
  for (let i = 0; i + 2 < sourceCount; i += 3) {
    pending.push([vertexAt(i), vertexAt(i + 1), vertexAt(i + 2)]);
  }

  const out: number[] = [];
  const maxEdgeSq = maxEdge * maxEdge;
  while (pending.length > 0 && out.length / 9 < MAX_SUBDIVIDED_TRIANGLES) {
    const [a, b, c] = pending.pop()!;
    const ab = a.distanceToSquared(b);
    const bc = b.distanceToSquared(c);
    const ca = c.distanceToSquared(a);
    const longest = Math.max(ab, bc, ca);

    if (longest <= maxEdgeSq) {
      out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      continue;
    }
    // Halve the longest edge, keeping the opposite vertex - two triangles.
    if (longest === ab) {
      const m = a.clone().add(b).multiplyScalar(0.5);
      pending.push([a, m, c], [m, b, c]);
    } else if (longest === bc) {
      const m = b.clone().add(c).multiplyScalar(0.5);
      pending.push([a, b, m], [a, m, c]);
    } else {
      const m = c.clone().add(a).multiplyScalar(0.5);
      pending.push([a, b, m], [m, b, c]);
    }
  }

  const dense = new BufferGeometry();
  dense.setAttribute("position", new Float32BufferAttribute(out, 3));
  return dense;
};

/**
 * Extrude a landmass outline, subdivide it finely enough to follow curvature,
 * and bend it onto the sphere. Returns a geometry whose *surface* - not just
 * its outline - sits on the planet.
 */
export const buildConformingGeometry = (
  def: ContinentDef,
  scale: number,
  depth: number,
  planetRadius: number,
  center: Vector3,
  centroidPos: Vector3,
  east: Vector3,
  north: Vector3,
  zOffset: number,
): BufferGeometry => {
  const flat = new ExtrudeGeometry(
    buildOutlineShape(def, scale),
    extrudeSettings(depth),
  );
  const dense = subdivideForCurvature(flat, MAX_SURFACE_EDGE);
  // Subdivision returns a new geometry; the flat one would otherwise leak.
  flat.dispose();
  wrapGeometryOntoSphere(
    dense,
    planetRadius,
    center,
    centroidPos,
    east,
    north,
    zOffset,
    TERRAIN_EMBED,
  );
  return dense;
};

interface ContinentProps {
  def: ContinentDef;
  planetRadius: number;
  center: Vector3;
}

/**
 * One organic landmass, one of:
 * - "forest" (the default): a green base layer following its own wavy
 *   coastline (see outlineRadiusAt), with a smaller tan "highland" cap
 *   stacked directly on top for continents that have one;
 * - "desert": a single solid tan/sand layer covering the whole outline,
 *   no green - a distinct barren landmass type (see scatterTrees, which
 *   skips these entirely); or
 * - "snow": no green at all - a bare white snow-over-rock base under a
 *   mandatory, taller pure-white peak cap, so the whole landmass reads as
 *   a snowy mountain range rather than a green continent wearing a hat.
 * All are genuinely extruded and bent around the sphere's curvature (see
 * wrapGeometryOntoSphere), sitting flush with zero gap against the ocean
 * shell beneath.
 */
const Continent = ({ def, planetRadius, center }: ContinentProps) => {
  const { baseGeo, baseMaterial, tanGeo, snowGeo, desertGeo } = useMemo(() => {
    const centroidPos = pointOnSphere(planetRadius, def.lat, def.lon, center);
    const normal = surfaceNormal(centroidPos, center);
    const { east, north } = eastNorthAt(normal);

    const conform = (scale: number, depth: number, zOffset: number) =>
      buildConformingGeometry(
        def,
        scale,
        depth,
        planetRadius,
        center,
        centroidPos,
        east,
        north,
        zOffset,
      );

    if (def.variant === "desert") {
      return {
        baseGeo: null,
        baseMaterial: tanMaterial,
        tanGeo: null,
        snowGeo: null,
        desertGeo: conform(1, DESERT_HEIGHT, 0),
      };
    }

    const isSnow = def.variant === "snow";
    const baseGeo = conform(1, isSnow ? SNOW_BASE_HEIGHT : GREEN_HEIGHT, 0);

    let tanGeo: BufferGeometry | null = null;
    let snowGeo: BufferGeometry | null = null;
    if (def.highland) {
      const capGeo = conform(
        def.highland.scale,
        isSnow ? SNOW_HEIGHT : TAN_HEIGHT,
        capBaseZOffset(def.variant ?? "forest"),
      );
      if (isSnow) snowGeo = capGeo;
      else tanGeo = capGeo;
    }

    return {
      baseGeo,
      baseMaterial: isSnow ? snowRockMaterial : greenMaterial,
      tanGeo,
      snowGeo,
      desertGeo: null,
    };
  }, [def, planetRadius, center]);

  return (
    <>
      {baseGeo && (
        <mesh geometry={baseGeo} material={baseMaterial} receiveShadow />
      )}
      {tanGeo && (
        <mesh
          geometry={tanGeo}
          material={tanMaterial}
          receiveShadow
          castShadow
        />
      )}
      {snowGeo && (
        <mesh
          geometry={snowGeo}
          material={snowMaterial}
          receiveShadow
          castShadow
        />
      )}
      {desertGeo && (
        <mesh geometry={desertGeo} material={tanMaterial} receiveShadow />
      )}
    </>
  );
};

export default Continent;
