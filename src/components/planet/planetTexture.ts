import * as THREE from "three";
import { CONTINENTS, lonLatToUV } from "./planetTerrain";

const WIDTH = 1536;
const HEIGHT = 768;

/**
 * Draws one continent's silhouette as two stacked, beveled layers - a
 * light beige "coastline shelf" (the lower layer) with a smaller lime/
 * forest green "greenery" layer inset on top - the classic claymation-
 * globe look of landmasses built from distinct extruded plates rather
 * than a single flat color. Each sub-blob is drawn three times (shifted a
 * full texture width left/right) so a blob straddling the lon=0/2pi seam
 * still wraps correctly.
 */
const paintContinent = (
  ctx: CanvasRenderingContext2D,
  continent: (typeof CONTINENTS)[number],
) => {
  const toPixel = (lon: number, lat: number): [number, number] => {
    const [u, v] = lonLatToUV(lon, lat);
    return [u * WIDTH, v * HEIGHT];
  };

  for (const shift of [-WIDTH, 0, WIDTH]) {
    // Drop shadow: a soft, slightly offset dark blob under everything,
    // giving the coastline shelf a lifted, contact-shadowed edge.
    ctx.fillStyle = "rgba(20, 30, 20, 0.28)";
    ctx.beginPath();
    for (const blob of continent.blobs) {
      const [x, y] = toPixel(blob.lon, blob.lat);
      const rx = (blob.radius / (Math.PI * 2)) * WIDTH;
      const ry = (blob.radius / Math.PI) * HEIGHT;
      ctx.moveTo(x + shift + rx * 1.08, y + ry * 0.12);
      ctx.ellipse(
        x + shift,
        y + ry * 0.12,
        rx * 1.08,
        ry * 1.08,
        0,
        0,
        Math.PI * 2,
      );
    }
    ctx.fill();

    // Coastline shelf - beige base plate, slightly larger than the
    // greenery layer above it so a rim stays visible all the way around.
    ctx.fillStyle = "#e8d9ad";
    ctx.strokeStyle = "#b8a36c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const blob of continent.blobs) {
      const [x, y] = toPixel(blob.lon, blob.lat);
      const rx = (blob.radius / (Math.PI * 2)) * WIDTH;
      const ry = (blob.radius / Math.PI) * HEIGHT;
      ctx.moveTo(x + shift + rx, y);
      ctx.ellipse(x + shift, y, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Greenery layer - lime/forest green, inset from the shelf so its
    // bevel rim reads as a raised plate stacked on top.
    ctx.fillStyle = "#7fbf4d";
    ctx.strokeStyle = "#4f8a2c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const blob of continent.blobs) {
      const [x, y] = toPixel(blob.lon, blob.lat);
      const rx = (blob.radius / (Math.PI * 2)) * WIDTH * 0.72;
      const ry = (blob.radius / Math.PI) * HEIGHT * 0.72;
      ctx.moveTo(x + shift + rx, y);
      ctx.ellipse(x + shift, y, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Soft top-left highlight on the greenery, matching the scene's key
    // light direction, to sell the semi-gloss clay finish.
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.beginPath();
    for (const blob of continent.blobs) {
      const [x, y] = toPixel(blob.lon, blob.lat);
      const rx = (blob.radius / (Math.PI * 2)) * WIDTH * 0.32;
      const ry = (blob.radius / Math.PI) * HEIGHT * 0.32;
      ctx.ellipse(
        x + shift - rx * 0.4,
        y - ry * 0.5,
        rx,
        ry,
        0,
        0,
        Math.PI * 2,
      );
    }
    ctx.fill();
  }
};

/**
 * Procedural equirectangular texture for the planet: a satin ocean base
 * with beveled, two-tier claymation landmasses (see paintContinent)
 * scattered across it. Matches lonLatToUV exactly (same formula the tree
 * scatter in planetTerrain.ts reasons about in 3D), so paint here and
 * foliage placement in index.tsx never disagree about where "land" is.
 */
export const createPlanetTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Ocean base - a satin, mid-toned blue with a gentle top-to-bottom
  // sheen, standing in for the "soft specular highlight" a real satin
  // material would pick up from the scene's own key light.
  const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, "#4fa8d8");
  base.addColorStop(0.45, "#2f7fc1");
  base.addColorStop(1, "#1f5a92");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const continent of CONTINENTS) paintContinent(ctx, continent);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
