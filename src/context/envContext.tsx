import React, { createContext, useContext } from "react";

/* 
  Configuration based on environment:
  - VITE_SHOW_CAMERA: Show camera helper
  - VITE_SHOW_STATS: Show performance stats
  - VITE_SHOW_SHIP: Show ship model
  - VITE_SHOW_DEBUG: Enable debug mode
*/
export const config = {
  showCameraHelper: import.meta.env.VITE_SHOW_CAMERA === "true",
  showStats: import.meta.env.VITE_SHOW_STATS === "true",
  showShip: import.meta.env.VITE_SHOW_SHIP === "true",
  showDebug: import.meta.env.VITE_SHOW_DEBUG === "true",
  showSpheres: import.meta.env.VITE_SHOW_SPHERES === "true",
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
