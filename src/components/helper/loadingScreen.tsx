import { useState, useEffect } from "react";
import { useLoading } from "../../context/loadingContext";
import "./loadingScreen.css";

// Matches the CSS fade-out transition duration, so the overlay isn't
// unmounted mid-animation. Kept short and deliberately - once `ready`
// fires, the bar has already reached exactly 100% (see loadingContext.tsx),
// so this should read as an immediate hand-off, not a lingering fade.
const FADE_OUT_MS = 250;

/**
 * Full-screen cartoonish, space-themed splash shown while models/textures
 * load, so the intro camera flythrough never starts over a half-empty scene.
 * @returns JSX.Element | null
 */
const LoadingScreen = () => {
  const { ready, progress } = useLoading();
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!mounted) return null;

  const percent = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      id="loading-screen"
      className={
        ready ? "loading-screen loading-screen--hidden" : "loading-screen"
      }
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="loading-screen__stars" />
      <div className="loading-screen__stars loading-screen__stars--far" />

      <div className="loading-screen__stage">
        <div className="loading-screen__planet">
          <div className="loading-screen__ring" />
        </div>
        <div className="loading-screen__orbit">
          <svg
            className="loading-screen__ship"
            viewBox="0 0 64 64"
            width="34"
            height="34"
            aria-hidden="true"
          >
            <polygon
              className="loading-screen__ship-flame"
              points="26,46 32,60 38,46"
            />
            <path
              className="loading-screen__ship-fin"
              d="M22 34 L10 44 L24 42 Z"
            />
            <path
              className="loading-screen__ship-fin"
              d="M42 34 L54 44 L40 42 Z"
            />
            <path
              className="loading-screen__ship-body"
              d="M32 4 C42 14 44 28 40 44 L24 44 C20 28 22 14 32 4 Z"
            />
            <circle
              className="loading-screen__ship-window"
              cx="32"
              cy="22"
              r="6"
            />
          </svg>
        </div>
      </div>

      <div className="loading-screen__title">Entering Orbit</div>
      <div className="loading-screen__subtitle">
        Charting a course through the portfolio&hellip;
      </div>

      {/* transform (not width) so this keeps animating smoothly via the
          compositor even while the main thread is busy elsewhere (CSG
          boolean ops building the board frames, GLTF/image decode, etc.) -
          see loadingScreen.css for the transition. */}
      <div className="loading-screen__bar">
        <div
          className="loading-screen__bar-fill"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <div className="loading-screen__percent">{percent}%</div>
    </div>
  );
};

export default LoadingScreen;
