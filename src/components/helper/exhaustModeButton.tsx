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

// One inline icon per exhaust look - and the flame trigger below - all
// drawn as solid currentColor fills (no outline-only glyphs) so the whole
// set reads as one consistent icon language wherever it appears together:
// the HUD fan, and the help modal's preview of that same button.
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
  // An isometric cube, its three faces filled at different opacities
  // (light from the top-right) to read as a solid 3D shape rather than a
  // thin wireframe outline - matching the filled weight of its siblings.
  voxels: (
    <>
      <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" fill="currentColor" />
      <path
        d="M4 7.5l8 4.5v9l-8-4.5v-9z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <path
        d="M20 7.5l-8 4.5v9l8-4.5v-9z"
        fill="currentColor"
        fillOpacity="0.8"
      />
    </>
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
export const FlameIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M12.5 2c.5 3-1 4.7-2.8 6.7C7.8 10.8 6 12.9 6 15.5a6 6 0 0 0 12 0c0-2.5-1-4.4-2.2-6 .5 2.3-.6 4-2.2 4a2 2 0 0 1-2-2c0-1.2.7-2 1.4-3C14.3 6.7 13.3 4.4 12.5 2z"
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
