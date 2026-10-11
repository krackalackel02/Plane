import * as THREE from "three";

const WIDTH = 512;
const HEIGHT = 256;

const seededRandom = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Procedural cratered moon texture: a mid-grey base with a scatter of
 * craters, each a dark bowl with a lighter rim highlight on its upper-left
 * (matching the scene's own key light direction) and a small shadow
 * crescent on the lower-right, so they read as actual sunken craters
 * rather than flat grey dots even at the moon's small on-screen size.
 */
export const createMoonTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, "#c4c4cc");
  base.addColorStop(0.5, "#aaaab4");
  base.addColorStop(1, "#8e8e98");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const craterCount = 55;
  for (let i = 0; i < craterCount; i++) {
    const cx = seededRandom(i * 3 + 1) * WIDTH;
    const cy = seededRandom(i * 3 + 2) * HEIGHT;
    const r = 6 + seededRandom(i * 3 + 3) * 22;

    const bowl = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bowl.addColorStop(0, "rgba(60, 60, 66, 0.55)");
    bowl.addColorStop(0.7, "rgba(90, 90, 98, 0.35)");
    bowl.addColorStop(1, "rgba(90, 90, 98, 0)");
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlight, offset toward the upper-left (the key light's side).
    ctx.strokeStyle = "rgba(220, 220, 228, 0.4)";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.arc(
      cx - r * 0.15,
      cy - r * 0.15,
      r * 0.92,
      Math.PI * 0.9,
      Math.PI * 1.8,
    );
    ctx.stroke();

    // Shadow crescent on the opposite (lower-right) side.
    ctx.strokeStyle = "rgba(40, 40, 46, 0.35)";
    ctx.beginPath();
    ctx.arc(
      cx + r * 0.1,
      cy + r * 0.1,
      r * 0.95,
      -Math.PI * 0.1,
      Math.PI * 0.8,
    );
    ctx.stroke();
  }

  // A light dusting of tiny pockmarks for texture at a glance, not just
  // the larger named craters above.
  for (let i = 0; i < 160; i++) {
    const cx = seededRandom(i * 5 + 500) * WIDTH;
    const cy = seededRandom(i * 5 + 501) * HEIGHT;
    const r = 0.6 + seededRandom(i * 5 + 502) * 1.8;
    ctx.fillStyle = `rgba(70, 70, 78, ${0.25 + seededRandom(i * 5 + 503) * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
