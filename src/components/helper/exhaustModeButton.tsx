import {
  useExhaustModeContext,
  EXHAUST_MODE_ORDER,
} from "../../context/exhaustModeContext";
import { ExhaustMode } from "../ship/exhaust/types";
import RadialNodeMenu, { RadialMenuNode } from "./radialNodeMenu";

export const MODE_LABEL: Record<ExhaustMode, string> = {
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

// Exported so the help modal can show the exact same glyphs when explaining
// what each exhaust look is.
export const ModeIcon = ({ mode }: { mode: ExhaustMode }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    {MODE_ICON[mode]}
  </svg>
);

// Fixed trigger glyph - a flame, standing for "exhaust" generally - rather
// than swapping to match whichever look is currently active. The active
// look is already communicated by the highlighted ring on its fan node
// (see .radial-node-menu__fan-node--active in radialNodeMenu.css), so the
// trigger's job is just to say "this button is about exhaust".
const FlameIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M12 2c-1.8 2.6-4.5 5-4.5 8.5a4.5 4.5 0 0 0 9 0c0-1.6-.6-2.9-1.3-3.9.2 1.5-.5 2.7-1.7 2.7a1.3 1.3 0 0 1-1.3-1.3c0-1.1.7-1.9.9-3.1C13.4 3.9 12.6 2.9 12 2z"
      fill="currentColor"
    />
  </svg>
);

// Speed-dial-style icon button whose sub-options fan out in an arc below
// it, built on the shared RadialNodeMenu template (see radialNodeMenu.tsx)
// - the same template any other HUD button with sub-options (e.g. a future
// audio submenu) can adopt. The three exhaust looks are the arc itself,
// not a separate list stacked underneath a quick-cycle shortcut.
const ExhaustModeButton = () => {
  const { mode, setMode } = useExhaustModeContext();

  const nodes: RadialMenuNode[] = EXHAUST_MODE_ORDER.map((option) => ({
    key: option,
    icon: <ModeIcon mode={option} />,
    label: `Switch exhaust style to ${MODE_LABEL[option]}`,
    active: option === mode,
    onSelect: () => setMode(option),
  }));

  return (
    <RadialNodeMenu
      trigger={<FlameIcon />}
      triggerLabel={`Exhaust style: ${MODE_LABEL[mode]} (open to switch)`}
      nodes={nodes}
    />
  );
};

export default ExhaustModeButton;
