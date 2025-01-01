import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// Create context
const KeyContext = createContext<Set<string>>(new Set());

// Hook to use the KeyContext
export const useKeyContext = () => {
  return useContext(KeyContext);
};

// Provider component
export const KeyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    setActiveKeys((prev) => {
      const next = new Set(prev).add(key);
      //   console.log(`${key === " " ? "space" : key} down`);
      //   console.log("Updated Keys (after add):", next);
      return next;
    });
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      //   console.log(`${key === " " ? "space" : key} up`);
      //   console.log("Updated Keys (after delete):", next);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <KeyContext.Provider value={activeKeys}>{children}</KeyContext.Provider>
  );
};
