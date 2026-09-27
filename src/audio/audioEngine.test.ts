import { describe, it, expect, beforeEach } from "vitest";
import { audioEngine } from "./audioEngine";

// audioEngine is a module-level singleton, and none of these calls touch
// a real AudioContext (init() is never called, so this.ctx stays null and
// every gain-ramp branch is skipped) - only the plain state/localStorage
// bookkeeping under test here.
describe("audioEngine mute snapshot/restore", () => {
  beforeEach(() => {
    if (audioEngine.isMuted()) audioEngine.toggleMute();
    if (!audioEngine.isMusicEnabled()) audioEngine.setMusicEnabled(true);
    if (!audioEngine.isSfxEnabled()) audioEngine.setSfxEnabled(true);
  });

  it("muting turns both channels off", () => {
    audioEngine.toggleMute();

    expect(audioEngine.isMuted()).toBe(true);
    expect(audioEngine.isMusicEnabled()).toBe(false);
    expect(audioEngine.isSfxEnabled()).toBe(false);
  });

  it("unmuting via toggleMute restores each channel's exact pre-mute state", () => {
    audioEngine.setSfxEnabled(false); // sfx off, music on, going into mute

    audioEngine.toggleMute(); // mute
    expect(audioEngine.isMusicEnabled()).toBe(false);
    expect(audioEngine.isSfxEnabled()).toBe(false);

    audioEngine.toggleMute(); // unmute
    expect(audioEngine.isMuted()).toBe(false);
    expect(audioEngine.isMusicEnabled()).toBe(true); // restored - was on
    expect(audioEngine.isSfxEnabled()).toBe(false); // restored - was off
  });

  it("a direct click on one channel while muted unmutes without restoring the other channel", () => {
    audioEngine.toggleMute(); // mute (both remembered as on, forced off)

    audioEngine.setMusicEnabled(true); // direct action on just this channel

    expect(audioEngine.isMuted()).toBe(false); // auto-unmuted
    expect(audioEngine.isMusicEnabled()).toBe(true);
    expect(audioEngine.isSfxEnabled()).toBe(false); // untouched, stays off
  });

  it("re-muting after a manual channel change snapshots the new state, not the old one", () => {
    audioEngine.toggleMute(); // mute -> both off, remembers (true, true)
    audioEngine.toggleMute(); // unmute -> restores (true, true)

    audioEngine.setSfxEnabled(false); // now: music on, sfx off
    audioEngine.toggleMute(); // mute again -> should remember (true, false) this time
    audioEngine.toggleMute(); // unmute

    expect(audioEngine.isMusicEnabled()).toBe(true);
    expect(audioEngine.isSfxEnabled()).toBe(false);
  });
});
