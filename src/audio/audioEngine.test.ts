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

describe("audioEngine auto-mute on last channel off", () => {
  beforeEach(() => {
    if (audioEngine.isMuted()) audioEngine.toggleMute();
    if (!audioEngine.isMusicEnabled()) audioEngine.setMusicEnabled(true);
    if (!audioEngine.isSfxEnabled()) audioEngine.setSfxEnabled(true);
  });

  it("turning off a channel while the other is still on does not engage mute", () => {
    audioEngine.setMusicEnabled(false);

    expect(audioEngine.isMuted()).toBe(false);
    expect(audioEngine.isMusicEnabled()).toBe(false);
    expect(audioEngine.isSfxEnabled()).toBe(true);
  });

  it("switching off the last active channel (sfx) engages mute, and unmuting restores sfx", () => {
    audioEngine.setMusicEnabled(false); // music off, sfx still on - no auto-mute yet
    expect(audioEngine.isMuted()).toBe(false);

    audioEngine.setSfxEnabled(false); // sfx was the last one on
    expect(audioEngine.isMuted()).toBe(true);
    expect(audioEngine.isMusicEnabled()).toBe(false);
    expect(audioEngine.isSfxEnabled()).toBe(false);

    audioEngine.toggleMute(); // unmute
    expect(audioEngine.isMuted()).toBe(false);
    expect(audioEngine.isMusicEnabled()).toBe(false); // stays off - wasn't the last one on
    expect(audioEngine.isSfxEnabled()).toBe(true); // restored - was the last one on
  });

  it("switching off the last active channel (music) engages mute, and unmuting restores music", () => {
    audioEngine.setSfxEnabled(false); // sfx off, music still on - no auto-mute yet
    expect(audioEngine.isMuted()).toBe(false);

    audioEngine.setMusicEnabled(false); // music was the last one on
    expect(audioEngine.isMuted()).toBe(true);

    audioEngine.toggleMute(); // unmute
    expect(audioEngine.isMuted()).toBe(false);
    expect(audioEngine.isMusicEnabled()).toBe(true); // restored - was the last one on
    expect(audioEngine.isSfxEnabled()).toBe(false); // stays off - wasn't the last one on
  });

  it("toggling off the last active channel through toggleMusic/toggleSfx (the UI path) also engages mute", () => {
    audioEngine.toggleSfx(); // sfx off, music still on
    audioEngine.toggleMusic(); // music was the last one on

    expect(audioEngine.isMuted()).toBe(true);

    audioEngine.toggleMute(); // unmute
    expect(audioEngine.isMusicEnabled()).toBe(true); // restored
    expect(audioEngine.isSfxEnabled()).toBe(false);
  });

  it("switching off a channel while already muted does not disturb the existing snapshot", () => {
    audioEngine.toggleMute(); // mute -> remembers (true, true), forces both off

    audioEngine.setMusicEnabled(false); // redundant: already off, still muted

    audioEngine.toggleMute(); // unmute
    expect(audioEngine.isMusicEnabled()).toBe(true);
    expect(audioEngine.isSfxEnabled()).toBe(true);
  });
});
