import { useAudioContext } from "../../context/audioContext";
import "./muteButton.css";

// Small fixed icon button (top-right, HUD-style) that toggles all app
// sound - engine hum, activation-zone bleep, and the ambient pad.
const MuteButton = () => {
  const { muted, toggleMute } = useAudioContext();

  return (
    <button
      id="mute-button"
      type="button"
      onClick={toggleMute}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      aria-pressed={muted}
      title={muted ? "Unmute" : "Mute"}
    >
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
    </button>
  );
};

export default MuteButton;
