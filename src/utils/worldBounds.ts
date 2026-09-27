import { useMemo } from "react";
import { useProjects } from "../context/projectContext";
import { calculatedBoardPositionsAndRotations } from "../components/timeline/calculatedBoardPositionsAndRotations";

export interface WorldBounds {
  centerX: number;
  centerZ: number;
  radius: number;
}

// World units of open space kept between the farthest board and the outer
// wall, so the ship has room to fly around and turn rather than hugging
// the boundary the moment it clears the boards.
const BOUNDARY_MARGIN = 45;
// Floors the radius so a single board (or none) doesn't shrink the whole
// playable zone down to a tiny circle.
const MIN_RADIUS = 60;

/**
 * The circular (cylindrical - unbounded in y) play area, centered on the
 * ship's (0, 0, 0) starting point, that contains every board plus
 * BOUNDARY_MARGIN of open space beyond the farthest one. This is the
 * single source of truth for "the zone the ship is allowed in" - it
 * drives the ship's boundary collision, the radius stars are allowed to
 * spawn within, and the radius the minimap draws as its outer ring (see
 * minimap/mapProjection.ts, which maps this radius directly onto the
 * minimap's own circular dock).
 */
export const computeWorldBounds = (
  boardPositions: Array<{ position: [number, number, number] }>,
  margin: number = BOUNDARY_MARGIN,
): WorldBounds => {
  const farthestBoard = boardPositions.reduce(
    (max, b) => Math.max(max, Math.hypot(b.position[0], b.position[2])),
    0,
  );

  return {
    centerX: 0,
    centerZ: 0,
    radius: Math.max(farthestBoard + margin, MIN_RADIUS),
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
