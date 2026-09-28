import { useEffect, useRef, useState } from "react";
import {
  useCameraMode,
  CameraMode,
  CAMERA_MODE_ORDER,
} from "../../context/cameraModeContext";
import "./cameraModeButton.css";

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

// Speed-dial-style icon button that branches out into one node per camera
// framing (close/medium/max) - same interaction pattern as
// ExhaustModeButton: hovering (or focusing) pops the branch open on
// desktop, a tap toggles it on touch devices, and picking a node glides the
// camera there (see camera/index.tsx) and folds the branch back in.
const CameraModeButton = () => {
  const { mode, setMode } = useCameraMode();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [expanded]);

  const selectMode = (next: CameraMode) => {
    setMode(next);
    setExpanded(false);
    // A clicked/tapped button keeps DOM focus afterward, which would hold
    // the branch open via :focus-within (see the CSS) even though we just
    // asked it to close - drop focus so the collapse actually happens.
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div
      ref={rootRef}
      className={`camera-mode-cluster${expanded ? " camera-mode-cluster--expanded" : ""}`}
    >
      <button
        className="hud-icon-button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-haspopup="true"
        aria-expanded={expanded}
        aria-label={`Camera framing: ${MODE_LABEL[mode]} (open to switch)`}
        title={`Camera: ${MODE_LABEL[mode]}`}
      >
        <MainIcon />
      </button>
      <div className="camera-mode-branch" role="menu">
        {CAMERA_MODE_ORDER.map((option) => (
          <button
            key={option}
            className={`hud-icon-button camera-mode-node${option === mode ? " camera-mode-node--active" : ""}`}
            type="button"
            role="menuitemradio"
            aria-checked={option === mode}
            onClick={() => selectMode(option)}
            aria-label={`Switch camera framing to ${MODE_LABEL[option]}`}
            title={MODE_LABEL[option]}
          >
            <ModeIcon mode={option} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default CameraModeButton;
