import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { audioEngine } from "../audio/audioEngine";

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

  useEffect(() => audioEngine.subscribe(setMuted), []);

  // Browsers refuse to play audio until a real user gesture has occurred.
  // Listen for the first one, start the audio graph + ambient pad, then
  // stop listening.
  useEffect(() => {
    const start = () => {
      audioEngine.init();
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
  }, []);

  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);

  return (
    <AudioUIContext.Provider value={{ muted, toggleMute }}>
      {children}
    </AudioUIContext.Provider>
  );
};

export const useAudioContext = () => useContext(AudioUIContext);
