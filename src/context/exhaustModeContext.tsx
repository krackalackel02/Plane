import React, { createContext, useCallback, useContext, useState } from "react";
import { resolveExhaustMode } from "../components/ship/exhaust/mode";
import { ExhaustMode } from "../components/ship/exhaust/types";

const STORAGE_KEY = "plane:exhaust-mode";
export const EXHAUST_MODE_ORDER: ExhaustMode[] = [
  "particles",
  "clouds",
  "voxels",
];

const readStoredMode = (): ExhaustMode | null => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && (EXHAUST_MODE_ORDER as string[]).includes(stored)
    ? (stored as ExhaustMode)
    : null;
};

interface ExhaustModeContextType {
  mode: ExhaustMode;
  setMode: (mode: ExhaustMode) => void;
}

const ExhaustModeContext = createContext<ExhaustModeContextType>({
  mode: "clouds",
  setMode: () => {},
});

// Lets the exhaust-mode HUD button switch the ship's exhaust look live,
// without needing VITE_EXHAUST_MODE + a reload. Falls back to that env var
// (via resolveExhaustMode) only the first time, before the player has ever
// picked a mode themselves.
export const ExhaustModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<ExhaustMode>(
    () => readStoredMode() ?? resolveExhaustMode(),
  );

  const setMode = useCallback((next: ExhaustMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return (
    <ExhaustModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ExhaustModeContext.Provider>
  );
};

export const useExhaustModeContext = () => useContext(ExhaustModeContext);
