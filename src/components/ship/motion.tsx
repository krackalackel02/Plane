import { Group } from "three";
import { Spring } from "wobble";

type Axis = "x" | "y" | "z";

interface MotionConfig {
  axis: Axis;
  stiffness: number;
  damping: number;
  maxAngle: number;
  positiveKey: string;
  negativeKey: string;
}

export class Motion {
  private spring: Spring;
  private axis: Axis;
  private maxAngle: number;
  private positiveKey: string;
  private negativeKey: string;

  constructor({
    axis,
    stiffness,
    damping,
    maxAngle,
    positiveKey,
    negativeKey,
  }: MotionConfig) {
    this.axis = axis;
    this.maxAngle = maxAngle;
    this.positiveKey = positiveKey;
    this.negativeKey = negativeKey;

    // Initialize spring
    this.spring = new Spring({
      fromValue: 0,
      toValue: 0,
      stiffness,
      damping,
    });
  }

  attachTo(group: Group) {
    this.spring.onUpdate((state) => {
      group.rotation[this.axis] = state.currentValue;
    });
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === this.positiveKey) {
      this.spring.updateConfig({ toValue: this.maxAngle });
      this.spring.start();
    }
    if (e.key === this.negativeKey) {
      this.spring.updateConfig({ toValue: -this.maxAngle });
      this.spring.start();
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    if (e.key === this.positiveKey || e.key === this.negativeKey) {
      this.spring.updateConfig({ toValue: 0 });
      this.spring.start();
    }
  }

  cleanup() {
    this.spring.removeAllListeners();
  }
}
