import React, { createContext, useContext, useRef, RefObject } from "react";
import { Group } from "three";

// Define the shape of the context data
interface SceneContextType {
  shipRef: RefObject<Group>;
  // Wraps just the ship model, excluding Exhaust/Physics/ShipCollision, so
  // the debug bounding-box overlay (scene.tsx) can trace the ship's actual
  // hull rather than including the exhaust flame's extent.
  bodyRef: RefObject<Group>;
}

// Create the context with a default value
const SceneContext = createContext<SceneContextType | null>(null);

// Provider component to wrap the application
export const SceneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Create the refs here, inside the component body
  const shipRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  return (
    // Provide the created refs to all children
    <SceneContext.Provider value={{ shipRef, bodyRef }}>
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
