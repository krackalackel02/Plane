import { isMobile } from "react-device-detect";
import "./helpModal.css";

/* eslint-disable react/prop-types -- TS interfaces already cover this */

interface HelpModalProps {
  onClose: () => void;
}

interface KeycapProps {
  label: string;
  wide?: boolean;
}

// A single cartoony beveled keyboard key.
const Keycap: React.FC<KeycapProps> = ({ label, wide = false }) => (
  <span className={`keycap${wide ? " keycap--wide" : ""}`}>{label}</span>
);

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
  </div>
);

const MobileControls = () => (
  <div className="help-controls">
    <div className="help-row">
      <div className="help-joystick" aria-hidden="true">
        <span className="help-joystick-hint help-joystick-hint--top">▲</span>
        <span className="help-joystick-hint help-joystick-hint--bottom">▼</span>
        <span className="help-joystick-hint help-joystick-hint--left">↺</span>
        <span className="help-joystick-hint help-joystick-hint--right">↻</span>
        <span className="help-joystick-knob" />
      </div>
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
  </div>
);

// Full controls reference, reopenable via the persistent "?" button. Content
// branches on device so touch users never see a keyboard diagram, and desktop
// users never see a joystick.
const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => (
  <div className="welcome-backdrop" onClick={onClose}>
    <div
      className="welcome-alert help-modal"
      role="dialog"
      aria-label="Controls"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="welcome-alert-close"
        onClick={onClose}
        aria-label="Close"
      >
        &times;
      </button>
      <h2 className="welcome-alert-title">Controls</h2>
      {isMobile ? <MobileControls /> : <PcControls />}
    </div>
  </div>
);

export default HelpModal;
