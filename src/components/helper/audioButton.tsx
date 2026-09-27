import { useAudioContext } from "../../context/audioContext";
import RadialNodeMenu, { RadialMenuNode } from "./radialNodeMenu";

// Trigger glyph - swaps between unmuted/muted speaker shapes to reflect
// overall mute state at a glance. The one icon in this button that isn't
// fixed, unlike the mute/music/sfx sub-icons below, which each keep one
// glyph and communicate their state through their ring instead.
const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
    {muted ? (
      <>
        <line
          x1="16"
          y1="9"
          x2="22"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="22"
          y1="9"
          x2="16"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        <path
          d="M16.5 8.5a5 5 0 0 1 0 7"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M19 6a9 9 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
);

// Fixed glyph for the "Mute" sub-node - always the muted-speaker shape;
// its highlighted ring (red when active) communicates whether mute is
// currently on, not the icon itself.
const MuteIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
    <line
      x1="16"
      y1="9"
      x2="22"
      y2="15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="22"
      y1="9"
      x2="16"
      y2="15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const MusicNoteIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <ellipse
      cx="7"
      cy="18"
      rx="3"
      ry="2.3"
      fill="currentColor"
      transform="rotate(-15 7 18)"
    />
    <rect x="9.3" y="4" width="1.6" height="14" fill="currentColor" />
    <path
      d="M10.9 4c2 .5 3.5 2 3.8 4.2-1.6-.6-3-.3-3.8.6V4z"
      fill="currentColor"
    />
  </svg>
);

const WhooshIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <line
      x1="4"
      y1="8"
      x2="18"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="4"
      y1="13"
      x2="20"
      y2="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="4"
      y1="18"
      x2="15"
      y2="15.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Speed-dial-style icon button whose sub-options - mute, background
// music, sound effects - fan out in an arc below it, built on the shared
// RadialNodeMenu template (see radialNodeMenu.tsx). Unlike exhaust's
// mutually-exclusive picker, these three are independent toggles: mute
// turns everything off (red ring when on), while background music and
// sound effects can each be switched on/off on their own (green ring
// when on). Turning on either sound channel also unmutes - see
// audioEngine.setMusicEnabled/setSfxEnabled - so a channel you just
// switched on is actually audible rather than silently doing nothing.
const AudioButton = () => {
  const {
    muted,
    toggleMute,
    musicEnabled,
    toggleMusic,
    sfxEnabled,
    toggleSfx,
  } = useAudioContext();

  const nodes: RadialMenuNode[] = [
    {
      key: "mute",
      icon: <MuteIcon />,
      label: "Mute",
      active: muted,
      toggle: true,
      activeTone: "danger",
      onSelect: toggleMute,
    },
    {
      key: "music",
      icon: <MusicNoteIcon />,
      label: "Background music",
      active: musicEnabled,
      toggle: true,
      activeTone: "success",
      onSelect: toggleMusic,
    },
    {
      key: "sfx",
      icon: <WhooshIcon />,
      label: "Sound effects",
      active: sfxEnabled,
      toggle: true,
      activeTone: "success",
      onSelect: toggleSfx,
    },
  ];

  return (
    <RadialNodeMenu
      trigger={<SpeakerIcon muted={muted} />}
      triggerLabel={`Audio: ${muted ? "Muted" : "Unmuted"} (open to adjust)`}
      nodes={nodes}
    />
  );
};

export default AudioButton;
