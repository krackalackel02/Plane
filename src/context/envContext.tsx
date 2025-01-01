import React, { createContext, useContext } from "react";
// Configuration based on environment
export const config = {
  showCameraHelper: import.meta.env.VITE_SHOW_CAMERA === "true",
  showStats: import.meta.env.VITE_SHOW_STATS === "true",
  showShip: import.meta.env.VITE_SHOW_SHIP === "true",
  showDebug: import.meta.env.VITE_SHOW_DEBUG === "true",
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
