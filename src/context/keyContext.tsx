import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { print } from "../utils/common"; // Debug print utility
import keys from "../utils/keys.json"; // Key mappings
import { ControlKeys, ControlState } from "../components/types/controlTypes"; // Control types/states

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
  /// State for active keys; controlState is derived from it below rather
  /// than tracked as its own state - setting it from inside the
  /// setActiveKeys updater (as this used to) is a React anti-pattern
  /// (updater functions must be pure; StrictMode double-invokes them
  /// specifically to catch side effects like this) and left the two state
  /// values only ever in sync by both being computed from the same call.
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const controlState = useMemo(
    () => determineControlState(activeKeys),
    [activeKeys],
  );

  const pressKey = useCallback((key: string) => {
    setActiveKeys((prev) => {
      if (prev.has(key)) return prev;
      const updatedKeys = new Set(prev).add(key);
      print(`${key} down`);
      print("Updated Keys (after add):", updatedKeys);
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
      return updatedKeys;
    });
  }, []);

  /// Event handlers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => pressKey(event.key),
    [pressKey],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => releaseKey(event.key),
    [releaseKey],
  );

  // A key held down when focus leaves the window (e.g. the project popup's
  // "View Demo"/"View Code" links, or the Enter-to-open-link shortcut in
  // Highlight, open a new tab) never gets its keyup delivered here - the OS
  // sends that keyup to whatever now has focus instead. Without this, the
  // key reads as permanently "held", leaving the ship stuck turning/
  // throttling on its own and autopilot unable to re-engage (it treats the
  // phantom input as the player taking manual control).
  const handleBlur = useCallback(() => {
    setActiveKeys((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  // Attach and detach event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);

  const keyControls = useMemo(
    () => ({ pressKey, releaseKey }),
    [pressKey, releaseKey],
  );

  // Backstop against any stuck-key path we haven't found yet - independent
  // of whether keyup/blur actually fired. The page cannot genuinely have a
  // key held down while it lacks focus, so periodically verify that ground
  // truth and self-heal instead of trusting event delivery alone.
  useEffect(() => {
    const STUCK_KEY_POLL_MS = 7000;
    const interval = setInterval(() => {
      if (!document.hasFocus()) {
        setActiveKeys((prev) => (prev.size === 0 ? prev : new Set()));
      }
    }, STUCK_KEY_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Dev-only hook so Playwright (a real browser, unlike the component
  // tests' jsdom) can assert which keys a touch control actually produced.
  // import.meta.env.DEV is false in a production build, so this never
  // ships to the deployed GitHub Pages bundle.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __activeKeys?: Set<string> }).__activeKeys =
        activeKeys;
    }
  }, [activeKeys]);

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
