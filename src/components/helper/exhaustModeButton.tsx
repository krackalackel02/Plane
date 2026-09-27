import { useExhaustModeContext } from "../../context/exhaustModeContext";
import { ExhaustMode } from "../ship/exhaust/types";

const MODE_LABEL: Record<ExhaustMode, string> = {
  particles: "Particles",
  clouds: "Clouds",
  voxels: "Voxels",
};

// One inline icon per exhaust look, drawn in the same plain-stroke style as
// MuteButton's speaker glyph rather than emoji, so the HUD stays visually
// consistent.
const MODE_ICON: Record<ExhaustMode, React.ReactNode> = {
  particles: (
    <>
      <circle cx="6" cy="13" r="1.8" fill="currentColor" />
      <circle cx="12" cy="7" r="1.8" fill="currentColor" />
      <circle cx="18" cy="14" r="1.8" fill="currentColor" />
    </>
  ),
  clouds: (
    <path
      d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16 8.06 4.5 4.5 0 0 1 17 18H7z"
      fill="currentColor"
    />
  ),
  voxels: (
    <path
      d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M12 3v18 M4 7.5l8 4.5 8-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
};

// Icon button that cycles the ship's exhaust look (particles -> clouds ->
// voxels -> ...). Docked inside HudCorner (see scene.tsx) alongside mute
// and help - same shared chrome, this is just the icon and click handler.
const ExhaustModeButton = () => {
  const { mode, cycleMode } = useExhaustModeContext();

  return (
    <button
      className="hud-icon-button"
      type="button"
      onClick={cycleMode}
      aria-label={`Exhaust style: ${MODE_LABEL[mode]} (click to switch)`}
      title={`Exhaust: ${MODE_LABEL[mode]}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {MODE_ICON[mode]}
      </svg>
    </button>
  );
};

export default ExhaustModeButton;
