import {
  useCameraMode,
  CameraMode,
  CAMERA_MODE_ORDER,
} from "../../context/cameraModeContext";
import RadialNodeMenu, { RadialMenuNode } from "./radialNodeMenu";

export const MODE_LABEL: Record<CameraMode, string> = {
  close: "Close",
  medium: "Medium",
  max: "Zoomed Out",
};

// Filled-dot radius per mode - bigger dot reads as "subject fills the
// frame" (close), smaller dot as "subject is a small thing in a big view"
// (zoomed out), same visual shorthand photographers use for framing.
const MODE_DOT_RADIUS: Record<CameraMode, number> = {
  close: 7,
  medium: 4.5,
  max: 2.5,
};

const MainIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M4 8a2 2 0 0 1 2-2h1.6l1-1.5h6.8L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="13"
      r="3.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const ModeIcon = ({ mode }: { mode: CameraMode }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      opacity="0.4"
    />
    <circle cx="12" cy="12" r={MODE_DOT_RADIUS[mode]} fill="currentColor" />
  </svg>
);

// Speed-dial icon button whose camera framings (close/medium/max) fan out in
// an arc below it, built on the shared RadialNodeMenu template (see
// radialNodeMenu.tsx) - the same one the audio and exhaust buttons use, so
// all three HUD buttons open, fan out and dismiss identically: hover on
// desktop, a single tap on touch, an edge-aware fan, and the mobile
// tap-swallowing fixes that template carries. Picking a node glides the
// camera there (see camera/index.tsx) and folds the fan back in.
const CameraModeButton = () => {
  const { mode, setMode } = useCameraMode();

  const nodes: RadialMenuNode[] = CAMERA_MODE_ORDER.map((option) => ({
    key: option,
    icon: <ModeIcon mode={option} />,
    label: `Switch camera framing to ${MODE_LABEL[option]}`,
    active: option === mode,
    onSelect: () => setMode(option),
  }));

  return (
    <RadialNodeMenu
      trigger={<MainIcon />}
      triggerLabel={`Camera framing: ${MODE_LABEL[mode]} (open to switch)`}
      nodes={nodes}
    />
  );
};

export default CameraModeButton;
