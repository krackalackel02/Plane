import * as THREE from "three";

const WIDTH = 512;
const HEIGHT = 256;

/**
 * Procedural equirectangular texture for the planet's ocean base - a
 * saturated satin blue with a gentle vertical sheen. Landmasses are no
 * longer painted here: they're real extruded 3D geometry (see
 * landmass.tsx), stacked on top of this sphere rather than baked flat into
 * its surface texture.
 */
export const createPlanetTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, "#57a8ea");
  base.addColorStop(0.45, "#2b8ce6");
  base.addColorStop(1, "#1c6bc2");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
