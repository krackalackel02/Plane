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

// Full loop time in degrees/sec while actively rotating between showcase
// spots - a complete revolution (if it never paused) would take
// 360/this seconds.
const ROTATION_DEG_PER_SEC = 32;
// Mirrors the carousel's old `perspective: 640px` CSS value, now applied
// manually (see TechCarousel doc comment below) instead of via real CSS
// perspective/3D transforms.
const PERSPECTIVE_PX = 640;
// How long rotation holds still with a gem centered in the showcase spot
// before advancing to the next one.
const SHOWCASE_PAUSE_SEC = 1.1;
// A gem's screen x-offset is radius*sin(angle), which is only monotonic
// (i.e. further from center = further from its neighbors) for angles
// within +-90deg of dead-center-front. Past that, sin folds back toward
// 0, so a gem swinging around the back would visually cross paths with
// whichever gem is trailing it in front - fade gems out approaching this
// side-profile point and back in on the far side, same idea as the old
// backface-visibility: hidden, so that never becomes visible.
const FADE_START_DEG = 78;
const FADE_END_DEG = 92;

/**
 * Auto-rotating "3D" ring: gems sit evenly spaced around a circle whose
 * axis is vertical (Y), stepping one slot at a time - rotate to bring the
 * next gem to dead center, pause there for a beat so it can be read as
 * the "showcase" gem, then rotate to the next one.
 *
 * This used to continuously rotate while also warping the (otherwise
 * evenly spaced) angles to bunch several gems together near the front
 * and scaling/brightening whichever was closest to center. That caused
 * two problems: bunched-together gems could visually overlap (only
 * partly fixable - see the z-index note below), and because a gem was
 * still ramping into its "showcase" bump before the previous one had
 * finished ramping out, they'd overlap mid-transition too. Pausing on
 * each evenly-spaced showcase spot removes the timing overlap
 * (transitions are simple, constant-spacing, constant-scale moves
 * between holds), and dropping the artificial bunching/scale-bump
 * removes the spatial one - gems are never closer together than their
 * even base spacing, and the only size variation left is the natural
 * perspective falloff below (nearer = bigger), not an extra effect
 * layered on top.
 *
 * This used to be a real CSS 3D carousel (rotateY + translateZ on a
 * transform-style: preserve-3d ancestor, letting the browser's own 3D
 * depth-sort pick paint order). That native sort turned out to be
 * unreliable in practice: once several gems land at near-identical
 * depths, the browser can paint a farther-back gem over a nearer one
 * regardless of z-index or DOM order (verified in the running app - both
 * were tried and both failed to fix it). So the "3D" here is faked
 * manually instead: each gem's angle is projected to a 2D x-offset and
 * scale using the standard perspective formula (scale = P / (P - z)),
 * and paint order is controlled with a plain z-index - which, outside of
 * a shared 3D rendering context, is simply always honored.
 */
const TechCarousel: React.FC<{ techStack: string[] }> = ({ techStack }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const radiusRef = useRef(140);
  const rotationRef = useRef(0);
  const pausedRef = useRef(false);
  // Seconds remaining in the current showcase-spot dwell (0 = actively
  // rotating toward the next slot).
  const stepPauseRef = useRef(0);
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

      const slotAngle = 360 / count;

      if (!pausedRef.current && !prefersReducedMotion) {
        if (stepPauseRef.current > 0) {
          stepPauseRef.current = Math.max(0, stepPauseRef.current - deltaSec);
        } else {
          const prevRotation = rotationRef.current;
          const nextRotation = prevRotation + ROTATION_DEG_PER_SEC * deltaSec;
          // Snap exactly onto the next showcase spot the instant we'd
          // otherwise overshoot it, then hold there for a beat, so gems
          // only ever move at a constant rate between two evenly-spaced,
          // stationary slots instead of drifting past center.
          if (Math.floor(nextRotation / slotAngle) > Math.floor(prevRotation / slotAngle)) {
            rotationRef.current =
              (Math.floor(nextRotation / slotAngle) * slotAngle) % 360;
            stepPauseRef.current = SHOWCASE_PAUSE_SEC;
          } else {
            rotationRef.current = nextRotation % 360;
          }
        }
      }

      itemRefs.current.forEach((item, index) => {
        if (!item) return;

        const baseAngle = slotAngle * index;
        let displayAngle = (baseAngle + rotationRef.current) % 360;
        if (displayAngle > 180) displayAngle -= 360;
        const rad = (displayAngle * Math.PI) / 180;

        // z: signed depth along the camera axis (+radius = closest to the
        // viewer, at displayAngle 0; -radius = farthest, at +-180).
        const z = radiusRef.current * Math.cos(rad);
        const x = radiusRef.current * Math.sin(rad);
        const projScale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);

        item.style.transform = `translateX(${x * projScale}px) scale(${projScale})`;
        item.style.zIndex = String(Math.round(z * 1000));

        const opacity =
          1 -
          Math.min(
            1,
            Math.max(
              0,
              (Math.abs(displayAngle) - FADE_START_DEG) /
                (FADE_END_DEG - FADE_START_DEG),
            ),
          );
        item.style.opacity = String(opacity);
        item.style.pointerEvents = opacity < 0.05 ? "none" : "auto";
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
