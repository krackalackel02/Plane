import { ExhaustMode } from "./types";

const VALID_MODES: readonly ExhaustMode[] = ["particles", "clouds", "voxels"];
const DEFAULT_MODE: ExhaustMode = "clouds";

const isExhaustMode = (value: unknown): value is ExhaustMode =>
  typeof value === "string" &&
  (VALID_MODES as readonly string[]).includes(value);

/**
 * Resolve which exhaust renderer to use. Reads VITE_EXHAUST_MODE so the
 * look (plain particles / 2D cloud puffs / 3D voxel clouds) can be swapped
 * per dev session or deploy without touching code. `override` lets callers
 * (tests, future UI toggles) bypass the env var explicitly.
 */
export const resolveExhaustMode = (override?: string): ExhaustMode => {
  const requested = override ?? import.meta.env.VITE_EXHAUST_MODE;
  return isExhaustMode(requested) ? requested : DEFAULT_MODE;
};
