import { isMobile } from "react-device-detect";
import HelpModal from "./helpModal";
import GlitchText from "./glitchText";
import { Keycap, JoystickIcon } from "./controlIcons";
import { useWelcome } from "./welcomeContext";
import "./welcomeOverlay.css";

// Shown once per visit: a welcome alert that appears after the intro camera
// flythrough settles, explains what the app is and the bare minimum to get
// moving, then hands off to the persistent "?" button (rendered separately,
// see HelpButton/HudCorner) to reopen the full controls reference. State
// lives in WelcomeContext, shared with HelpButton.
const WelcomeOverlay = () => {
  const { body, showIntro, closingIntro, dismissIntro, showHelp, closeHelp } =
    useWelcome();

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
              🚀{" "}
              <GlitchText
                as="span"
                text="Welcome aboard"
                charDelayMs={28}
                startDelayMs={250}
              />
            </h2>
            <GlitchText
              as="p"
              className="welcome-alert-body"
              text={body}
              charDelayMs={9}
              startDelayMs={380}
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

      {showHelp && <HelpModal onClose={closeHelp} />}
    </>
  );
};

export default WelcomeOverlay;
