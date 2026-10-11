import type { Vector3 } from "three";
import type { AzimuthalProjection } from "./planetMapProjection";
import {
  HIGHLAND_COLOR,
  type DesertRelief,
  type LandmassRelief,
  type RidgeRelief,
} from "./mapRelief";
import { ROCK_COLORS } from "../planet/geology";

/**
 * Canvas drawing for the map's terrain (see mapRelief.ts for what's drawn and
 * where it comes from). Everything is reprojected through the live
 * ship-centred projection on every call. `px` scales strokes and glyphs with
 * the map's size - 1 for the collapsed dock, larger when expanded.
 */

type ToMap = AzimuthalProjection["toMap"];
type MapPoint = [number, number];

// A projected 2D polyline/polygon can leap clear across the map between two
// consecutive samples if the underlying 3D points straddle the exact
// antipodal point from the viewer (the one singularity of an azimuthal
// equidistant projection - see planetMapProjection.ts). Any single-step jump
// bigger than the map's own diameter can only be that, never a real move, so
// it's the signal to break and start a fresh segment rather than drawing a
// spurious streak across the circle.
export const isProjectionJump = (
  a: MapPoint,
  b: MapPoint,
  size: number,
): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) > size * 0.75;

export const projectPolyline = (
  points: Vector3[],
  toMap: ToMap,
  size: number,
): MapPoint[][] => {
  const segments: MapPoint[][] = [];
  let current: MapPoint[] = [];
  for (const point of points.map((p) => toMap(p))) {
    const previous = current[current.length - 1];
    if (previous && isProjectionJump(previous, point, size)) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
};

const strokeSegments = (
  ctx: CanvasRenderingContext2D,
  segments: MapPoint[][],
) => {
  ctx.beginPath();
  for (const segment of segments) {
    segment.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.stroke();
};

/**
 * Adds one landmass outline to the current path, closed - the one shape its
 * fill, its clip and its bevel all share.
 *
 * On an azimuthal equidistant map the antipode of the centre is not a point
 * but the whole outer rim, so an outline that crosses it leaves one edge of
 * the disc and re-enters at a completely different bearing. Joining those two
 * points directly - which is what filling the raw projected polygon does -
 * draws a chord straight across the map and floods the disc with that
 * landmass's colour. So where the outline leaves the rim, walk *along* the rim
 * to where it comes back, and the region follows the disc's edge instead of
 * cutting across it.
 */
const traceOutline = (
  ctx: CanvasRenderingContext2D,
  segments: MapPoint[][],
  size: number,
) => {
  const mapRadius = size / 2;
  const bearingOf = ([x, y]: MapPoint): number =>
    Math.atan2(x - mapRadius, mapRadius - y);

  for (const segment of segments) {
    if (segment.length < 3) continue;
    segment.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // Only a split piece needs rim closure; a whole outline closes itself.
    if (segments.length > 1) {
      const from = bearingOf(segment[segment.length - 1]);
      let sweep = bearingOf(segment[0]) - from;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 0.12));
      for (let i = 1; i <= steps; i++) {
        const bearing = from + (sweep * i) / steps;
        ctx.lineTo(
          mapRadius + mapRadius * Math.sin(bearing),
          mapRadius - mapRadius * Math.cos(bearing),
        );
      }
    }
    ctx.closePath();
  }
};

const fillOutline = (
  ctx: CanvasRenderingContext2D,
  segments: MapPoint[][],
  size: number,
  color: string,
) => {
  ctx.beginPath();
  traceOutline(ctx, segments, size);
  ctx.fillStyle = color;
  ctx.fill();
};

/**
 * Every landmass as relief: a pale shallow-water halo round its coast; its
 * hypsometric bands, darkest at the shore and brightening inland, each band's
 * edge a faint contour line; an inner bevel lit from the north-west, so the
 * coast reads as the raised edge of the land; and the coastline itself.
 */
export const drawLandmasses = (
  ctx: CanvasRenderingContext2D,
  landmasses: LandmassRelief[],
  toMap: ToMap,
  size: number,
  px: number,
) => {
  const projected = landmasses.map((land) => ({
    land,
    bands: land.bands.map((band) => projectPolyline(band, toMap, size)),
    highland: land.highland && projectPolyline(land.highland, toMap, size),
  }));

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(150, 205, 245, 0.42)";
  ctx.lineWidth = 7 * px;
  for (const { bands } of projected) strokeSegments(ctx, bands[0]);

  for (const { land, bands, highland } of projected) {
    bands.forEach((segments, i) => {
      fillOutline(ctx, segments, size, land.colors[i]);
      if (i === 0) return;
      ctx.strokeStyle = "rgba(35, 45, 25, 0.2)";
      ctx.lineWidth = 0.7 * px;
      strokeSegments(ctx, segments);
    });
    if (highland) {
      fillOutline(ctx, highland, size, HIGHLAND_COLOR);
      ctx.strokeStyle = "rgba(90, 70, 30, 0.35)";
      ctx.lineWidth = 0.7 * px;
      strokeSegments(ctx, highland);
    }

    // The bevel, clipped to the land so only its inner half shows. A stroke
    // nudged toward the light lands inside the far (south-east) coasts -
    // shadow; one nudged away from it lands inside the near (north-west)
    // coasts - highlight.
    const coast = bands[0];
    ctx.save();
    ctx.beginPath();
    traceOutline(ctx, coast, size);
    ctx.clip();
    ctx.translate(-1.3 * px, -1.3 * px);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 3.2 * px;
    strokeSegments(ctx, coast);
    ctx.translate(2.6 * px, 2.6 * px);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2.2 * px;
    strokeSegments(ctx, coast);
    ctx.restore();

    ctx.strokeStyle = "rgba(18, 50, 82, 0.6)";
    ctx.lineWidth = 0.9 * px;
    strokeSegments(ctx, coast);
  }
  ctx.restore();
};

// A tree crown's radius on the map, in world units: a little wider than the
// crowns themselves, so neighbouring trees merge into one stand of woodland.
export const CANOPY_RADIUS = 2.6;

/**
 * The forest's trees as woodland: every crown traced into one path, outlined
 * first and then filled over, so where crowns overlap the fill covers their
 * inner edges and only each stand's scalloped outer edge remains - the
 * clustered-canopy symbol of a printed map.
 */
export const drawCanopy = (
  ctx: CanvasRenderingContext2D,
  crowns: Vector3[],
  toMap: ToMap,
  crownPx: number,
  px: number,
) => {
  const centres = crowns.map((crown) => toMap(crown));
  ctx.save();
  ctx.beginPath();
  for (const [x, y] of centres) {
    ctx.moveTo(x + crownPx, y);
    ctx.arc(x, y, crownPx, 0, Math.PI * 2);
  }
  ctx.strokeStyle = "#24572a";
  ctx.lineWidth = 1.4 * px;
  ctx.stroke();
  ctx.fillStyle = "#3d8836";
  ctx.fill();
  // A sunlit north-west side to each crown.
  ctx.beginPath();
  for (const [x, y] of centres) {
    const r = crownPx * 0.45;
    ctx.moveTo(x - crownPx * 0.25 + r, y - crownPx * 0.25);
    ctx.arc(x - crownPx * 0.25, y - crownPx * 0.25, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = "rgba(140, 205, 105, 0.45)";
  ctx.fill();
  ctx.restore();
};

/**
 * The mountain chains: a snowfield along each crest, as broad as the range is
 * there; slate hachures running down both flanks, longer where it's taller;
 * the crest line itself; and silhouettes of the highest summits.
 */
export const drawRidges = (
  ctx: CanvasRenderingContext2D,
  ridges: RidgeRelief,
  toMap: ToMap,
  size: number,
  unitPx: number,
  px: number,
) => {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  for (const crest of ridges.crests) {
    const points = crest.points.map((p) => toMap(p));
    for (let i = 1; i < points.length; i++) {
      if (isProjectionJump(points[i - 1], points[i], size)) continue;
      ctx.beginPath();
      ctx.moveTo(...points[i - 1]);
      ctx.lineTo(...points[i]);
      ctx.lineWidth =
        ((crest.widths[i - 1] + crest.widths[i]) / 2) * 1.7 * unitPx;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  for (const [from, to] of ridges.hachures) {
    const a = toMap(from);
    const b = toMap(to);
    if (isProjectionJump(a, b, size)) continue;
    ctx.moveTo(...a);
    ctx.lineTo(...b);
  }
  ctx.strokeStyle = "rgba(61, 74, 94, 0.7)";
  ctx.lineWidth = 0.7 * px;
  ctx.stroke();

  ctx.strokeStyle = "#2f3a4c";
  ctx.lineWidth = 1.5 * px;
  for (const crest of ridges.crests) {
    strokeSegments(ctx, projectPolyline(crest.points, toMap, size));
  }

  for (const peak of ridges.peaks) {
    const [x, y] = toMap(peak.position);
    const s = (2.4 + peak.height * 0.3) * px;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.9, y + s * 0.6);
    ctx.lineTo(x - s * 0.9, y + s * 0.6);
    ctx.closePath();
    ctx.fillStyle = ROCK_COLORS.snow;
    ctx.fill();
    ctx.strokeStyle = "#232c3a";
    ctx.lineWidth = 0.8 * px;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.38, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.05);
    ctx.lineTo(x - s * 0.38, y - s * 0.2);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();
};

// Mesa strata on the map, bottom up: terracotta stepping paler with height.
const MESA_TONES = [ROCK_COLORS.desert, "#c96f48", "#d9875b", "#e6a074"];

/**
 * The desert's relief: a dark curve along each dune's crest, bowed downwind;
 * each mesa as terraced contours, every stratum's outline filled a step
 * paler than the one beneath it; and a small arch symbol at each arch.
 */
export const drawDesertRelief = (
  ctx: CanvasRenderingContext2D,
  desert: DesertRelief,
  toMap: ToMap,
  size: number,
  px: number,
) => {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(146, 100, 52, 0.85)";
  ctx.lineWidth = 1.1 * px;
  for (const dune of desert.dunes) {
    strokeSegments(ctx, projectPolyline(dune, toMap, size));
  }

  ctx.strokeStyle = "rgba(78, 30, 12, 0.6)";
  ctx.lineWidth = 0.6 * px;
  for (const mesa of desert.mesas) {
    mesa.forEach((stratum, i) => {
      const [ring] = projectPolyline(stratum, toMap, size);
      if (!ring || ring.length < stratum.length) return; // split by the rim
      ctx.beginPath();
      ring.forEach(([x, y], k) => {
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = MESA_TONES[Math.min(i, MESA_TONES.length - 1)];
      ctx.fill();
      ctx.stroke();
    });
  }

  for (const arch of desert.arches) {
    const [x, y] = toMap(arch);
    const r = 3.4 * px;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.45, r, Math.PI, 0);
    ctx.strokeStyle = "#4f2212";
    ctx.lineWidth = 3.2 * px;
    ctx.stroke();
    ctx.strokeStyle = ROCK_COLORS.desert;
    ctx.lineWidth = 1.8 * px;
    ctx.stroke();
  }
  ctx.restore();
};
