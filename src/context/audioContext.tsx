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

  // Browsers refuse to play audio until a real user gesture has occurred.
  // Listen for the first one, start the audio graph (+ ambient pad, unless
  // VITE_MUSIC_ENABLED=false), then stop listening.
  useEffect(() => {
    const start = () => {
      audioEngine.init(musicEnabled);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("touchstart", start);
    };

    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    window.addEventListener("touchstart", start);

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("touchstart", start);
    };
  }, [musicEnabled]);

  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);

  return (
    <AudioUIContext.Provider value={{ muted, toggleMute }}>
      {children}
    </AudioUIContext.Provider>
  );
};

export const useAudioContext = () => useContext(AudioUIContext);
