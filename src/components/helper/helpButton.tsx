import { useWelcome } from "./welcomeContext";

// Lives inside HudCorner (as a sibling of MuteButton) rather than nested
// under WelcomeOverlay, so both icon buttons can share one HUD group
// container - state is coordinated via WelcomeContext instead.
const HelpButton = () => {
  const { introDismissed, openHelp } = useWelcome();

  if (!introDismissed) return null;

  return (
    <button
      className="hud-icon-button hud-icon-button--accent"
      onClick={openHelp}
      aria-label="Show controls"
    >
      ?
    </button>
  );
};

export default HelpButton;
