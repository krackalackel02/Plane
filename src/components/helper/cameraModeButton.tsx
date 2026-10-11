import { useId } from "react";
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

// One picture per framing, from the ship's own scale out to the whole planet -
// solid currentColor glyphs, the same icon language as the exhaust button's.

/** Close: the ship itself, filling the frame - a rocket climbing up-right. */
const ShipIcon = () => (
  <g transform="rotate(45 12 12)">
    {/* The exhaust plume, fainter than the hull. */}
    <path
      d="M10 16.4Q12 23.6 14 16.4Z"
      fill="currentColor"
      fillOpacity="0.55"
    />
    <path
      // The hull, with the porthole cut out of it (even-odd).
      d="M12 2C15.6 4.6 16.6 8.6 16 15H8C7.4 8.6 8.4 4.6 12 2ZM13.6 8.6A1.6 1.6 0 1 0 10.4 8.6A1.6 1.6 0 1 0 13.6 8.6Z"
      fill="currentColor"
      fillRule="evenodd"
    />
    <path
      // Nozzle and fins - a separate path, so where the fins' roots overlap
      // the hull they join it instead of even-odd punching holes in it.
      d="M9.4 14.6H14.6V16.6H9.4ZM9.2 10.2L4.6 15.4L4.9 17.6L9 15.6ZM14.8 10.2L19.4 15.4L19.1 17.6L15 15.6Z"
      fill="currentColor"
    />
  </g>
);

// The skyline's towers: where each stands on the horizon (radians either side
// of straight up), how wide, and how tall.
const TOWERS: [number, number, number][] = [
  [-0.55, 2.4, 5],
  [-0.28, 2.6, 8],
  [0, 3.2, 11],
  [0.27, 2.6, 7.5],
  [0.52, 2.4, 5.5],
];
// The planet whose curve forms the horizon: centred below the icon.
const HORIZON = { cx: 12, cy: 30, r: 13 };

/**
 * Medium: part of the planet in view - its curved horizon clear across the
 * frame, with towers standing straight out of it.
 */
const HorizonIcon = () => (
  <>
    <circle
      cx={HORIZON.cx}
      cy={HORIZON.cy}
      r={HORIZON.r}
      fill="currentColor"
      fillOpacity="0.5"
    />
    {TOWERS.map(([angle, width, height]) => {
      const baseX = HORIZON.cx + HORIZON.r * Math.sin(angle);
      const baseY = HORIZON.cy - HORIZON.r * Math.cos(angle);
      return (
        // Each tower stands along the planet's radius at its foot, so the
        // skyline fans out over the curve; its foot sinks below the horizon.
        <g
          key={angle}
          transform={`rotate(${(angle * 180) / Math.PI} ${baseX} ${baseY})`}
        >
          <rect
            x={baseX - width / 2}
            y={baseY - height}
            width={width}
            height={height + 1.5}
            fill="currentColor"
          />
          {angle === 0 && (
            <path
              d={`M${baseX - 0.5} ${baseY - height}L${baseX} ${baseY - height - 3}L${baseX + 0.5} ${baseY - height}Z`}
              fill="currentColor"
            />
          )}
        </g>
      );
    })}
    {/* The horizon itself, crisp over the planet's fainter body. */}
    <circle
      cx={HORIZON.cx}
      cy={HORIZON.cy}
      r={HORIZON.r}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </>
);

/**
 * Far: the whole planet in view, wearing a tilted ring. The ring's near half
 * crosses in front of the planet through a gap cut in it (a mask), and its far
 * half is hidden behind, so it reads as going around rather than across.
 */
const RingedPlanetIcon = () => {
  const maskId = useId();
  const nearHalf = "M1.5 12A10.5 3.8 0 0 0 22.5 12";
  return (
    <>
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <path
          d={nearHalf}
          transform="rotate(-20 12 12)"
          fill="none"
          stroke="black"
          strokeWidth="3.4"
        />
      </mask>
      <g transform="rotate(-20 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="10.5"
          ry="3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </g>
      <circle
        cx="12"
        cy="12"
        r="6.3"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <path
        d={nearHalf}
        transform="rotate(-20 12 12)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  );
};

const MODE_ICON: Record<CameraMode, () => JSX.Element> = {
  close: ShipIcon,
  medium: HorizonIcon,
  max: RingedPlanetIcon,
};

const MODE_ICON_NAME: Record<CameraMode, string> = {
  close: "ship",
  medium: "horizon",
  max: "ringed-planet",
};

// Exported so the help modal (or anything else explaining the framings) can
// show the very same pictures.
export const ModeIcon = ({ mode }: { mode: CameraMode }) => {
  const Icon = MODE_ICON[mode];
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      data-icon={MODE_ICON_NAME[mode]}
    >
      <Icon />
    </svg>
  );
};

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
