import * as THREE from "three";

const WIDTH = 1024;
const HEIGHT = 512;

/**
 * Procedural equirectangular texture for the planet: a subtle lat/long
 * grid plus a bright equatorial band - the ship's cruise line and the ring
 * every board sits on - so the surface itself hints at "the loop around
 * this planet is where everything happens", even before the 3D ring (see
 * index.tsx) makes it explicit.
 */
export const createPlanetTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Base surface - a deep, slightly desaturated blue-violet, closer to a
  // stylised night-side world than realistic terrain.
  const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, "#141a33");
  base.addColorStop(0.5, "#1c2b4d");
  base.addColorStop(1, "#141a33");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Longitude lines (meridians) every 15deg.
  ctx.strokeStyle = "rgba(150, 190, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let lon = 0; lon <= WIDTH; lon += WIDTH / 24) {
    ctx.beginPath();
    ctx.moveTo(lon, 0);
    ctx.lineTo(lon, HEIGHT);
    ctx.stroke();
  }

  // Latitude lines every 15deg.
  for (let lat = 0; lat <= HEIGHT; lat += HEIGHT / 12) {
    ctx.beginPath();
    ctx.moveTo(0, lat);
    ctx.lineTo(WIDTH, lat);
    ctx.stroke();
  }

  // Equatorial band - the ship's cruise line - drawn as a glowing stripe.
  const bandHeight = HEIGHT * 0.035;
  const equatorGlow = ctx.createLinearGradient(
    0,
    HEIGHT / 2 - bandHeight,
    0,
    HEIGHT / 2 + bandHeight,
  );
  equatorGlow.addColorStop(0, "rgba(125, 211, 252, 0)");
  equatorGlow.addColorStop(0.5, "rgba(125, 211, 252, 0.55)");
  equatorGlow.addColorStop(1, "rgba(125, 211, 252, 0)");
  ctx.fillStyle = equatorGlow;
  ctx.fillRect(0, HEIGHT / 2 - bandHeight, WIDTH, bandHeight * 2);

  ctx.strokeStyle = "rgba(224, 247, 255, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT / 2);
  ctx.lineTo(WIDTH, HEIGHT / 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
