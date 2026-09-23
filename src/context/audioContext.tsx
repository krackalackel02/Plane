import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { audioEngine } from "../audio/audioEngine";
import { useEnvironment } from "./envContext";

interface AudioUIContextType {
  muted: boolean;
  toggleMute: () => void;
}

const AudioUIContext = createContext<AudioUIContextType>({
  muted: false,
  toggleMute: () => {},
});

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [muted, setMuted] = useState(() => audioEngine.isMuted());
  const { musicEnabled } = useEnvironment();

  useEffect(() => audioEngine.subscribe(setMuted), []);

  // Build the audio graph (+ schedule the ambient pad, unless
  // VITE_MUSIC_ENABLED=false) as soon as the app mounts - no gesture
  // needed for that part, so there's no lag waiting for the player to do
  // something first.
  useEffect(() => {
    audioEngine.init(musicEnabled);
  }, [musicEnabled]);

  // Browsers still refuse to make sound audible until a real user gesture
  // occurs, so this just unlocks the graph that's already built above.
  // Listens in the capture phase so it fires even if something inside the
  // 3D scene (camera controls, etc.) stops the event bubbling before it
  // would otherwise reach window - i.e. any click/key/touch anywhere
  // unlocks it, not only ones that happen to move the ship.
  useEffect(() => {
    const unlock = () => {
      audioEngine.resume();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("touchstart", unlock, true);

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
    };
  }, []);

  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);

  return (
    <AudioUIContext.Provider value={{ muted, toggleMute }}>
      {children}
    </AudioUIContext.Provider>
  );
};

export const useAudioContext = () => useContext(AudioUIContext);
