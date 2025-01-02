export type Color = [number, number, number];
export type ColorMapEntry = { limit: number; color: Color };
export type Range = { start: number; end: number } | null;
export type AxisType = "x" | "y" | "z";
export type MotionType = "roll" | "pitch" | "yaw" | "throttle";
export type BoardParams = {
  outerX: number;
  outerY: number;
  outerZ: number;
  frame: number;
  depth: number;
};

export type BoardProps = {
  imagePath?: string;
  helper?: boolean;
  position?: [number, number, number]; // New position prop
};

// Define types for controls and control states
export type ControlKeys = {
  roll: { positive: string; negative: string };
  pitch: { positive: string; negative: string };
  yaw: { positive: string; negative: string };
  throttle: { positive: string; negative: string };
  exhaust: string;
};

export type ControlState = {
  direction: "forward" | "neutral" | "backward";
  turn: "left" | "neutral" | "right";
};
