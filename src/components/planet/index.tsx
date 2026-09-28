import { useMemo } from "react";
import { useProjects } from "../../context/projectContext";
import { getActivePlanet } from "../../utils/planets";
import { projectToShell } from "../../utils/planetSurface";
import { getBoardMatWorldPosition } from "../../utils/3d";
import { calculatedBoardPositionsAndRotations } from "../timeline/calculatedBoardPositionsAndRotations";
import { createPlanetTexture } from "./planetTexture";

// How far above the planet's own surface the glowing cruise ring and board
// beacons float, purely to avoid z-fighting with the sphere mesh.
const SURFACE_OFFSET = 0.15;
const RING_TUBE_RADIUS = 0.12;
const BEACON_RADIUS = 0.5;

/**
 * The single planet the ship is snapped to (see utils/planets - "snapping"
 * to a different one is future work; for now there's only ever this one).
 *
 * Boards are laid out around its equator (see
 * calculatedBoardPositionsAndRotations), so the planet renders a glowing
 * ring exactly on that same circle plus a small beacon at each stop -
 * together they make the travel pattern obvious at a glance: fly the ring,
 * in order, to see everything on the planet.
 */
const Planet = () => {
  const planet = getActivePlanet();
  const { items } = useProjects();
  const texture = useMemo(() => createPlanetTexture(), []);

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

  return (
    <group position={planet.center}>
      <mesh>
        <sphereGeometry args={[planet.radius, 96, 96]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* The cruise ring - the exact circle boards sit on, so the loop
          around the planet reads as an obvious, literal path. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[planet.radius + SURFACE_OFFSET, RING_TUBE_RADIUS, 8, 128]}
        />
        <meshBasicMaterial color="#7dd3fc" toneMapped={false} />
      </mesh>

      {/* A small beacon at each board's position on the ring. */}
      {beaconPositions.map((position, i) => (
        <mesh key={i} position={position}>
          <sphereGeometry args={[BEACON_RADIUS, 16, 16]} />
          <meshBasicMaterial color="#e8c468" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

export default Planet;
