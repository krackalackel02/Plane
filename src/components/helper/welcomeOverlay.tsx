import { useEffect, useMemo, useState } from "react";
import { isMobile } from "react-device-detect";
import { INTRO_ANIMATION_DURATION_MS } from "../camera/animate";
import HelpModal from "./helpModal";
import "./welcomeOverlay.css";

// Give the camera a beat after the flythrough lands before popping the
// alert, so it doesn't appear mid-motion.
const SETTLE_DELAY_MS = 500;
// Average adult silent reading speed, used to size the auto-dismiss timer to
// the actual copy below instead of a guessed constant.
const WORDS_PER_MINUTE = 220;
// "expected time to read" + this grace period, per the design ask.
const READ_GRACE_MS = 5000;

const WELCOME_BODY = {
  pc: "You're piloting a ship through a living, explorable portfolio. Steer with WASD and the arrow keys, boost with Space, and fly into any glowing board to open a project.",
  mobile:
    "You're piloting a ship through a living, explorable portfolio. Drag the joystick to fly, swipe the ship to look around, and tap any glowing board to open a project.",
};

const estimateReadMs = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  return (words / WORDS_PER_MINUTE) * 60000;
};

// Shown once per visit: a welcome alert that appears after the intro camera
// flythrough settles, explains what the app is and the bare minimum to get
// moving, then hands off to a persistent "?" button that reopens the full
// controls reference (WelcomeOverlay owns both so they can share the
// introDismissed handoff without extra context plumbing).
const WelcomeOverlay = () => {
  const [showIntro, setShowIntro] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const body = isMobile ? WELCOME_BODY.mobile : WELCOME_BODY.pc;
  const autoDismissMs = useMemo(
    () => estimateReadMs(body) + READ_GRACE_MS,
    [body],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setShowIntro(true),
      INTRO_ANIMATION_DURATION_MS + SETTLE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const timer = setTimeout(dismissIntro, autoDismissMs);
    return () => clearTimeout(timer);
  }, [showIntro, autoDismissMs]);

  const dismissIntro = () => {
    setShowIntro(false);
    setIntroDismissed(true);
  };

  return (
    <>
      {showIntro && (
        <div className="welcome-backdrop" onClick={dismissIntro}>
          <div
            className="welcome-alert"
            role="dialog"
            aria-label="Welcome"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="welcome-alert-close"
              onClick={dismissIntro}
              aria-label="Dismiss"
            >
              &times;
            </button>
            <h2 className="welcome-alert-title">🚀 Welcome aboard</h2>
            <p className="welcome-alert-body">{body}</p>
            <p className="welcome-alert-hint">
              Tap the <strong>?</strong> button anytime for full controls.
            </p>
          </div>
        </div>
      )}

      {introDismissed && (
        <button
          className="help-button"
          onClick={() => setShowHelp(true)}
          aria-label="Show controls"
        >
          ?
        </button>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
};

export default WelcomeOverlay;
