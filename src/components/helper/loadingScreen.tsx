import { useProgress } from "@react-three/drei";
import "./loadingScreen.css";

// Full-screen cover shown until the 3D scene (ship model + board textures)
// has actually loaded, so it fades out together with the rest of the UI
// instead of the DOM chrome (minimap/joystick) popping in while the canvas
// is still blank.
const LoadingScreen = ({ hidden }: { hidden: boolean }) => {
  const { progress } = useProgress();

  return (
    <div
      id="loading-screen"
      className={hidden ? "loading-screen--hidden" : ""}
      aria-hidden="true"
    >
      <div className="loading-screen__label">Boarding</div>
      <div className="loading-screen__bar">
        <div
          className="loading-screen__bar-fill"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
