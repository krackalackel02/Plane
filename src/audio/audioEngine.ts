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

interface EngineNodes {
  noiseSource: AudioBufferSourceNode;
  toneOsc: OscillatorNode;
  wobbleLfo: OscillatorNode;
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

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
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
    music.gain.value = 0.04; // always-on background, kept deliberately quiet
    music.connect(master);
    this.musicGain = music;

    const engine = ctx.createGain();
    engine.gain.value = 0;
    engine.connect(master);
    this.engineGain = engine;

    const sfx = ctx.createGain();
    sfx.gain.value = 0.5;
    sfx.connect(master);
    this.sfxGain = sfx;

    return ctx;
  }

  /**
   * Must be called from inside a real user-gesture event handler
   * (click/keydown/touchstart) - browsers refuse to run audio otherwise.
   * Resumes the context and, unless disabled via VITE_MUSIC_ENABLED, kicks
   * off the ambient pad exactly once.
   */
  init(musicEnabled = true) {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.musicStarted && musicEnabled) {
      this.musicStarted = true;
      this.startMusic();
    }
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

  toggleMute() {
    this.setMuted(!this.muted);
  }

  subscribe(listener: (muted: boolean) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
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
      active ? 0.22 : 0,
      now,
      active ? 0.35 : 0.6,
    );

    this.engine.toneOsc.frequency.cancelScheduledValues(now);
    this.engine.toneOsc.frequency.setTargetAtTime(active ? 95 : 70, now, 0.5);
  }

  private buildEngine(ctx: AudioContext) {
    if (!this.engineGain) return;

    // Filtered noise gives the airy "whirr" body of a space engine.
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer(ctx);
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.6;

    noiseSource
      .connect(noiseFilter)
      .connect(noiseGain)
      .connect(this.engineGain);

    // Low sawtooth carries the engine's tonal body.
    const toneOsc = ctx.createOscillator();
    toneOsc.type = "sawtooth";
    toneOsc.frequency.value = 70;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 260;

    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.5;

    toneOsc.connect(toneFilter).connect(toneGain).connect(this.engineGain);

    // Slow LFO wobbling the tone pitch for a throbbing "space engine" feel.
    const wobbleLfo = ctx.createOscillator();
    wobbleLfo.frequency.value = 5.5;
    const wobbleLfoGain = ctx.createGain();
    wobbleLfoGain.gain.value = 6;
    wobbleLfo.connect(wobbleLfoGain).connect(toneOsc.frequency);

    noiseSource.start();
    toneOsc.start();
    wobbleLfo.start();

    this.engine = { noiseSource, toneOsc, wobbleLfo };
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
