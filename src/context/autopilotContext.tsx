import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Vector3 } from "three";

export interface AutopilotTarget {
  position: Vector3;
  // The specific board this flight is heading to, if any - lets
  // ActivationZone (see activationZone.tsx) tell "arrived at the actual
  // destination" apart from "the great-circle arc happened to pass near a
  // completely different board's zone en route," which would otherwise
  // pop up the wrong project and cut the flight short. Left undefined for
  // destinations that aren't a specific board (e.g. "0" returns to spawn,
  // or a future "fly wherever I click" minimap target) - zones activate
  // normally in that case, since there's no specific destination to guard.
  boardId?: string;
}

interface AutopilotContextType {
  target: AutopilotTarget | null;
  requestAutopilot: (position: Vector3, boardId?: string) => void;
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
    (position: Vector3, boardId?: string) => {
      setTarget({ position, boardId });
    },
    [],
  );

  const cancelAutopilot = useCallback(() => {
    setTarget(null);
  }, []);

  // Mirrors keyContext's blur handler, added for the same popup: clicking
  // the landing popup's "View Demo"/"View Code" links (or backgrounding the
  // tab on mobile) steals window focus, which can stall the physics
  // useFrame loop this state otherwise depends on to ever clear itself.
  // Without this, isFlying/target can be left stuck true for as long as the
  // tab stays unfocused, leaving the exhaust lit the whole time.
  const isFlyingRef = useRef(isFlying);
  isFlyingRef.current = isFlying;

  useEffect(() => {
    const disengageIfFlying = () => {
      if (!isFlyingRef.current) return;
      setTarget(null);
      setIsFlying(false);
    };

    window.addEventListener("blur", disengageIfFlying);

    const STUCK_FLIGHT_POLL_MS = 7000;
    const interval = setInterval(() => {
      if (!document.hasFocus()) disengageIfFlying();
    }, STUCK_FLIGHT_POLL_MS);

    return () => {
      window.removeEventListener("blur", disengageIfFlying);
      clearInterval(interval);
    };
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
