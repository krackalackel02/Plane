import { useEffect, useRef, useState } from "react";
import {
  useExhaustModeContext,
  EXHAUST_MODE_ORDER,
} from "../../context/exhaustModeContext";
import { ExhaustMode } from "../ship/exhaust/types";
import "./exhaustModeButton.css";

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

// Speed-dial-style icon button that branches out into one node per exhaust
// look. On desktop, hovering (or focusing via keyboard) pops the branch open
// with a smooth animation - handled in CSS via :hover/:focus-within, no JS
// needed. Touch devices don't hover reliably, so a tap on the main button
// also toggles the same `--expanded` class; picking a node (any device)
// selects that mode and folds the branch back in.
const ExhaustModeButton = () => {
  const { mode, setMode } = useExhaustModeContext();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tapping/clicking anywhere outside while expanded (a touch device with no
  // hover-to-close) folds the branch back in.
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

  const selectMode = (next: ExhaustMode) => {
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
      className={`exhaust-mode-cluster${expanded ? " exhaust-mode-cluster--expanded" : ""}`}
    >
      <button
        className="hud-icon-button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-haspopup="true"
        aria-expanded={expanded}
        aria-label={`Exhaust style: ${MODE_LABEL[mode]} (open to switch)`}
        title={`Exhaust: ${MODE_LABEL[mode]}`}
      >
        <ModeIcon mode={mode} />
      </button>
      <div className="exhaust-mode-branch" role="menu">
        {EXHAUST_MODE_ORDER.map((option) => (
          <button
            key={option}
            className={`hud-icon-button exhaust-mode-node${option === mode ? " exhaust-mode-node--active" : ""}`}
            type="button"
            role="menuitemradio"
            aria-checked={option === mode}
            onClick={() => selectMode(option)}
            aria-label={`Switch exhaust style to ${MODE_LABEL[option]}`}
            title={MODE_LABEL[option]}
          >
            <ModeIcon mode={option} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExhaustModeButton;
