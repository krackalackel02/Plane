import React, { createContext, useContext } from "react";

/*
  Configuration based on environment. See README.md "Environment variables"
  for what each flag does and how to override it locally.

  These VITE_SHOW_* vars normally come from .env.development / .env.production,
  but those files are gitignored (local-only), so they don't exist in a fresh
  clone or worktree. When a var is unset, fall back to the value it has in
  .env.production, so behavior is consistent everywhere unless a dev
  explicitly opts into debug tooling via their own .env.development/.env.local.
  An explicit "true"/"false" in the env always wins over the fallback.

  VITE_MUSIC_ENABLED follows the same pattern but defaults on: set it to
  "false" to opt the ambient background music out.
*/
const readBoolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

export const config = {
  showCameraHelper: readBoolEnv(import.meta.env.VITE_SHOW_CAMERA, false),
  showStats: readBoolEnv(import.meta.env.VITE_SHOW_STATS, false),
  showShip: readBoolEnv(import.meta.env.VITE_SHOW_SHIP, true),
  showDebug: readBoolEnv(import.meta.env.VITE_SHOW_DEBUG, false),
  showSpheres: readBoolEnv(import.meta.env.VITE_SHOW_SPHERES, false),
  musicEnabled: readBoolEnv(import.meta.env.VITE_MUSIC_ENABLED, true),
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
