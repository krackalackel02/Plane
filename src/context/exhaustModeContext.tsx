import React, { createContext, useCallback, useContext, useState } from "react";
import { resolveExhaustMode } from "../components/ship/exhaust/mode";
import { ExhaustMode } from "../components/ship/exhaust/types";

const STORAGE_KEY = "plane:exhaust-mode";
const MODE_ORDER: ExhaustMode[] = ["particles", "clouds", "voxels"];

const readStoredMode = (): ExhaustMode | null => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && (MODE_ORDER as string[]).includes(stored)
    ? (stored as ExhaustMode)
    : null;
};

interface ExhaustModeContextType {
  mode: ExhaustMode;
  cycleMode: () => void;
}

const ExhaustModeContext = createContext<ExhaustModeContextType>({
  mode: "clouds",
  cycleMode: () => {},
});

// Lets the exhaust-mode HUD button switch the ship's exhaust look live,
// without needing VITE_EXHAUST_MODE + a reload. Falls back to that env var
// (via resolveExhaustMode) only the first time, before the player has ever
// picked a mode themselves.
export const ExhaustModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<ExhaustMode>(
    () => readStoredMode() ?? resolveExhaustMode(),
  );

  const cycleMode = useCallback(() => {
    setMode((current) => {
      const next =
        MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length];
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ExhaustModeContext.Provider value={{ mode, cycleMode }}>
      {children}
    </ExhaustModeContext.Provider>
  );
};

export const useExhaustModeContext = () => useContext(ExhaustModeContext);
