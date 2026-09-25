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
  // would otherwise reach window - i.e. any click/key/touch/scroll
  // anywhere unlocks it, not only ones that happen to move the ship.
  //
  // Only events browsers actually treat as an "activation-triggering
  // gesture" reliably unlock a suspended AudioContext - notably that's
  // touchend/pointerup, NOT touchstart/pointerdown (the down/start edge of
  // a touch is indistinguishable from the start of a scroll, so browsers
  // don't count it). Camera-drag and zoom interactions in the scene start
  // with a touchstart/pointerdown, so listening on those edges was
  // effectively never unlocking audio on touch devices. Wheel isn't a
  // qualifying gesture in any browser today, but is included as a
  // harmless best effort in case that ever changes.
  //
  // Previously this detached every listener after the very first event,
  // even if that event didn't actually unlock the context - so a single
  // non-qualifying event (e.g. a touchstart) would permanently give up.
  // Instead, keep listening until `resume()` has actually taken effect.
  useEffect(() => {
    const detach = () => {
      window.removeEventListener("pointerup", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchend", unlock, true);
      window.removeEventListener("wheel", unlock, true);
    };

    const unlock = () => {
      const resumed = audioEngine.resume();
      if (audioEngine.isRunning()) {
        detach();
      } else if (resumed) {
        resumed.then(() => {
          if (audioEngine.isRunning()) detach();
        });
      }
    };

    window.addEventListener("pointerup", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("touchend", unlock, true);
    window.addEventListener("wheel", unlock, { capture: true, passive: true });

    return detach;
  }, []);

  const toggleMute = useCallback(() => audioEngine.toggleMute(), []);

  return (
    <AudioUIContext.Provider value={{ muted, toggleMute }}>
      {children}
    </AudioUIContext.Provider>
  );
};

export const useAudioContext = () => useContext(AudioUIContext);
