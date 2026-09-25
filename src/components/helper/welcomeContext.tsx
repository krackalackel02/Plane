import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isMobile } from "react-device-detect";
import { INTRO_ANIMATION_DURATION_MS } from "../camera/animate";
import { GLITCH_EXIT_MS } from "./glitchTiming";

// Give the camera a beat after the flythrough lands before popping the
// alert, so it doesn't appear mid-motion.
const SETTLE_DELAY_MS = 500;
// Average adult silent reading speed, used to size the auto-dismiss timer to
// the actual copy below instead of a guessed constant.
const WORDS_PER_MINUTE = 220;
// "expected time to read" + this grace period, per the design ask.
const READ_GRACE_MS = 5000;

export const WELCOME_BODY = {
  pc: "You're piloting a ship through a living, explorable portfolio. Steer with WASD and the arrow keys, boost with Space, and fly into any glowing board to open a project.",
  mobile:
    "You're piloting a ship through a living, explorable portfolio. Drag the joystick to fly, swipe the ship to look around, and tap any glowing board to open a project.",
};

const estimateReadMs = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  return (words / WORDS_PER_MINUTE) * 60000;
};

interface WelcomeContextValue {
  body: string;
  showIntro: boolean;
  closingIntro: boolean;
  dismissIntro: () => void;
  introDismissed: boolean;
  showHelp: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const WelcomeContext = createContext<WelcomeContextValue | null>(null);

// Owns the welcome popup's whole lifecycle - intro timing/dismissal and the
// help-modal toggle - so the intro alert, the persistent "?" button (which
// lives inside the shared HudCorner, a DOM sibling of the alert rather than
// a descendant), and the reopenable controls modal can all stay in sync
// without prop drilling across that boundary.
export const WelcomeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [showIntro, setShowIntro] = useState(false);
  const [closingIntro, setClosingIntro] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const closingRef = useRef(false);

  const body = isMobile ? WELCOME_BODY.mobile : WELCOME_BODY.pc;

  useEffect(() => {
    const timer = setTimeout(
      () => setShowIntro(true),
      INTRO_ANIMATION_DURATION_MS + SETTLE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  // Plays the CSS "glitch-out" collapse before actually unmounting, rather
  // than snapping the alert away the instant it's dismissed.
  const dismissIntro = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosingIntro(true);
    setTimeout(() => {
      setShowIntro(false);
      setClosingIntro(false);
      setIntroDismissed(true);
      closingRef.current = false;
    }, GLITCH_EXIT_MS);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const timer = setTimeout(
      dismissIntro,
      estimateReadMs(body) + READ_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [showIntro, body, dismissIntro]);

  return (
    <WelcomeContext.Provider
      value={{
        body,
        showIntro,
        closingIntro,
        dismissIntro,
        introDismissed,
        showHelp,
        openHelp: () => setShowHelp(true),
        closeHelp: () => setShowHelp(false),
      }}
    >
      {children}
    </WelcomeContext.Provider>
  );
};

export const useWelcome = () => {
  const context = useContext(WelcomeContext);
  if (!context) {
    throw new Error("useWelcome must be used within a WelcomeProvider");
  }
  return context;
};
