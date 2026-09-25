import React, { createContext, useContext, useState, useCallback } from "react";

interface TrickContextType {
  // A unique token identifying the current trick request, or null when no
  // trick is pending/playing. A token (rather than a boolean) lets Physics
  // tell a brand new request apart from one it's already handling.
  trickToken: number | null;
  requestTrick: () => void;
  clearTrick: () => void;
}

const TrickContext = createContext<TrickContextType | null>(null);

export const TrickProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [trickToken, setTrickToken] = useState<number | null>(null);

  // Ignores taps that land while a trick is already queued/playing, so
  // rapid tapping can't restart the animation mid-roll.
  const requestTrick = useCallback(() => {
    setTrickToken((prev) => (prev === null ? Date.now() : prev));
  }, []);

  const clearTrick = useCallback(() => {
    setTrickToken(null);
  }, []);

  return (
    <TrickContext.Provider value={{ trickToken, requestTrick, clearTrick }}>
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
