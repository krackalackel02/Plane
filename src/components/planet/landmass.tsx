import { useMemo } from "react";
import {
  BufferGeometry,
  ExtrudeGeometry,
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
  GREEN_HEIGHT,
  TAN_BASE_Z_OFFSET,
  TAN_HEIGHT,
  TERRAIN_EMBED,
  outlineRadiusAt,
} from "./planetTerrain";

const OUTLINE_SAMPLES = 40;

/** A closed, wavy-coastline outline (see outlineRadiusAt) as a flat 2D THREE.Shape, ready to extrude. */
const buildOutlineShape = (def: ContinentDef, scale: number): Shape => {
  const points: Vector2[] = [];
  for (let i = 0; i < OUTLINE_SAMPLES; i++) {
    const bearing = (i / OUTLINE_SAMPLES) * Math.PI * 2;
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
const wrapGeometryOntoSphere = (
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

const extrudeSettings = (depth: number) => ({
  depth,
  bevelEnabled: true,
  bevelThickness: Math.min(0.35, depth * 0.4),
  bevelSize: Math.min(0.45, depth * 0.4),
  bevelSegments: 3,
  curveSegments: 20,
});

interface ContinentProps {
  def: ContinentDef;
  planetRadius: number;
  center: Vector3;
}

/**
 * One organic landmass: a green base layer following its own wavy
 * coastline (see outlineRadiusAt), with a smaller tan "highland" cap
 * stacked directly on top for continents that have one - both genuinely
 * extruded and bent around the sphere's curvature (see
 * wrapGeometryOntoSphere), sitting flush with zero gap against the ocean
 * shell beneath.
 */
const Continent = ({ def, planetRadius, center }: ContinentProps) => {
  const { greenGeo, tanGeo } = useMemo(() => {
    const centroidPos = pointOnSphere(planetRadius, def.lat, def.lon, center);
    const normal = surfaceNormal(centroidPos, center);
    const { east, north } = eastNorthAt(normal);

    const greenGeo = new ExtrudeGeometry(
      buildOutlineShape(def, 1),
      extrudeSettings(GREEN_HEIGHT),
    );
    wrapGeometryOntoSphere(
      greenGeo,
      planetRadius,
      center,
      centroidPos,
      east,
      north,
      0,
      TERRAIN_EMBED,
    );

    let tanGeo: ExtrudeGeometry | null = null;
    if (def.highland) {
      tanGeo = new ExtrudeGeometry(
        buildOutlineShape(def, def.highland.scale),
        extrudeSettings(TAN_HEIGHT),
      );
      wrapGeometryOntoSphere(
        tanGeo,
        planetRadius,
        center,
        centroidPos,
        east,
        north,
        TAN_BASE_Z_OFFSET,
        TERRAIN_EMBED,
      );
    }

    return { greenGeo, tanGeo };
  }, [def, planetRadius, center]);

  return (
    <>
      <mesh geometry={greenGeo} material={greenMaterial} />
      {tanGeo && <mesh geometry={tanGeo} material={tanMaterial} />}
    </>
  );
};

export default Continent;
