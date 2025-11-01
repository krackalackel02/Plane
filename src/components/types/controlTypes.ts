export type AxisType = "x" | "y" | "z";
export type MotionType = "roll" | "pitch" | "yaw" | "throttle";
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
