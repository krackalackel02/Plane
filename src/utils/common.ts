import { useEnvironment } from "../context/envContext";

// Logging function that depends on the environment context
export const print = (...args: unknown[]) => {
  const { showDebug } = useEnvironment();
  if (showDebug) {
    console.log(...args);
  }
};
