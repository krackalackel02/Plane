import React, { createContext, useContext } from "react";

/*
  Configuration based on environment:
  - VITE_SHOW_CAMERA: Show camera helper
  - VITE_SHOW_STATS: Show performance stats
  - VITE_SHOW_SHIP: Show ship model
  - VITE_SHOW_DEBUG: Enable debug mode
  - VITE_SHOW_SPHERES: Show debug axis spheres

  These VITE_SHOW_* vars normally come from .env.development / .env.production,
  but those files are gitignored (local-only), so they don't exist in a fresh
  clone or worktree. When a var is unset, fall back to a sensible per-flag
  default based on import.meta.env.DEV instead of silently defaulting to off.
  An explicit "true"/"false" in the env always wins over the fallback.
*/
const isDev = import.meta.env.DEV;

const readBoolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

export const config = {
  // Camera/sphere debug helpers clutter the scene and aren't needed by default.
  showCameraHelper: readBoolEnv(import.meta.env.VITE_SHOW_CAMERA, false),
  showStats: readBoolEnv(import.meta.env.VITE_SHOW_STATS, isDev),
  // Ship should be visible by default so it's actually seen in dev/worktrees
  // that don't have a local .env.development.
  showShip: readBoolEnv(import.meta.env.VITE_SHOW_SHIP, true),
  showDebug: readBoolEnv(import.meta.env.VITE_SHOW_DEBUG, isDev),
  showSpheres: readBoolEnv(import.meta.env.VITE_SHOW_SPHERES, false),
};

// Create the context with default values based on the environment
const EnvironmentContext = createContext(config);

// Provider component to wrap the application
export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <EnvironmentContext.Provider value={config}>
      {children}
    </EnvironmentContext.Provider>
  );
};

// Custom hook for consuming the environment context
export const useEnvironment = () => {
  return useContext(EnvironmentContext);
};
