/**
 * Procedural sound system for the scene, built directly on the Web Audio
 * API. There are no bundled audio assets - every sound (engine hum,
 * activation-zone bleep, ambient pad, starry twinkles) is synthesized at
 * runtime, so nothing needs to be fetched/licensed and the bundle stays
 * tiny.
 *
 * This is a module-level singleton rather than React state, because audio
 * parameters (gain ramps, oscillator frequency) are cheap to mutate
 * directly on Web Audio nodes and don't benefit from - or play well with -
 * React's render cycle. The `AudioProvider` React context only mirrors the
 * mute flag for UI purposes.
 */

const MUTE_STORAGE_KEY = "plane:audio-muted";
const MUSIC_ENABLED_STORAGE_KEY = "plane:music-enabled";
const SFX_ENABLED_STORAGE_KEY = "plane:sfx-enabled";
const MUSIC_GAIN = 0.06; // matches the always-on background level below
const SFX_GAIN = 0.5;

interface EngineNodes {
  noiseSource: AudioBufferSourceNode;
  thrumOsc: OscillatorNode;
  whineOsc: OscillatorNode;
  idleLfo: OscillatorNode;
  flangeLfo: OscillatorNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private engine: EngineNodes | null = null;
  private engineActive = false;

  private musicStarted = false;
  private musicBus: GainNode | null = null;

  private muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  // Independent on/off toggles for the two channels a listener can tell
  // apart - the ambient pad (musicGain, "background music") and the
  // activation-zone bleep (sfxGain, "sound effects"). Both default on,
  // matching the levels those gain nodes have always carried.
  private musicEnabled = true;
  private sfxEnabled = true;
  private musicListeners = new Set<(enabled: boolean) => void>();
  private sfxListeners = new Set<(enabled: boolean) => void>();

  // Snapshot of musicEnabled/sfxEnabled taken at the moment mute is
  // switched on via toggleMute (see below), so switching it back off
  // through that same control restores exactly what was playing before -
  // rather than mute just silencing everything via masterGain while
  // leaving both channels looking "on".
  private preMuteMusicEnabled = true;
  private preMuteSfxEnabled = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
      this.musicEnabled =
        window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== "0";
      this.sfxEnabled =
        window.localStorage.getItem(SFX_ENABLED_STORAGE_KEY) !== "0";
    }
  }

  /** Lazily builds the audio graph. Safe to call many times. */
  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;

    const AudioContextCtor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioContextCtor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    this.masterGain = master;

    const music = ctx.createGain();
    music.gain.value = this.musicEnabled ? MUSIC_GAIN : 0; // deliberately quiet even at full "on"
    music.connect(master);
    this.musicGain = music;

    const engine = ctx.createGain();
    engine.gain.value = 0;
    engine.connect(master);
    this.engineGain = engine;

    const sfx = ctx.createGain();
    sfx.gain.value = this.sfxEnabled ? SFX_GAIN : 0;
    sfx.connect(master);
    this.sfxGain = sfx;

    return ctx;
  }

  /**
   * Builds the audio graph and, unless disabled via VITE_MUSIC_ENABLED,
   * schedules the ambient pad immediately - safe to call as soon as the
   * app mounts, with no user gesture required. Building/scheduling nodes
   * doesn't need a gesture, only actually hearing them does (browsers
   * create a fresh AudioContext in a "suspended" state until one occurs),
   * so this makes sure the pad is already running and ready the instant
   * `resume()` is allowed to unlock it, rather than only starting to spin
   * up after that first interaction.
   */
  init(musicEnabled = true) {
    const ctx = this.ensureContext();
    this.resume();
    if (!this.musicStarted && musicEnabled) {
      this.musicStarted = true;
      this.startMusic();
    }
    return ctx;
  }

  /**
   * Attempts to unlock playback. Call this from a real user-gesture event
   * handler (click/keydown/touchend) - browsers ignore the attempt
   * otherwise, so it's harmless to call speculatively (e.g. from `init`)
   * before one has happened. Returns the underlying resume promise so
   * callers can tell whether this particular attempt actually unlocked
   * playback (a gesture type the browser doesn't recognize, e.g. a
   * touchstart or a wheel tick, will resolve without moving the context
   * out of "suspended").
   */
  resume(): Promise<void> | undefined {
    if (this.ctx && this.ctx.state === "suspended") {
      return this.ctx.resume().catch(() => {});
    }
    return undefined;
  }

  isRunning() {
    return this.ctx?.state === "running";
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.15);
    }
    this.listeners.forEach((listener) => listener(this.muted));
  }

  /** Muting also visually/audibly turns off background music and sound
   *  effects (rather than just silencing everything via masterGain while
   *  their toggles keep showing "on"), but remembers what they were so
   *  switching mute back off through this same control brings them right
   *  back - a direct click on the music/sfx toggles themselves is a
   *  separate, more surgical action (see setMusicEnabled/setSfxEnabled)
   *  that doesn't touch this snapshot. */
  toggleMute() {
    if (!this.muted) {
      this.preMuteMusicEnabled = this.musicEnabled;
      this.preMuteSfxEnabled = this.sfxEnabled;
      this.setMuted(true);
      this.applyMusicEnabled(false);
      this.applySfxEnabled(false);
    } else {
      this.setMuted(false);
      this.applyMusicEnabled(this.preMuteMusicEnabled);
      this.applySfxEnabled(this.preMuteSfxEnabled);
    }
  }

  subscribe(listener: (muted: boolean) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isMusicEnabled() {
    return this.musicEnabled;
  }

  isSfxEnabled() {
    return this.sfxEnabled;
  }

  /** The actual gain ramp/persist/notify for music - shared by the public
   *  setter below and by toggleMute's snapshot/restore, which needs to
   *  drive this directly without re-triggering the "turning on unmutes"
   *  rule (that rule is for a direct click on this channel's own toggle,
   *  not for mute's own restore step). */
  private applyMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    window.localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, enabled ? "1" : "0");

    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.linearRampToValueAtTime(
        enabled ? MUSIC_GAIN : 0,
        now + 0.15,
      );
    }
    this.musicListeners.forEach((listener) => listener(this.musicEnabled));
  }

  /** Turning a sound channel on always implies audio overall should be
   *  audible - otherwise flipping it "on" would silently do nothing while
   *  still muted, which reads as broken rather than as two independent
   *  controls. Turning a channel off does NOT touch mute - it only
   *  silences that one channel, same as it always could via mute alone. */
  setMusicEnabled(enabled: boolean) {
    if (enabled && this.muted) this.setMuted(false);
    this.applyMusicEnabled(enabled);
  }

  toggleMusic() {
    this.setMusicEnabled(!this.musicEnabled);
  }

  subscribeMusic(listener: (enabled: boolean) => void) {
    this.musicListeners.add(listener);
    return () => {
      this.musicListeners.delete(listener);
    };
  }

  /** See applyMusicEnabled - same reasoning, sfx's counterpart. */
  private applySfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    window.localStorage.setItem(SFX_ENABLED_STORAGE_KEY, enabled ? "1" : "0");

    if (this.ctx && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.linearRampToValueAtTime(
        enabled ? SFX_GAIN : 0,
        now + 0.15,
      );
    }
    this.sfxListeners.forEach((listener) => listener(this.sfxEnabled));
  }

  setSfxEnabled(enabled: boolean) {
    if (enabled && this.muted) this.setMuted(false);
    this.applySfxEnabled(enabled);
  }

  toggleSfx() {
    this.setSfxEnabled(!this.sfxEnabled);
  }

  subscribeSfx(listener: (enabled: boolean) => void) {
    this.sfxListeners.add(listener);
    return () => {
      this.sfxListeners.delete(listener);
    };
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Turns the ship engine "wirr" on/off with a smooth spool up/down. */
  setEngineActive(active: boolean) {
    if (active === this.engineActive) return;
    this.engineActive = active;

    const ctx = this.ensureContext();
    if (!this.engine) this.buildEngine(ctx);
    if (!this.engineGain || !this.engine) return;

    const now = ctx.currentTime;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setTargetAtTime(
      active ? 0.1 : 0,
      now,
      active ? 0.4 : 0.6,
    );

    // Both tonal layers climb together on spool-up, like an X-wing engine
    // winding from idle to full power.
    this.engine.thrumOsc.frequency.cancelScheduledValues(now);
    this.engine.thrumOsc.frequency.setTargetAtTime(active ? 72 : 52, now, 0.55);
    this.engine.whineOsc.frequency.cancelScheduledValues(now);
    this.engine.whineOsc.frequency.setTargetAtTime(
      active ? 640 : 300,
      now,
      0.5,
    );
  }

  private buildEngine(ctx: AudioContext) {
    if (!this.engineGain) return;
    const engineGain = this.engineGain;

    // Filtered noise - the blowing "wind" body of the engine.
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer(ctx);
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.55;

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(engineGain);

    // Tonal voice: a low mechanical thrum plus a thin metallic whine,
    // mixed together and pushed through a slow modulated delay ("flange")
    // for a swirling, hollow, Doppler-like quality - the sense of a big
    // engine displacing air, X-wing/TIE-fighter style.
    const toneBus = ctx.createGain();
    toneBus.gain.value = 0.85;

    const thrumOsc = ctx.createOscillator();
    thrumOsc.type = "sawtooth";
    thrumOsc.frequency.value = 55;
    const thrumFilter = ctx.createBiquadFilter();
    thrumFilter.type = "lowpass";
    thrumFilter.frequency.value = 180;
    const thrumGain = ctx.createGain();
    thrumGain.gain.value = 0.4;
    thrumOsc.connect(thrumFilter).connect(thrumGain).connect(toneBus);

    const whineOsc = ctx.createOscillator();
    whineOsc.type = "sawtooth";
    whineOsc.frequency.value = 320;
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = "bandpass";
    whineFilter.frequency.value = 500;
    whineFilter.Q.value = 4;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.16;
    whineOsc.connect(whineFilter).connect(whineGain).connect(toneBus);

    // Slow breathing so the idle feels alive rather than static - much
    // slower and shallower than the old pitch wobble, so it reads as a
    // throb rather than a spring.
    const idleLfo = ctx.createOscillator();
    idleLfo.frequency.value = 0.6;
    const idleLfoGain = ctx.createGain();
    idleLfoGain.gain.value = 0.12;
    idleLfo.connect(idleLfoGain).connect(toneBus.gain);

    const flangeDelay = ctx.createDelay(0.02);
    flangeDelay.delayTime.value = 0.006;
    const flangeLfo = ctx.createOscillator();
    flangeLfo.frequency.value = 0.15;
    const flangeLfoGain = ctx.createGain();
    flangeLfoGain.gain.value = 0.004;
    flangeLfo.connect(flangeLfoGain).connect(flangeDelay.delayTime);
    const flangeWet = ctx.createGain();
    flangeWet.gain.value = 0.35;

    toneBus.connect(engineGain);
    toneBus.connect(flangeDelay).connect(flangeWet).connect(engineGain);

    noiseSource.start();
    thrumOsc.start();
    whineOsc.start();
    idleLfo.start();
    flangeLfo.start();

    this.engine = { noiseSource, thrumOsc, whineOsc, idleLfo, flangeLfo };
  }

  /** Short two-note rising chime for a successful activation-zone entry. */
  playBleep() {
    const ctx = this.ensureContext();
    if (!this.sfxGain) return;
    const sfxGain = this.sfxGain;
    const now = ctx.currentTime;

    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain).connect(sfxGain);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  /**
   * Low, always-on ambient bed: an evolving pad, a faint continuous
   * high-register shimmer, and sparse "bleep"/"bloop" starry sparkles -
   * all sharing one spacious reverb-like send so they feel like one place
   * rather than separate sounds.
   */
  private startMusic() {
    const ctx = this.ensureContext();
    if (!this.musicGain) return;
    const musicGain = this.musicGain;

    // Every voice (pad, shimmer, sparkles) feeds this bus, which splits
    // into a filtered dry path and a wide feedback-delay "space" path.
    const bus = ctx.createGain();
    bus.gain.value = 1;
    this.musicBus = bus;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    bus.connect(filter).connect(musicGain);

    const delay = ctx.createDelay(2.5);
    delay.delayTime.value = 0.55;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.5;
    delay.connect(feedback).connect(delay);
    bus.connect(delay);
    delay.connect(delayWet).connect(musicGain);

    // Slow, evolving Cmaj9-ish pad - plain sine voices (no triangle) and a
    // gentle swell keep this a soft bed rather than a buzzy drone.
    const chord = [130.81, 164.81, 196.0, 246.94, 293.66]; // C3 E3 G3 B3 D4
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.015;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain).connect(gain.gain);

      osc.connect(gain).connect(bus);
      osc.start();
      lfo.start();

      const now = ctx.currentTime;
      const restingGain = i === 4 ? 0.012 : 0.024;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(restingGain, now + 4 + i);
    });

    // Faint, ever-present high shimmer - the "starry" wash that sits under
    // the occasional bleep/bloop sparkles.
    [783.99, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = 0.008;

      const tremolo = ctx.createOscillator();
      tremolo.frequency.value = 0.06 + i * 0.02;
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 0.006;
      tremolo.connect(tremoloGain).connect(gain.gain);

      osc.connect(gain).connect(bus);
      osc.start();
      tremolo.start();
    });

    this.scheduleTwinkle();
  }

  private scheduleTwinkle() {
    const fire = () => {
      this.playTwinkle();
      window.setTimeout(fire, 500 + Math.random() * 900);
    };
    window.setTimeout(fire, 400);
  }

  /** One "bleep" (bright, rising) or "bloop" (soft, falling) star sparkle. */
  private playTwinkle() {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const bus = this.musicBus;
    const now = ctx.currentTime;

    const isBleep = Math.random() > 0.45;
    // Major-pentatonic-ish tones that sit comfortably over the Cmaj9 pad.
    const highScale = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5];
    const lowScale = highScale.map((f) => f / 2);
    const freq = (isBleep ? highScale : lowScale)[
      Math.floor(Math.random() * highScale.length)
    ];
    const duration = isBleep ? 1.1 : 2.0;

    const gain = ctx.createGain();
    const peak = isBleep ? 0.05 : 0.045;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + (isBleep ? 0.012 : 0.03));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Fundamental, with a gentle pitch drift for "bleep" (rises) vs
    // "bloop" (sinks), like a soft magic droplet.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      isBleep ? freq * 1.08 : freq * 0.82,
      now + duration,
    );

    // A quiet bell-like overtone gives the sparkle some shimmer instead of
    // a flat sine beep.
    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.value = freq * (isBleep ? 2 : 1.5);
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.35;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;

    osc.connect(gain);
    overtone.connect(overtoneGain).connect(gain);
    gain.connect(panner).connect(bus);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + duration + 0.1);
    overtone.stop(now + duration + 0.1);
  }
}

export const audioEngine = new AudioEngine();
