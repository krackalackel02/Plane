import { useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { useProjects } from "../../context/projectContext";
import { getActivePlanet } from "../../utils/planets";
import { projectToShell } from "../../utils/planetSurface";
import { getBoardMatWorldPosition } from "../../utils/3d";
import {
  calculatedBoardPositionsAndRotations,
  pathFrameAt,
} from "../timeline/calculatedBoardPositionsAndRotations";
import { createPlanetTexture } from "./planetTexture";
import { allBlobs, scatterTrees, type ScatteredTree } from "./planetTerrain";
import Landmass, { LAND_STACK_HEIGHT } from "./landmass";

// How far above the planet's own surface the glowing cruise ring and board
// beacons float, purely to avoid z-fighting with the sphere mesh.
const SURFACE_OFFSET = 0.15;
const RING_TUBE_RADIUS = 0.12;
const BEACON_RADIUS = 0.5;
// How finely the ring curve is sampled around the loop - the trail zigzags
// (see pathFrameAt), so this needs to be dense enough to read as a smooth
// curve rather than a faceted polygon.
const RING_SEGMENTS = 256;
// Deliberately chunky (not the old 96x96) - low, flat-shaded segment counts
// are what give the sphere its "mild planar facets" claymation feel, per
// the low-poly-clay art direction. Vertices still land exactly on the true
// sphere of `planet.radius` regardless of segment count, so gameplay math
// (collision, spawn, autopilot) - all of which reasons about a perfect
// sphere - never sees the difference; only the shading does.
const SPHERE_SEGMENTS = 22;
const TREE_COUNT = 90;

// Shared across every tree instance (see Tree below) rather than one
// geometry/material per mesh - a few dozen trees would otherwise mean
// hundreds of one-off GPU resources for what's visually a handful of
// repeated shapes.
const trunkGeometry = new CylinderGeometry(0.1, 0.16, 1.2, 6);
const trunkMaterial = new MeshStandardMaterial({
  color: "#6b4a2f",
  roughness: 0.85,
});
const pineLowerGeometry = new ConeGeometry(0.75, 1.15, 7);
const pineUpperGeometry = new ConeGeometry(0.55, 0.9, 7);
const pineMaterialLower = new MeshStandardMaterial({
  color: "#2f8e43",
  roughness: 0.55,
  flatShading: true,
});
const pineMaterialUpper = new MeshStandardMaterial({
  color: "#7cc542",
  roughness: 0.55,
  flatShading: true,
});
const canopyCoreGeometry = new IcosahedronGeometry(0.58, 0);
const canopyLobeGeometry = new IcosahedronGeometry(0.38, 0);
const canopyMaterialCore = new MeshStandardMaterial({
  color: "#2f8e43",
  roughness: 0.6,
  flatShading: true,
});
const canopyMaterialLobeA = new MeshStandardMaterial({
  color: "#7cc542",
  roughness: 0.6,
  flatShading: true,
});
const canopyMaterialLobeB = new MeshStandardMaterial({
  color: "#3c8548",
  roughness: 0.6,
  flatShading: true,
});

const WORLD_UP = new Vector3(0, 1, 0);

/**
 * A single stylised tree, standing upright on the surface (local +Y
 * aligned to the planet's outward normal at its own spot - "surface-
 * normal alignment", per the claymation reference). Alternates between a
 * stacked-cone "pine" and a stacked-icosahedron "broccoli" canopy purely
 * off its own deterministic seed, so the mix is stable across re-renders
 * without needing to store a type anywhere.
 */
const Tree = ({ position, normal, seed }: ScatteredTree) => {
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(WORLD_UP, normal),
    [normal],
  );
  const scale = 1.6 + seed * 1.8;
  const isPine = seed > 0.55;

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <mesh
        geometry={trunkGeometry}
        material={trunkMaterial}
        position={[0, 0.6, 0]}
      />
      {isPine ? (
        <>
          <mesh
            geometry={pineLowerGeometry}
            material={pineMaterialLower}
            position={[0, 1.35, 0]}
          />
          <mesh
            geometry={pineUpperGeometry}
            material={pineMaterialUpper}
            position={[0, 1.85, 0]}
          />
        </>
      ) : (
        <>
          <mesh
            geometry={canopyCoreGeometry}
            material={canopyMaterialCore}
            position={[0, 1.3, 0]}
          />
          <mesh
            geometry={canopyLobeGeometry}
            material={canopyMaterialLobeA}
            position={[0.34, 1.55, 0.14]}
          />
          <mesh
            geometry={canopyLobeGeometry}
            material={canopyMaterialLobeB}
            position={[-0.3, 1.48, -0.2]}
          />
        </>
      )}
    </group>
  );
};

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 glowColor;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
    float intensity = pow(rim, power);
    gl_FragColor = vec4(glowColor, intensity);
  }
`;

/**
 * A soft fresnel rim-glow shell just outside the planet's own radius - a
 * cheap stand-in for a real atmospheric scattering pass, so the dark side
 * of the globe still reads as a globe (not a black disc) against the
 * starfield, and the lit side gets a gentle sky-blue halo at its silhouette.
 */
const Atmosphere = ({ radius }: { radius: number }) => {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
          glowColor: { value: new Color("#7ec8ff") },
          power: { value: 2.4 },
        },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  return (
    <mesh material={material}>
      <sphereGeometry args={[radius * 1.14, 48, 48]} />
    </mesh>
  );
};

/**
 * The single planet the ship is snapped to (see utils/planets - "snapping"
 * to a different one is future work; for now there's only ever this one).
 *
 * Boards are laid out along its trail (see
 * calculatedBoardPositionsAndRotations), so the planet renders a glowing
 * tube tracing that same path plus a small beacon at each stop - together
 * they make the travel pattern obvious at a glance: fly the trail, in
 * order, to see everything on the planet. The trail is deliberately the
 * *only* highlighted path anywhere in the scene (the minimap traces this
 * same wiggly line rather than drawing a separate, competing straight
 * reference).
 */
const Planet = () => {
  const planet = getActivePlanet();
  const { items } = useProjects();
  const texture = useMemo(() => createPlanetTexture(), []);

  const ringGeometry = useMemo(() => {
    const radius = planet.radius + SURFACE_OFFSET;
    const points = Array.from(
      { length: RING_SEGMENTS },
      (_, i) =>
        pathFrameAt(radius, (i / RING_SEGMENTS) * Math.PI * 2, planet.center)
          .position,
    );
    const curve = new CatmullRomCurve3(points, true);
    return new TubeGeometry(curve, RING_SEGMENTS, RING_TUBE_RADIUS, 8, true);
  }, [planet]);

  // Each beacon marks the center of that stop's activation zone - not the
  // (now sideways-offset) board itself - since the zone, not the board, is
  // what the ship actually flies through. The zone sits at a fixed local
  // offset from the board's own anchor (see activationZone.tsx), so its
  // world position is found the same way autopilot finds it, then snapped
  // back onto the ground (the offset isn't perfectly on-sphere on its own).
  const beaconPositions = useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, planet);
    return boardsData.map((board) =>
      projectToShell(
        getBoardMatWorldPosition(board.position, board.quaternion),
        planet.radius + SURFACE_OFFSET,
        planet.center,
      ),
    );
  }, [items, planet]);

  // Trees stand on top of the raised terrain stack (see landmass.tsx), not
  // the bare ocean shell - otherwise they'd render embedded inside the
  // extruded landmass rather than on top of it.
  const trees = useMemo(
    () =>
      scatterTrees(
        TREE_COUNT,
        planet.radius + LAND_STACK_HEIGHT,
        planet.center,
      ),
    [planet],
  );

  return (
    <group position={planet.center}>
      <mesh>
        <sphereGeometry
          args={[planet.radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]}
        />
        <meshPhysicalMaterial
          map={texture}
          roughness={0.4}
          metalness={0.05}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
          flatShading
        />
      </mesh>

      <Atmosphere radius={planet.radius} />

      {/* Real extruded 3D landmasses - a raised, three-tier clay stack per
          blob - rather than a flat texture. */}
      {allBlobs().map((blob, i) => (
        <Landmass
          key={i}
          blob={blob}
          planetRadius={planet.radius}
          center={planet.center}
        />
      ))}

      {/* The cruise trail - the exact path boards sit along, so the loop
          around the planet reads as an obvious, literal path. */}
      <mesh geometry={ringGeometry}>
        <meshBasicMaterial color="#7dd3fc" toneMapped={false} />
      </mesh>

      {/* A small beacon at each board's position on the trail. */}
      {beaconPositions.map((position, i) => (
        <mesh key={i} position={position}>
          <sphereGeometry args={[BEACON_RADIUS, 16, 16]} />
          <meshBasicMaterial color="#e8c468" toneMapped={false} />
        </mesh>
      ))}

      {/* Claymation foliage, scattered across the landmasses (see
          planetTerrain.ts / landmass.tsx). */}
      {trees.map((tree, i) => (
        <Tree key={i} {...tree} />
      ))}
    </group>
  );
};

export default Planet;
