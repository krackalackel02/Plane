import { config } from "../context/envContext";
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Logging function that depends on the environment context
 * @param args - The arguments to log
 */
export const print = (...args: unknown[]) => {
  if (config.showDebug) {
    console.log(...args);
  }
};

/**
 * A custom hook that executes a callback function at a throttled interval within the render loop.
 * It effectively makes the callback "sleep" between executions.
 * @param callback The function to execute after the interval has passed.
 * @param interval The "sleep" time in seconds between each execution.
 * @param enabled An optional boolean to easily enable or disable the hook. Defaults to true.
 */
export const useFrameDelay = (
  callback: () => void,
  interval: number,
  enabled = true,
) => {
  const lastExecutionTime = useRef(0);

  // Use a ref to hold the callback to ensure the latest version is always used.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useFrame((state) => {
    if (!enabled) return;

    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastExecutionTime.current > interval) {
      lastExecutionTime.current = currentTime;
      callbackRef.current(); // Execute the callback
    }
  });
};
