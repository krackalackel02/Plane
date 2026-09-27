import { ComponentType } from "react";
import BoardSandbox from "./components/boardSandbox";
import ShipSandbox from "./components/shipSandbox";

export interface SandboxEntry {
  key: string;
  label: string;
  description: string;
  Component: ComponentType;
}

// Registering a new component to inspect/tune in isolation is: write a
// thin wrapper under ./components that centers the real component at the
// origin (and exposes a leva useControls() panel for whatever props it
// takes), then add one entry here. The sandbox shell (sandboxApp.tsx)
// takes care of the camera, lights, providers and component picker.
export const SANDBOX_REGISTRY: SandboxEntry[] = [
  {
    key: "board",
    label: "Board",
    description:
      "src/components/timeline/board.tsx - the picture-frame timeline board",
    Component: BoardSandbox,
  },
  {
    key: "ship",
    label: "Ship",
    description: "src/components/ship - the ship body + exhaust jets",
    Component: ShipSandbox,
  },
];

export const getSandboxEntry = (key: string | null): SandboxEntry | null =>
  SANDBOX_REGISTRY.find((entry) => entry.key === key) ?? null;
