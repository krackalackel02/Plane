import { Group, MathUtils } from "three";

export type TrickStatus = "playing" | "done";

// Plays a single full barrel roll (360 deg on the roll/z axis) over a fixed
// duration - a standalone class rather than a BaseMotion subclass, since
// it's a one-shot triggered animation rather than a continuous key-driven
// motion. Modeled after AutopilotMotion (attachTo/start/update/cleanup).
export class TrickMotion {
  private group: Group | undefined;
  private progress = 0;
  private duration: number;

  constructor(duration = 1.1) {
    this.duration = duration;
  }

  attachTo(group: Group) {
    this.group = group;
  }

  start() {
    this.progress = 0;
  }

  update(delta: number): TrickStatus {
    if (!this.group) return "done";

    this.progress = Math.min(this.progress + delta / this.duration, 1);
    // Ease in/out so the roll spins up and settles rather than snapping to
    // a constant angular speed.
    const eased = MathUtils.smootherstep(this.progress, 0, 1);
    this.group.rotation.z = eased * Math.PI * 2;

    if (this.progress >= 1) {
      // 2*PI and 0 are the same orientation, so this is a seamless reset,
      // not a visible jump - it hands the roll axis cleanly back to the
      // normal roll motion.
      this.group.rotation.z = 0;
      return "done";
    }
    return "playing";
  }

  cleanup() {
    this.group = undefined;
  }
}
