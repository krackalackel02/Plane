import React, { createContext, useContext, useState } from "react";

interface BoundaryContextType {
  // True while the ship is pressed against the world boundary (see
  // utils/worldBounds and ship/physics/collision) and still thrusting
  // outward against it - not merely touching it while drifting or backing
  // away.
  isOutOfZone: boolean;
  setIsOutOfZone: (outOfZone: boolean) => void;
}

const BoundaryContext = createContext<BoundaryContextType | null>(null);

export const BoundaryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOutOfZone, setIsOutOfZone] = useState(false);

  return (
    <BoundaryContext.Provider value={{ isOutOfZone, setIsOutOfZone }}>
      {children}
    </BoundaryContext.Provider>
  );
};

export const useBoundary = () => {
  const context = useContext(BoundaryContext);
  if (!context) {
    throw new Error("useBoundary must be used within a BoundaryProvider");
  }
  return context;
};
