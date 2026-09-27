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

// Full loop time in degrees/sec - a complete revolution takes 360/this seconds.
const ROTATION_DEG_PER_SEC = 32;
// Mirrors the carousel's old `perspective: 640px` CSS value, now applied
// manually (see TechCarousel doc comment below) instead of via real CSS
// perspective/3D transforms.
const PERSPECTIVE_PX = 640;
// Arc (in degrees either side of dead-center-front) over which the
// "showcase" scale/brightness bump ramps in.
const FOCUS_WINDOW_DEG = 60;
const SCALE_SHADOW = 0.82;
const SCALE_SHOWCASE = 1.3;
const BRIGHTNESS_SHADOW = 0.55;
const BRIGHTNESS_SHOWCASE = 1.35;
// >1 warps each item's raw, evenly-spaced angle toward the front (0deg),
// so several gems bunch up near the showcase spot while the rest of the
// ring (mostly hidden around back) stays comparatively sparse - rather
// than every item being equidistant all the way around.
const CLUSTER_POWER = 2.3;

/**
 * Auto-rotating "3D" ring: gems sit around a circle whose axis is
 * vertical (Y). Their evenly-spaced base angle is warped (see
 * CLUSTER_POWER) so they bunch together near the front showcase spot
 * instead of spreading uniformly around the whole circle.
 *
 * This used to be a real CSS 3D carousel (rotateY + translateZ on a
 * transform-style: preserve-3d ancestor, letting the browser's own 3D
 * depth-sort pick paint order). That native sort turned out to be
 * unreliable in practice: once CLUSTER_POWER packs several gems into
 * near-identical depths near the showcase spot, the browser can paint a
 * farther-back gem over a nearer one regardless of z-index or DOM order
 * (verified in the running app - both were tried and both failed to fix
 * it). So the "3D" here is now faked manually: each gem's angle is
 * projected to a 2D x-offset and scale using the standard perspective
 * formula (scale = P / (P - z)), and paint order is controlled with a
 * plain z-index - which, outside of a shared 3D rendering context, is
 * simply always honored. A per-frame loop advances the rotation phase
 * (pausing on hover/focus so a curious visitor can read a label) and
 * lights up whichever gem currently sits in the showcase spot, dimming
 * the rest into shadow.
 *
 * CLUSTER_POWER's bunching also means several gems' natural projected
 * positions land close enough to visually overlap near the showcase
 * spot. An earlier version of this component forcibly pushed overlapping
 * neighbors sideways to keep them apart, but that fights the circular
 * path every gem is actually moving along - the forced position and the
 * natural rotated position disagree, so gems visibly jump/jutter instead
 * of moving smoothly. Left alone (just the z-index fix above), an
 * overlap during the crowded moment just looks like one gem correctly
 * sliding in front of another as they rotate through the showcase spot,
 * which reads as normal carousel motion rather than a glitch.
 */
const TechCarousel: React.FC<{ techStack: string[] }> = ({ techStack }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const radiusRef = useRef(140);
  const rotationRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const count = techStack.length;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      // 2 * radius == the carousel's own width, so the ring's diameter
      // matches the card it's shown inside.
      radiusRef.current = stage.getBoundingClientRect().width / 2;
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      // Clamp so a backgrounded/throttled tab resuming after a long gap
      // continues smoothly instead of the ring jumping through several
      // rotations worth of "missed" time in one frame.
      const deltaSec = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (!pausedRef.current && !prefersReducedMotion) {
        rotationRef.current =
          (rotationRef.current + ROTATION_DEG_PER_SEC * deltaSec) % 360;
      }

      itemRefs.current.forEach((item, index) => {
        if (!item) return;
        const inner = item.firstElementChild as HTMLElement | null;
        if (!inner) return;

        const baseAngle = (360 / count) * index;
        let raw = (baseAngle + rotationRef.current) % 360;
        if (raw > 180) raw -= 360;

        const fraction = Math.abs(raw) / 180;
        const warpedFraction = Math.pow(fraction, CLUSTER_POWER);
        const displayAngle = Math.sign(raw) * warpedFraction * 180;
        const rad = (displayAngle * Math.PI) / 180;

        // z: signed depth along the camera axis (+radius = closest to the
        // viewer, at displayAngle 0; -radius = farthest, at +-180).
        const z = radiusRef.current * Math.cos(rad);
        const x = radiusRef.current * Math.sin(rad);
        const projScale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);

        item.style.transform = `translateX(${x * projScale}px) scale(${projScale})`;
        item.style.zIndex = String(Math.round(z * 1000));

        const focus = Math.max(
          0,
          1 - Math.abs(displayAngle) / FOCUS_WINDOW_DEG,
        );
        inner.style.transform = `scale(${SCALE_SHADOW + focus * (SCALE_SHOWCASE - SCALE_SHADOW)})`;
        inner.style.filter = `brightness(${BRIGHTNESS_SHADOW + focus * (BRIGHTNESS_SHOWCASE - BRIGHTNESS_SHADOW)})`;
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
              <div className="tech-carousel-item-inner">
                <TechGem tech={tech} index={index} idle={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechCarousel;
