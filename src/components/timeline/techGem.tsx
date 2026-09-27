import React, { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  SiTypescript,
  SiJavascript,
  SiHtml5,
  SiPython,
  SiReact,
  SiNextdotjs,
  SiBootstrap,
  SiCplusplus,
  SiPandas,
  SiPytorch,
  SiScikitlearn,
  SiClerk,
  SiGnubash,
} from "react-icons/si";
import { FaAws, FaCss3Alt } from "react-icons/fa";
import { TbBrandOpenai } from "react-icons/tb";
import "./techGem.css";

interface TechMeta {
  Icon?: IconType;
  gradient: [string, string];
  iconColor: string;
}

// Known brand icons/colors for the stack entries used across boardItems.json.
// Anything not listed here (e.g. Abaqus, MPI) falls back to a generated
// initials gem so new tech-stack strings never render blank.
const TECH_META: Record<string, TechMeta> = {
  "next.js": {
    Icon: SiNextdotjs,
    gradient: ["#2b2b2b", "#000000"],
    iconColor: "#ffffff",
  },
  typescript: {
    Icon: SiTypescript,
    gradient: ["#3178c6", "#1c4d80"],
    iconColor: "#ffffff",
  },
  javascript: {
    Icon: SiJavascript,
    gradient: ["#f7df1e", "#b8a300"],
    iconColor: "#1a1a1a",
  },
  aws: { Icon: FaAws, gradient: ["#ff9900", "#b56b00"], iconColor: "#1a1a1a" },
  dynamodb: { gradient: ["#4053d6", "#232f8f"], iconColor: "#ffffff" },
  openai: {
    Icon: TbBrandOpenai,
    gradient: ["#10a37f", "#0a6b53"],
    iconColor: "#ffffff",
  },
  clerk: {
    Icon: SiClerk,
    gradient: ["#6c47ff", "#432b9e"],
    iconColor: "#ffffff",
  },
  reactjs: {
    Icon: SiReact,
    gradient: ["#0f172a", "#082032"],
    iconColor: "#61dafb",
  },
  python: {
    Icon: SiPython,
    gradient: ["#306998", "#1c3f5f"],
    iconColor: "#ffd43b",
  },
  pytorch: {
    Icon: SiPytorch,
    gradient: ["#ee4c2c", "#a3311a"],
    iconColor: "#ffffff",
  },
  pandas: {
    Icon: SiPandas,
    gradient: ["#150458", "#0a0230"],
    iconColor: "#ffffff",
  },
  "scikit-learn": {
    Icon: SiScikitlearn,
    gradient: ["#f7931e", "#b96700"],
    iconColor: "#ffffff",
  },
  xgboost: { gradient: ["#0e7c86", "#0a545c"], iconColor: "#ffffff" },
  "c++": {
    Icon: SiCplusplus,
    gradient: ["#00599c", "#00334f"],
    iconColor: "#ffffff",
  },
  html: {
    Icon: SiHtml5,
    gradient: ["#e34f26", "#a12f11"],
    iconColor: "#ffffff",
  },
  css: {
    Icon: FaCss3Alt,
    gradient: ["#1572b6", "#0d4c7d"],
    iconColor: "#ffffff",
  },
  bootstrap: {
    Icon: SiBootstrap,
    gradient: ["#7952b3", "#4c327a"],
    iconColor: "#ffffff",
  },
  bash: {
    Icon: SiGnubash,
    gradient: ["#4eaa25", "#2f6c16"],
    iconColor: "#ffffff",
  },
  batch: { gradient: ["#546e7a", "#31424a"], iconColor: "#ffffff" },
  "matlab simulink": { gradient: ["#e2701a", "#9c4c0f"], iconColor: "#ffffff" },
  mpi: { gradient: ["#5c6ac4", "#38427a"], iconColor: "#ffffff" },
  openmp: { gradient: ["#c0504d", "#7d312f"], iconColor: "#ffffff" },
  abaqus: { gradient: ["#8e44ad", "#5b2c6f"], iconColor: "#ffffff" },
  "catia 3dx": { gradient: ["#1f6feb", "#123c86"], iconColor: "#ffffff" },
};

const FALLBACK_PALETTE: [string, string][] = [
  ["#8e44ad", "#5b2c6f"],
  ["#1f6feb", "#123c86"],
  ["#c0504d", "#7d312f"],
  ["#0e7c86", "#0a545c"],
  ["#5c6ac4", "#38427a"],
];

const hashString = (value: string) =>
  Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

/** Generates a short readable label for tech strings with no dedicated icon. */
const getFallbackLabel = (tech: string): string => {
  const words = tech.trim().split(/\s+/);
  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }
  const caps = tech.match(/[A-Z0-9]/g);
  if (caps && caps.length >= 2) {
    return caps.slice(0, 3).join("");
  }
  return tech.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
};

const TechGem: React.FC<{ tech: string; index: number; idle?: boolean }> = ({
  tech,
  index,
  idle = true,
}) => {
  const [revealed, setRevealed] = useState(false);
  const meta = TECH_META[tech.toLowerCase()];
  const gradient =
    meta?.gradient ??
    FALLBACK_PALETTE[hashString(tech) % FALLBACK_PALETTE.length];
  const Icon = meta?.Icon;
  const iconColor = meta?.iconColor ?? "#ffffff";
  const label = Icon ? undefined : getFallbackLabel(tech);

  return (
    <button
      type="button"
      className={`tech-gem${revealed ? " is-revealed" : ""}${idle ? "" : " no-idle"}`}
      style={
        {
          "--gem-from": gradient[0],
          "--gem-to": gradient[1],
          "--gem-delay": `${(index % 6) * 0.18}s`,
        } as React.CSSProperties
      }
      aria-label={tech}
      onClick={() => setRevealed((prev) => !prev)}
      onBlur={() => setRevealed(false)}
    >
      <span className="tech-gem-shape">
        {Icon ? (
          <Icon aria-hidden="true" color={iconColor} size={16} />
        ) : (
          <span className="tech-gem-label" aria-hidden="true">
            {label}
          </span>
        )}
      </span>
      <span className="tech-gem-tooltip" aria-hidden="true">
        {tech}
      </span>
    </button>
  );
};

// Base cycling speed in slots/sec (1 slot == moving the focus from one
// gem to the next) while between focal zones - see FOCAL_ZONE_FRACTION,
// which slows this down approaching a slot and speeds back up leaving it.
const BASE_SLOTS_PER_SEC = 0.5;
// How close (as a fraction of one slot) the focus has to be to a gem
// before velocity starts easing down toward MIN_SPEED_FRACTION - the
// "+-15%" focal zone.
const FOCAL_ZONE_FRACTION = 0.15;
const MIN_SPEED_FRACTION = 0.06;
// Local per-gem perspective depth for the side-item inward tilt below
// (a transform-list `perspective()` function, not the CSS `perspective`
// property - see the class doc comment for why that distinction matters
// here).
const PERSPECTIVE_PX = 1000;
const TILT_MAX_DEG = 15;
// Scale/brightness/opacity interpolate from the *_CENTER value at
// distance 0 down to the *_SIDE value by distance 1, then hold flat -
// every gem beyond the immediate neighbors reads as the same "resting"
// side card rather than continuing to shrink into the distance.
const SCALE_CENTER = 1.28;
const SCALE_SIDE = 0.88;
const BRIGHTNESS_CENTER = 1.2;
const BRIGHTNESS_SIDE = 0.72;
const OPACITY_SIDE = 0.85;
// Extra clearance (px) specifically for a gem's first slot of distance,
// on top of its own shrinking half-width, so the still-large center card
// never clips into its immediate neighbors - see spacingForDistance().
const NEAR_SLOT_SPACING_PX = 60;
const FAR_SLOT_SPACING_PX = 40;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Distance-from-focus (0 = dead center, growing by 1 per slot either
 * side) drives every visual: scale, brightness, opacity, z-index and
 * horizontal offset all interpolate smoothly over the first slot of
 * distance and then hold constant - see the shared clamp01(distance)
 * factor used throughout tick() below.
 */
const spacingForDistance = (distance: number) => {
  const near = Math.min(distance, 1) * NEAR_SLOT_SPACING_PX;
  const far = Math.max(0, distance - 1) * FAR_SLOT_SPACING_PX;
  return near + far;
};

/**
 * Cover Flow-style focal carousel: gems sit along a line, evenly spaced
 * by index, with a continuous (fractional) "focus" position that glides
 * from one gem to the next rather than jumping. Whichever gem is
 * currently closest scales up, brightens, and rises to the top of the
 * stack; neighbors shrink and dim the further they are from focus.
 *
 * The anti-overlap spacing (spacingForDistance above) is baked directly
 * into each gem's own position formula, as a function of its own
 * fractional distance from focus - not computed as a correction applied
 * on top of some other "natural" position. An earlier version pushed
 * overlapping gems apart *after* computing their circular-motion
 * position, and the two disagreed frame to frame (particularly whenever
 * the pushed-against anchor gem changed), which made the whole thing
 * visibly jump/jutter. Deriving position from distance directly means
 * there's only ever one position for a given distance, so nothing to
 * disagree with - motion stays continuous even as the focal point moves
 * (see the velocity easing in tick() below).
 *
 * Gems never disappear or fade to nothing - correct z-index ordering
 * (a plain 2D stacking context; see the note below) already means a
 * focused gem properly overlaps a side gem where they're close, the way
 * a nearer card naturally would. Side gems just also rotate slightly
 * inward (a per-gem local `perspective()` + rotateY, independent of any
 * shared 3D rendering context) and dim, to read as "receding" rather
 * than vanishing.
 *
 * This used to be a real CSS 3D carousel relying on the browser's own
 * preserve-3d depth-sort to pick paint order between overlapping gems.
 * That native sort turned out to be unreliable in practice - once
 * several gems land at near-identical depths, the browser can paint a
 * farther-back gem over a nearer one regardless of z-index or DOM order
 * (verified directly in the running app). So paint order here is
 * controlled with a plain z-index instead, which - so long as gems don't
 * share a 3D rendering context with each other, which they don't - is
 * simply always honored.
 */
const TechCarousel: React.FC<{ techStack: string[] }> = ({ techStack }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Fractional index of whichever slot currently has focus - e.g. 2.4
  // means 40% of the way from gem 2 to gem 3.
  const focusRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const count = techStack.length;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      // Clamp so a backgrounded/throttled tab resuming after a long gap
      // continues smoothly instead of the carousel jumping through
      // several slots' worth of "missed" time in one frame.
      const deltaSec = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (!pausedRef.current && !prefersReducedMotion && count > 0) {
        const distToNearestSlot = Math.abs(
          focusRef.current - Math.round(focusRef.current),
        );
        const zoneFrac = clamp01(distToNearestSlot / FOCAL_ZONE_FRACTION);
        const speedFactor = lerp(MIN_SPEED_FRACTION, 1, smoothstep(zoneFrac));
        focusRef.current =
          (focusRef.current + BASE_SLOTS_PER_SEC * speedFactor * deltaSec) %
          count;
      }

      let closestIndex = 0;
      let closestDist = Infinity;

      itemRefs.current.forEach((item, index) => {
        if (!item || count === 0) return;

        let distance = (index - focusRef.current) % count;
        if (distance > count / 2) distance -= count;
        if (distance < -count / 2) distance += count;

        const absDist = Math.abs(distance);
        if (absDist < closestDist) {
          closestDist = absDist;
          closestIndex = index;
        }

        const t = clamp01(absDist);
        const eased = smoothstep(t);
        const scale = lerp(SCALE_CENTER, SCALE_SIDE, eased);
        const brightness = lerp(BRIGHTNESS_CENTER, BRIGHTNESS_SIDE, eased);
        const opacity = lerp(1, OPACITY_SIDE, eased);
        const tilt =
          Math.sign(distance) *
          Math.min(TILT_MAX_DEG, Math.abs(distance) * TILT_MAX_DEG);

        const x = Math.sign(distance) * spacingForDistance(absDist);

        item.style.transform = `translateX(${x}px) scale(${scale}) perspective(${PERSPECTIVE_PX}px) rotateY(${-tilt}deg)`;
        item.style.zIndex = String(Math.round(1000 - absDist * 100));
        item.style.filter = `brightness(${brightness})`;
        item.style.opacity = String(opacity);
      });

      itemRefs.current.forEach((item, index) => {
        if (!item) return;
        item.classList.toggle("is-focused", index === closestIndex);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [count]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div className="tech-stack-row">
      <span className="tech-stack-label">Tech Stack</span>
      <div
        className="tech-carousel-stage"
        ref={stageRef}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        <div className="tech-carousel-ring" ref={ringRef}>
          {techStack.map((tech, index) => (
            <div
              className="tech-carousel-item"
              key={tech}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            >
              <TechGem tech={tech} index={index} idle={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechCarousel;
