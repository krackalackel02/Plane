import { useEffect, useMemo, useRef, useState } from "react";
import { isMobile } from "react-device-detect";
import { INTRO_ANIMATION_DURATION_MS } from "../camera/animate";
import HelpModal from "./helpModal";
import GlitchText from "./glitchText";
import { Keycap, JoystickIcon } from "./controlIcons";
import { GLITCH_EXIT_MS } from "./glitchTiming";
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
  const [closingIntro, setClosingIntro] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const closingRef = useRef(false);

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

  // Plays the CSS "glitch-out" collapse before actually unmounting, rather
  // than snapping the alert away the instant it's dismissed.
  const dismissIntro = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosingIntro(true);
    setTimeout(() => {
      setShowIntro(false);
      setClosingIntro(false);
      setIntroDismissed(true);
      closingRef.current = false;
    }, GLITCH_EXIT_MS);
  };

  return (
    <>
      {showIntro && (
        <div className="welcome-backdrop" onClick={dismissIntro}>
          <div
            className={`welcome-alert${closingIntro ? " welcome-alert--closing" : ""}`}
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
            <h2 className="welcome-alert-title">
              🚀 <GlitchText as="span" text="Welcome aboard" charDelayMs={28} />
            </h2>
            <GlitchText
              as="p"
              className="welcome-alert-body"
              text={body}
              charDelayMs={9}
            />
            <div className="welcome-icons">
              {isMobile ? (
                <JoystickIcon compact />
              ) : (
                <>
                  <div className="welcome-icons-cluster">
                    <div className="keycap-row">
                      <Keycap label="W" compact />
                    </div>
                    <div className="keycap-row">
                      <Keycap label="A" compact />
                      <Keycap label="S" compact />
                      <Keycap label="D" compact />
                    </div>
                  </div>
                  <Keycap label="Space" wide compact />
                </>
              )}
            </div>
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
