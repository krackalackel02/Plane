import { config } from "../context/envContext";

// Logging function that depends on the environment context
export const log = (...args: unknown[]) => {
  if (config.showDebug) {
    console.log(...args);
  }
};
