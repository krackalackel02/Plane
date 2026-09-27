import React, { createContext, useContext, useState, useCallback } from "react";

// +1 matches the roll motion's positive/ArrowRight direction (rolling
// right), -1 matches negative/ArrowLeft (rolling left).
export type TrickDirection = 1 | -1;

export interface TrickRequest {
  id: number;
  direction: TrickDirection;
}

interface TrickContextType {
  // A pending/in-flight request from a tap, or null when no trick is
  // queued. Carries a unique id (rather than being a plain boolean) so
  // Physics can tell a brand new request apart from one it's already
  // handling, plus the randomized direction it should roll.
  trickRequest: TrickRequest | null;
  requestTrick: () => void;
  clearTrickRequest: () => void;
  // The direction currently playing out, or null when no trick is active -
  // set by Physics once it starts consuming a request. Exists so the
  // exhaust jets can flare the correct side while the roll plays.
  activeTrickDirection: TrickDirection | null;
  setActiveTrickDirection: (direction: TrickDirection | null) => void;
}

const TrickContext = createContext<TrickContextType | null>(null);

export const TrickProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [trickRequest, setTrickRequest] = useState<TrickRequest | null>(null);
  const [activeTrickDirection, setActiveTrickDirection] =
    useState<TrickDirection | null>(null);

  // Ignores taps that land while a trick is already queued/playing, so
  // rapid tapping can't restart the animation mid-roll.
  const requestTrick = useCallback(() => {
    setTrickRequest(
      (prev) =>
        prev ?? {
          id: Date.now(),
          direction: Math.random() < 0.5 ? 1 : -1,
        },
    );
  }, []);

  const clearTrickRequest = useCallback(() => {
    setTrickRequest(null);
  }, []);

  return (
    <TrickContext.Provider
      value={{
        trickRequest,
        requestTrick,
        clearTrickRequest,
        activeTrickDirection,
        setActiveTrickDirection,
      }}
    >
      {children}
    </TrickContext.Provider>
  );
};

export const useTrick = () => {
  const context = useContext(TrickContext);
  if (!context) {
    throw new Error("useTrick must be used within a TrickProvider");
  }
  return context;
};
