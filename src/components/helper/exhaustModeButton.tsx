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

const ChevronIcon = ({ direction }: { direction: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      d={direction === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Speed-dial-style icon button that branches out into one node per exhaust
// look, built on the shared RadialNodeMenu template (see radialNodeMenu.tsx)
// - the same template any other HUD button with sub-options (e.g. a future
// audio submenu) can adopt. The vertical list beneath the trigger holds the
// full picker (all three looks); the arc nodes flanking it left/right are a
// quick-cycle shortcut to the previous/next look without opening the list.
const ExhaustModeButton = () => {
  const { mode, setMode } = useExhaustModeContext();

  const nodes: RadialMenuNode[] = EXHAUST_MODE_ORDER.map((option) => ({
    key: option,
    icon: <ModeIcon mode={option} />,
    label: `Switch exhaust style to ${MODE_LABEL[option]}`,
    active: option === mode,
    onSelect: () => setMode(option),
  }));

  const currentIndex = EXHAUST_MODE_ORDER.indexOf(mode);
  const modeCount = EXHAUST_MODE_ORDER.length;
  const previousMode =
    EXHAUST_MODE_ORDER[(currentIndex - 1 + modeCount) % modeCount];
  const nextMode = EXHAUST_MODE_ORDER[(currentIndex + 1) % modeCount];

  const arcNodes: RadialMenuNode[] = [
    {
      key: "previous",
      icon: <ChevronIcon direction="left" />,
      label: `Previous exhaust style: ${MODE_LABEL[previousMode]}`,
      onSelect: () => setMode(previousMode),
    },
    {
      key: "next",
      icon: <ChevronIcon direction="right" />,
      label: `Next exhaust style: ${MODE_LABEL[nextMode]}`,
      onSelect: () => setMode(nextMode),
    },
  ];

  return (
    <RadialNodeMenu
      trigger={<ModeIcon mode={mode} />}
      triggerLabel={`Exhaust style: ${MODE_LABEL[mode]} (open to switch)`}
      nodes={nodes}
      arcNodes={arcNodes}
    />
  );
};

export default ExhaustModeButton;
