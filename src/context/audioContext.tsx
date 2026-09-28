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
  /** Independent on/off state for the ambient pad and the activation-zone
   *  bleep - each toggleable on its own, unlike `muted` (which silences
   *  everything at once). Turning either of these on also unmutes, so a
   *  channel you just switched on is actually audible. */
  musicEnabled: boolean;
  toggleMusic: () => void;
  sfxEnabled: boolean;
  toggleSfx: () => void;
}

const AudioUIContext = createContext<AudioUIContextType>({
  muted: false,
  toggleMute: () => {},
  musicEnabled: true,
  toggleMusic: () => {},
  sfxEnabled: true,
  toggleSfx: () => {},
});

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [muted, setMuted] = useState(() => audioEngine.isMuted());
  const [musicEnabled, setMusicEnabled] = useState(() =>
    audioEngine.isMusicEnabled(),
  );
  const [sfxEnabled, setSfxEnabled] = useState(() =>
    audioEngine.isSfxEnabled(),
  );
  // Whether the ambient pad's scheduling starts at all is a one-time,
  // env-driven decision (VITE_MUSIC_ENABLED) - distinct from the live,
  // player-toggleable `musicEnabled` above, which just gates its gain.
  const { musicEnabled: musicEnabledByEnv } = useEnvironment();

  useEffect(() => audioEngine.subscribe(setMuted), []);
  useEffect(() => audioEngine.subscribeMusic(setMusicEnabled), []);
  useEffect(() => audioEngine.subscribeSfx(setSfxEnabled), []);

  // Build the audio graph (+ schedule the ambient pad, unless
  // VITE_MUSIC_ENABLED=false) as soon as the app mounts - no gesture
  // needed for that part, so there's no lag waiting for the player to do
  // something first.
  useEffect(() => {
    audioEngine.init(musicEnabledByEnv);
  }, [musicEnabledByEnv]);

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
  const toggleMusic = useCallback(() => audioEngine.toggleMusic(), []);
  const toggleSfx = useCallback(() => audioEngine.toggleSfx(), []);

  return (
    <AudioUIContext.Provider
      value={{
        muted,
        toggleMute,
        musicEnabled,
        toggleMusic,
        sfxEnabled,
        toggleSfx,
      }}
    >
      {children}
    </AudioUIContext.Provider>
  );
};

export const useAudioContext = () => useContext(AudioUIContext);
