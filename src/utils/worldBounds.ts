import { useMemo } from "react";
import { useProjects } from "../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "../components/timeline/calculatedBoardPositionsAndRotations";

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// World units of open space kept between the boards' own bounding box and
// the outer wall, so the ship has room to fly around and turn rather than
// hugging the boundary the moment it clears the boards.
const BOUNDARY_MARGIN = 45;
// Floors the span so a single board (or none) doesn't shrink the whole
// playable zone down to a tiny box.
const MIN_SPAN = 60;

/**
 * The rectangular play area (in world x/z) that contains every board plus
 * the ship's (0, 0, 0) starting point, padded by BOUNDARY_MARGIN. This is
 * the single source of truth for "the zone the ship is allowed in" - it
 * drives the ship's boundary collision, where stars are allowed to spawn,
 * and what the minimap draws as its outer frame.
 */
export const computeWorldBounds = (
  boardPositions: Array<{ position: [number, number, number] }>,
  margin: number = BOUNDARY_MARGIN,
): WorldBounds => {
  const xs = [0, ...boardPositions.map((b) => b.position[0])];
  const zs = [0, ...boardPositions.map((b) => b.position[2])];
  const rawMinX = Math.min(...xs);
  const rawMaxX = Math.max(...xs);
  const rawMinZ = Math.min(...zs);
  const rawMaxZ = Math.max(...zs);

  const spanX = Math.max(rawMaxX - rawMinX, MIN_SPAN);
  const spanZ = Math.max(rawMaxZ - rawMinZ, MIN_SPAN);
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerZ = (rawMinZ + rawMaxZ) / 2;

  return {
    minX: centerX - spanX / 2 - margin,
    maxX: centerX + spanX / 2 + margin,
    minZ: centerZ - spanZ / 2 - margin,
    maxZ: centerZ + spanZ / 2 + margin,
  };
};

/**
 * The current world bounds, derived from the loaded project boards.
 * Memoized on `items` since calculatedBoardPositionsAndRotations does real
 * trig work and this is read every frame by the ship's collision system.
 */
export const useWorldBounds = (): WorldBounds => {
  const { items } = useProjects();

  return useMemo(() => {
    const boardsData = calculatedBoardPositionsAndRotations(items, "arc");
    return computeWorldBounds(boardsData);
  }, [items]);
};
