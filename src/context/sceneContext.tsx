import React, { createContext, useContext, useRef, RefObject } from "react";
import { Group } from "three";

// Define the shape of the context data
interface SceneContextType {
  shipRef: RefObject<Group>;
}

// Create the context with a default value
const SceneContext = createContext<SceneContextType | null>(null);

// Provider component to wrap the application
export const SceneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Create the ref here, inside the component body
  const shipRef = useRef<Group>(null);

  return (
    // Provide the created ref to all children
    <SceneContext.Provider value={{ shipRef }}>
      {children}
    </SceneContext.Provider>
  );
};

// Custom hook for consuming the scene context
export const useScene = () => {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error("useScene must be used within a SceneProvider");
  }
  return context;
};
