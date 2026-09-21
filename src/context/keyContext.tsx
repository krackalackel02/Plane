import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { print } from "../utils/common";
import keys from "../utils/keys.json";
import { ControlKeys, ControlState } from "../components/types/types";

// Import and assert control keys
const controlKeys = keys as ControlKeys;

// Contexts for managing state
const KeyContext = createContext<Set<string>>(new Set());
const ControlStateContext = createContext<ControlState>({
  direction: "neutral",
  turn: "neutral",
});

interface KeyControls {
  pressKey: (key: string) => void;
  releaseKey: (key: string) => void;
}
const KeyControlsContext = createContext<KeyControls>({
  pressKey: () => {},
  releaseKey: () => {},
});

// Custom hooks
export const useKeyContext = () => useContext(KeyContext);
export const useControlState = () => useContext(ControlStateContext);
// Lets non-keyboard input (e.g. touch joysticks) drive the same activeKeys
// set that keydown/keyup events do, so Physics/exhaust need no changes.
export const useKeyControls = () => useContext(KeyControlsContext);

// Helper to detect control state
const determineControlState = (activeKeys: Set<string>): ControlState => {
  const isForward =
    activeKeys.has(controlKeys.exhaust) ||
    activeKeys.has(controlKeys.throttle.positive) ||
    activeKeys.has(controlKeys.pitch.positive);
  const isBackward =
    activeKeys.has(controlKeys.throttle.negative) ||
    activeKeys.has(controlKeys.pitch.negative);
  const isRight =
    activeKeys.has(controlKeys.roll.positive) ||
    activeKeys.has(controlKeys.yaw.negative);
  const isLeft =
    activeKeys.has(controlKeys.roll.negative) ||
    activeKeys.has(controlKeys.yaw.positive);

  return {
    direction: isForward ? "forward" : isBackward ? "backward" : "neutral",
    turn: isLeft ? "left" : isRight ? "right" : "neutral",
  };
};

// Provider component
export const KeyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [controlState, setControlState] = useState<ControlState>({
    direction: "neutral",
    turn: "neutral",
  });

  const pressKey = useCallback((key: string) => {
    setActiveKeys((prev) => {
      if (prev.has(key)) return prev;

      const updatedKeys = new Set(prev).add(key);
      print(`${key} down`);
      print("Updated Keys (after add):", updatedKeys);

      setControlState(determineControlState(updatedKeys));
      return updatedKeys;
    });
  }, []);

  const releaseKey = useCallback((key: string) => {
    setActiveKeys((prev) => {
      if (!prev.has(key)) return prev;

      const updatedKeys = new Set(prev);
      updatedKeys.delete(key);
      print(`${key} up`);
      print("Updated Keys (after delete):", updatedKeys);

      setControlState(determineControlState(updatedKeys));
      return updatedKeys;
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => pressKey(event.key),
    [pressKey],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => releaseKey(event.key),
    [releaseKey],
  );

  // Attach and detach event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const keyControls = useMemo(
    () => ({ pressKey, releaseKey }),
    [pressKey, releaseKey],
  );

  return (
    <KeyContext.Provider value={activeKeys}>
      <ControlStateContext.Provider value={controlState}>
        <KeyControlsContext.Provider value={keyControls}>
          {children}
        </KeyControlsContext.Provider>
      </ControlStateContext.Provider>
    </KeyContext.Provider>
  );
};
