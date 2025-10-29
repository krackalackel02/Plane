import { config } from "../context/envContext";

/**
 * Logging function that depends on the environment context
 * @param args - The arguments to log
 */
export const print = (...args: unknown[]) => {
  if (config.showDebug) {
    console.log(...args);
  }
};
