import { useControls } from "leva";
import { createSaveButton } from "../../../utils/debugSaveButton";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Get control properties for a specific motion parameter
 * @param key id of control
 * @returns control properties
 */
const getControlProps = (key: string) => {
  if (key === "decayFactor") return { min: 0, max: 1, step: 0.05 };
  if (key === "stiffness") return { min: 0, max: 100, step: 1 };
  if (key === "damping") return { min: 0, max: 10, step: 0.1 };
  if (key === "maxAngle") return { min: 0, max: 90, step: 1 };
  if (key === "acceleration") return { min: 0, max: 1, step: 0.01 };
  if (key === "maxSpeed") return { min: 0, max: 100, step: 1 };
  if (key === "speed") return { min: 1, max: 50, step: 1 };
  return { min: 0, max: 10, step: 1 };
};

interface PhysicsDebugControlsProps {
  params: Record<string, Record<string, any>>;
  setParams: (
    updater: (
      prev: Record<string, Record<string, any>>,
    ) => Record<string, Record<string, any>>,
  ) => void;
}

// Leva panel for tuning ship motion constants live. Split into its own
// lazy-loaded chunk (see physics/index.tsx) so leva - never used outside
// this debug path - doesn't ship in the main bundle.
const PhysicsDebugControls = ({
  params,
  setParams,
}: PhysicsDebugControlsProps) => {
  Object.keys(params).forEach((type) => {
    const config = params[type];
    useControls(
      type,
      Object.entries(config).reduce(
        (acc, [key, value]) => {
          if (typeof value !== "number") return acc;
          const { min, max, step } = getControlProps(key);
          acc[key] = {
            value,
            min,
            max,
            step,
            onChange: (value: number) =>
              setParams((prev) => ({
                ...prev,
                [type]: { ...prev[type], [key]: value },
              })),
          };
          return acc;
        },
        {} as Record<string, any>,
      ),
      [params],
    );
  });

  useControls({
    Save: createSaveButton(params, "motionConstants.json"),
  });

  return null;
};

export default PhysicsDebugControls;
