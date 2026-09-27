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
// Front-half (facing the viewer) gems are lit up toward this brightness;
// back-half gems dim down toward the other end, continuously by depth -
// see the z-based lerp in tick().
const BRIGHTNESS_BACK = 0.65;
const BRIGHTNESS_FRONT = 1.15;

/**
 * Auto-rotating "3D" ring: gems sit evenly spaced around an ellipse whose
 * axis is vertical (Y), stepping one slot at a time - rotate to bring the
 * next gem to dead center, pause there for a beat so it can be read as
 * the "showcase" gem, then rotate to the next one.
 *
 * It's an ellipse rather than a circle so the horizontal spread and the
 * depth (how much gems shrink/grow and how bunched-up the perspective
 * makes them look) can be tuned independently: the x radius is the
 * carousel's own on-page width (so gems use the full card), while the z
 * radius is the stage's height - a much smaller, independently-tunable
 * value that keeps the perspective effect gentle instead of a circle's
 * single radius forcing depth to scale up right along with width.
 *
 * Gems never disappear or fade out, even swinging around the back -
 * that's still "the carousel", just its far side, and correct z-index
 * (see below) already means a nearer gem properly occludes a farther one
 * where they visually overlap, same as it would in a real 3D scene. A
 * continuous brightness lerp (front lit up, back dimmed) is the only
 * front/back cue, on top of the natural perspective size falloff.
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
  // Ellipse radii: x (horizontal spread) tracks the stage's own width, z
  // (depth) its height - see the class doc comment above for why these
  // are deliberately independent instead of a single shared radius.
  const radiusXRef = useRef(140);
  const radiusZRef = useRef(48);
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
      // 2 * radiusX == the carousel's own width, so the ring's horizontal
      // diameter matches the card it's shown inside; radiusZ is the
      // stage's height, an independent (and much smaller) depth budget.
      const rect = stage.getBoundingClientRect();
      radiusXRef.current = rect.width / 2;
      radiusZRef.current = rect.height;
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
        const cos = Math.cos(rad);

        // z: signed depth along the camera axis (+radiusZ = closest to
        // the viewer, at displayAngle 0; -radiusZ = farthest, at +-180).
        const z = radiusZRef.current * cos;
        const x = radiusXRef.current * Math.sin(rad);
        const projScale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);

        item.style.transform = `translateX(${x * projScale}px) scale(${projScale})`;
        item.style.zIndex = String(Math.round(z * 1000));
        item.style.filter = `brightness(${
          BRIGHTNESS_BACK + ((cos + 1) / 2) * (BRIGHTNESS_FRONT - BRIGHTNESS_BACK)
        })`;
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
