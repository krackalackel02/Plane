import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { isMobile } from "react-device-detect";
import cameraModes from "../utils/cameraModes.json";

export type CameraMode = "close" | "medium" | "max";
export const CAMERA_MODE_ORDER: CameraMode[] = ["close", "medium", "max"];

export interface CameraModePreset {
  position: { x: number; y: number; z: number };
  lookingAt: { x: number; y: number; z: number };
}

const STORAGE_KEY = "plane:camera-mode";
const DEFAULT_MODE: CameraMode = "medium";

const readStoredMode = (): CameraMode | null => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && (CAMERA_MODE_ORDER as string[]).includes(stored)
    ? (stored as CameraMode)
    : null;
};

// Each mode is tuned separately for mobile vs desktop, since their
// different aspect ratios mean the same world-space offset frames very
// differently (see utils/cameraModes.json).
const deviceModes = (): Record<CameraMode, CameraModePreset> =>
  isMobile ? cameraModes.mobile : cameraModes.desktop;

interface CameraModeContextType {
  mode: CameraMode;
  setMode: (mode: CameraMode) => void;
  preset: CameraModePreset;
}

const CameraModeContext = createContext<CameraModeContextType>({
  mode: DEFAULT_MODE,
  setMode: () => {},
  preset: cameraModes.desktop[DEFAULT_MODE],
});

/**
 * Lets the camera-mode HUD button switch between three fixed chase-cam
 * framings - close/medium/max - each its own tuned local offset from the
 * ship rather than a zoom/FOV change. Defaults to "medium" and persists the
 * player's own choice across visits, same pattern as exhaustModeContext.
 */
export const CameraModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<CameraMode>(
    () => readStoredMode() ?? DEFAULT_MODE,
  );

  const setMode = useCallback((next: CameraMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  // Stable across renders unless `mode` itself changes - consumers (e.g.
  // animate()'s intro flythrough) key effects off this reference, so a
  // fresh object every render would retrigger them on every unrelated
  // re-render of the provider.
  const preset = useMemo(() => deviceModes()[mode], [mode]);

  return (
    <CameraModeContext.Provider value={{ mode, setMode, preset }}>
      {children}
    </CameraModeContext.Provider>
  );
};

export const useCameraMode = () => useContext(CameraModeContext);
