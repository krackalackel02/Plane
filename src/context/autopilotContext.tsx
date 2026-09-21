import React, { createContext, useContext, useState, useCallback } from "react";
import { Vector3 } from "three";

export interface AutopilotTarget {
  position: Vector3;
  // Board-shell radius at request time, so the autopilot motion can decide
  // whether a direct path is already safe or needs to detour via the origin.
  arcRadius: number;
}

interface AutopilotContextType {
  target: AutopilotTarget | null;
  requestAutopilot: (position: Vector3, arcRadius: number) => void;
  cancelAutopilot: () => void;
  isFlying: boolean;
  setIsFlying: (flying: boolean) => void;
}

const AutopilotContext = createContext<AutopilotContextType | null>(null);

export const AutopilotProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [target, setTarget] = useState<AutopilotTarget | null>(null);
  const [isFlying, setIsFlying] = useState(false);

  const requestAutopilot = useCallback(
    (position: Vector3, arcRadius: number) => {
      setTarget({ position, arcRadius });
    },
    [],
  );

  const cancelAutopilot = useCallback(() => {
    setTarget(null);
  }, []);

  return (
    <AutopilotContext.Provider
      value={{
        target,
        requestAutopilot,
        cancelAutopilot,
        isFlying,
        setIsFlying,
      }}
    >
      {children}
    </AutopilotContext.Provider>
  );
};

export const useAutopilot = () => {
  const context = useContext(AutopilotContext);
  if (!context) {
    throw new Error("useAutopilot must be used within an AutopilotProvider");
  }
  return context;
};
