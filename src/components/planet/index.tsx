import { useMemo } from "react";
import {
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { useProjects } from "../../context/projectContext";
import { getActivePlanet } from "../../utils/planets";
import { pointOnSphere, projectToShell } from "../../utils/planetSurface";
import { getBoardMatWorldPosition } from "../../utils/3d";
import {
  calculatedBoardPositionsAndRotations,
  pathFrameAt,
  spawnTransform,
} from "../timeline/calculatedBoardPositionsAndRotations";
import { createPlanetTexture } from "./planetTexture";
import {
  CONTINENTS,
  scatterAnimals,
  scatterBushes,
  scatterDesertFeatures,
  scatterPenguins,
  scatterRidges,
  scatterSnowProps,
  scatterTrees,
  type ContinentVariant,
  type ScatteredTree,
} from "./planetTerrain";
import { Bush, DesertFeature, Ridge, SnowProp } from "./feature";
import Continent from "./landmass";
import Moon from "./moon";
import Cloud, { type CloudVariant } from "./cloud";
import Animal from "./animal";
import AutopilotRoute from "./autopilotRoute";

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
const ANIMAL_COUNT = 14;
const BUSH_COUNT = 150;
const DESERT_FEATURE_COUNT = 70;
// Ridge *chains*, not individual summits - each one walks several segments
// across the snow continent (see scatterRidges).
const RIDGE_CHAIN_COUNT = 14;
const SNOW_PROP_COUNT = 70;
const PENGUIN_COUNT = 10;
// How many of the tallest peaks get their own snow cloud hanging at the
// summit, per the "clouds around the mountain tops" intent.
const PEAK_CLOUD_COUNT = 6;

const deg = (d: number): number => (d * Math.PI) / 180;

interface CloudDef {
  /**
   * Which continent this cloud belongs over. When set, lon/lat below are
   * read as an offset from that continent's own centroid rather than as
   * absolute coordinates, so the clouds follow the CONTINENTS layout
   * instead of silently ending up over open water the next time a continent
   * moves. Omit it for the ocean clouds, which are absolute by nature.
   */
  over?: ContinentVariant;
  lon: number;
  lat: number;
  altitude: number;
  scale: number;
  variant: CloudVariant;
  precipitationCount?: number;
}

// Hand-placed rather than scattered: rain clouds sit over the forested
// continent, a small frequent cluster snows right at the snow-mountain's
// peak, a few plain ones drift over open ocean, and the desert continent is
// deliberately left cloud-free. The land ones are positioned relative to
// their continent's own centroid (see CloudDef.over) so they keep sitting
// over the right biome when the layout changes.
const CLOUD_DEFS: CloudDef[] = [
  // Rain over the forest continent.
  {
    over: "forest",
    lon: deg(6),
    lat: deg(-2),
    altitude: 8,
    scale: 1.5,
    variant: "rain",
    precipitationCount: 5,
  },
  {
    over: "forest",
    lon: deg(-9),
    lat: deg(7),
    altitude: 9,
    scale: 1.2,
    variant: "rain",
    precipitationCount: 4,
  },
  {
    over: "forest",
    lon: deg(14),
    lat: deg(9),
    altitude: 8.5,
    scale: 1.3,
    variant: "rain",
    precipitationCount: 4,
  },
  // Plain clouds drifting over open ocean - no rain/snow, no landmass
  // underneath (these latitudes are verified clear of land by the
  // "ocean clouds sit over open water" test).
  { lon: deg(85), lat: deg(35), altitude: 7, scale: 1.4, variant: "plain" },
  { lon: deg(291), lat: deg(-72), altitude: 7, scale: 1.25, variant: "plain" },
  { lon: deg(162), lat: deg(39), altitude: 7.5, scale: 1.5, variant: "plain" },
];

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
        castShadow
      />
      {isPine ? (
        <>
          <mesh
            geometry={pineLowerGeometry}
            material={pineMaterialLower}
            position={[0, 1.35, 0]}
            castShadow
          />
          <mesh
            geometry={pineUpperGeometry}
            material={pineMaterialUpper}
            position={[0, 1.85, 0]}
            castShadow
          />
        </>
      ) : (
        <>
          <mesh
            geometry={canopyCoreGeometry}
            material={canopyMaterialCore}
            position={[0, 1.3, 0]}
            castShadow
          />
          <mesh
            geometry={canopyLobeGeometry}
            material={canopyMaterialLobeA}
            position={[0.34, 1.55, 0.14]}
            castShadow
          />
          <mesh
            geometry={canopyLobeGeometry}
            material={canopyMaterialLobeB}
            position={[-0.3, 1.48, -0.2]}
            castShadow
          />
        </>
      )}
    </group>
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

  // Each tree lands at that exact point's own terrain height (see
  // heightAt in planetTerrain.ts) - not a fixed offset - so it sits flush
  // on the ground it's actually scattered onto, whether that's a green
  // slope or a raised tan highland.
  const trees = useMemo(
    () => scatterTrees(TREE_COUNT, planet.radius, planet.center),
    [planet],
  );

  // Restricted to the plain forest continent only (not the snow one's
  // slopes, never desert) - a grazing herd, not ground cover.
  const animals = useMemo(
    () => scatterAnimals(ANIMAL_COUNT, planet.radius, planet.center),
    [planet],
  );

  // The texture each of the other two biomes needs so it doesn't render as
  // one flat slab of colour: undergrowth between the forest's trees, dunes
  // and rock on the sand, and a whole range of peaks on the snow.
  const bushes = useMemo(
    () => scatterBushes(BUSH_COUNT, planet.radius, planet.center),
    [planet],
  );
  const desertFeatures = useMemo(
    () =>
      scatterDesertFeatures(DESERT_FEATURE_COUNT, planet.radius, planet.center),
    [planet],
  );
  const ridges = useMemo(
    () => scatterRidges(RIDGE_CHAIN_COUNT, planet.radius, planet.center),
    [planet],
  );
  const snowProps = useMemo(
    () => scatterSnowProps(SNOW_PROP_COUNT, planet.radius, planet.center),
    [planet],
  );
  const penguins = useMemo(
    () => scatterPenguins(PENGUIN_COUNT, planet.radius, planet.center),
    [planet],
  );

  // Hand-placed (see CLOUD_DEFS) rather than scattered - each one floats
  // at a fixed altitude above its own target spot, oriented so its local
  // "down" points at the ground beneath it.
  const clouds = useMemo(
    () =>
      CLOUD_DEFS.map((cloud) => {
        const anchor = cloud.over
          ? CONTINENTS.find((c) => (c.variant ?? "forest") === cloud.over)
          : undefined;
        const lon = (anchor?.lon ?? 0) + cloud.lon;
        const lat = (anchor?.lat ?? 0) + cloud.lat;
        const position = pointOnSphere(
          planet.radius + cloud.altitude,
          lat,
          lon,
          planet.center,
        );
        const normal = position.clone().sub(planet.center).normalize();
        return { ...cloud, position, normal };
      }),
    [planet],
  );

  // Snow clouds hang off the tallest summits rather than at hand-picked
  // coordinates, so they actually sit around the peaks of the range instead
  // of floating over whatever happens to be at a fixed lon/lat.
  const peakClouds = useMemo(
    () =>
      [...ridges]
        .sort((a, b) => b.height - a.height)
        .slice(0, PEAK_CLOUD_COUNT)
        .map((peak, i) => {
          const summit = peak.position.distanceTo(planet.center) + peak.height;
          const position = peak.normal
            .clone()
            .multiplyScalar(summit + 1.4)
            .add(planet.center);
          return {
            position,
            normal: peak.normal,
            scale: 0.65 + (i % 3) * 0.12,
            precipitationCount: 4,
          };
        }),
    [ridges, planet],
  );

  // Where the ship (and so the default medium camera, once the intro
  // finishes) actually starts - used as the moons' starting orbital angle
  // (see Moon's `phase` doc) purely so at least one is already nearby and
  // noticeable on load, rather than possibly starting on the planet's far
  // side.
  const spawnLon = useMemo(() => {
    const spawn = spawnTransform(items, planet);
    const normal = spawn.position.clone().sub(planet.center).normalize();
    return Math.atan2(normal.x, normal.z);
  }, [items, planet]);

  return (
    <group position={planet.center}>
      <mesh receiveShadow>
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

      {/* Real extruded 3D continents - organic wavy-coastline landmasses
          bent around the sphere - rather than a flat texture. */}
      {CONTINENTS.map((def, i) => (
        <Continent
          key={i}
          def={def}
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

      {/* A small grazing herd, forest continent only. */}
      {animals.map((animal, i) => (
        <Animal
          key={i}
          position={animal.position}
          heading={animal.heading}
          variant={animal.seed > 0.5 ? "cow" : "sheep"}
          scale={0.8 + animal.seed * 0.5}
          seed={animal.seed}
          planetRadius={planet.radius}
          planetCenter={planet.center}
        />
      ))}
      {bushes.map((bush, i) => (
        <Bush
          key={i}
          position={bush.position}
          normal={bush.normal}
          seed={bush.seed}
        />
      ))}
      {desertFeatures.map((feature, i) => (
        <DesertFeature
          key={i}
          position={feature.position}
          normal={feature.normal}
          seed={feature.seed}
        />
      ))}
      {ridges.map((segment, i) => (
        <Ridge
          key={i}
          position={segment.position}
          normal={segment.normal}
          seed={segment.seed}
          bearing={segment.bearing}
          height={segment.height}
          width={segment.width}
        />
      ))}
      {snowProps.map((prop, i) => (
        <SnowProp
          key={i}
          position={prop.position}
          normal={prop.normal}
          seed={prop.seed}
        />
      ))}
      {penguins.map((penguin, i) => (
        <Animal
          key={`penguin-${i}`}
          position={penguin.position}
          heading={penguin.seed * Math.PI * 2}
          variant="penguin"
          scale={0.7 + penguin.seed * 0.3}
          seed={penguin.seed}
          planetRadius={planet.radius}
          planetCenter={planet.center}
        />
      ))}

      {/* Low-poly clouds (see CLOUD_DEFS) - rain over the forest, snow
          right at the mountain's peak, plain ones drifting over open
          ocean, desert and the small islands left clear. */}
      <AutopilotRoute />
      {peakClouds.map((cloud, i) => (
        <Cloud
          key={`peak-${i}`}
          position={cloud.position}
          normal={cloud.normal}
          scale={cloud.scale}
          variant="snow"
          precipitationCount={cloud.precipitationCount}
        />
      ))}
      {clouds.map((cloud, i) => (
        <Cloud
          key={i}
          position={cloud.position}
          normal={cloud.normal}
          scale={cloud.scale}
          variant={cloud.variant}
          precipitationCount={cloud.precipitationCount}
        />
      ))}

      {/* A single tidally-locked moon (see moon.tsx) - just the one, to
          match this being an Earth-like planet - kept fairly close to the
          surface so it's still noticeable from the default chase camera.
          Orbits fast (8s per lap) and tidal lock ties spin rate to orbit
          rate, so at this speed the "same face inward" rotation itself
          reads as a fast, visible spin, not just a slow drift. */}
      <Moon
        size={planet.radius / 10}
        orbitRadius={planet.radius + 18}
        orbitSpeed={(2 * Math.PI) / 8}
        inclinationDeg={28}
        phase={spawnLon}
        tint="#c9ccd6"
      />
    </group>
  );
};

export default Planet;
