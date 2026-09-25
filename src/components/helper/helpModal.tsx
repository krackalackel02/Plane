import { useRef, useState } from "react";
import { isMobile } from "react-device-detect";
import { Keycap, JoystickIcon } from "./controlIcons";
import { GLITCH_EXIT_MS } from "./glitchTiming";
import "./helpModal.css";

/* eslint-disable react/prop-types -- TS interfaces already cover this */

interface HelpModalProps {
  onClose: () => void;
}

const PcControls = () => (
  <div className="help-controls">
    <div className="help-row">
      <div className="help-cluster">
        <div className="keycap-row">
          <Keycap label="W" />
        </div>
        <div className="keycap-row">
          <Keycap label="A" />
          <Keycap label="S" />
          <Keycap label="D" />
        </div>
      </div>
      <p className="help-copy">Throttle forward/back, turn left/right</p>
    </div>

    <div className="help-row">
      <div className="help-cluster">
        <div className="keycap-row">
          <Keycap label="↑" />
        </div>
        <div className="keycap-row">
          <Keycap label="←" />
          <Keycap label="↓" />
          <Keycap label="→" />
        </div>
      </div>
      <p className="help-copy">Pitch and roll the ship</p>
    </div>

    <div className="help-row">
      <div className="help-cluster">
        <Keycap label="Space" wide />
      </div>
      <p className="help-copy">Fire the exhaust boost</p>
    </div>

    <div className="help-row">
      <div className="help-cluster">
        <Keycap label="0" />
        <Keycap label="1-9" wide />
      </div>
      <p className="help-copy">Autopilot to home / any project</p>
    </div>

    <div className="help-row">
      <div className="help-cluster help-cluster--text">🖱️</div>
      <p className="help-copy">Click a glowing board to fly there</p>
    </div>

    <div className="help-row">
      <div className="help-cluster help-cluster--text">🗺️</div>
      <p className="help-copy">
        Click the map in the corner to expand it, then click a book icon to
        autopilot straight there
      </p>
    </div>
  </div>
);

const MobileControls = () => (
  <div className="help-controls">
    <div className="help-row">
      <JoystickIcon />
      <p className="help-copy">Drag the joystick to throttle and turn</p>
    </div>

    <div className="help-row">
      <div className="help-cluster help-cluster--text">👆</div>
      <p className="help-copy">Swipe directly on the ship to pitch and roll</p>
    </div>

    <div className="help-row">
      <div className="help-cluster help-cluster--text">✦</div>
      <p className="help-copy">Tap a glowing board to fly there</p>
    </div>

    <div className="help-row">
      <div className="help-cluster help-cluster--text">🗺️</div>
      <p className="help-copy">
        Tap the map in the corner to expand it, then tap a book icon to
        autopilot straight there
      </p>
    </div>
  </div>
);

// Full controls reference, reopenable via the persistent "?" button. Content
// branches on device so touch users never see a keyboard diagram, and desktop
// users never see a joystick. Shares the welcome popup's glitchy HUD-panel
// styling (welcome-alert) and exit transition so the two feel like one system.
const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, GLITCH_EXIT_MS);
  };

  return (
    <div className="welcome-backdrop" onClick={requestClose}>
      <div
        className={`welcome-alert help-modal${closing ? " welcome-alert--closing" : ""}`}
        role="dialog"
        aria-label="Controls"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="welcome-alert-close"
          onClick={requestClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="welcome-alert-title">Controls</h2>
        {isMobile ? <MobileControls /> : <PcControls />}
      </div>
    </div>
  );
};

export default HelpModal;
