import React, { useCallback, useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
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

const CENTER_THRESHOLD = 0.12;
// Distance (px) from the carousel's center at which a gem reaches its
// fully-receded state; beyond this, items just clamp at that same look.
const FALLOFF_PX = 130;
const MAX_ROTATE_DEG = 55;

/**
 * Horizontal "coverflow" carousel: the centered gem sits flat and at full
 * size, while neighbors recede in Z, rotate to face the center, shrink, and
 * fade - then swap places as the user scrolls/swipes/drags through the
 * strip. Built on native horizontal scroll + scroll-snap (for touch/trackpad
 * momentum and keyboard/focus support) with a scroll listener driving the
 * per-item 3D transform, since CSS alone can't express "transform based on
 * distance from viewport center" across browsers yet.
 */
const TechCarousel: React.FC<{ techStack: string[] }> = ({ techStack }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centerIndexRef = useRef(0);
  const rafRef = useRef(0);

  const updateTransforms = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;

    let bestIndex = 0;
    let bestDistance = Infinity;

    itemRefs.current.forEach((item, index) => {
      if (!item) return;
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.left + itemRect.width / 2;
      const distance = itemCenter - centerX;
      const absDistance = Math.abs(distance);
      const normalized = Math.max(-1, Math.min(1, distance / FALLOFF_PX));
      const absNormalized = Math.abs(normalized);

      const rotateY = normalized * -MAX_ROTATE_DEG;
      const scale = 1 - absNormalized * 0.4;
      const translateZ = -absNormalized * 40;
      const opacity = 1 - absNormalized * 0.7;
      const zIndex = Math.round((1 - absNormalized) * 50);

      item.style.transform = `translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
      item.style.opacity = String(opacity);
      item.style.zIndex = String(zIndex);
      item.classList.toggle("is-centered", absNormalized < CENTER_THRESHOLD);

      if (absDistance < bestDistance) {
        bestDistance = absDistance;
        bestIndex = index;
      }
    });

    centerIndexRef.current = bestIndex;
  }, []);

  useEffect(() => {
    updateTransforms();
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTransforms);
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      track.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onScroll);
    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateTransforms, techStack.length]);

  const scrollToIndex = (index: number) => {
    itemRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div className="tech-stack-row">
      <span className="tech-stack-label">Tech Stack</span>
      <div className="tech-carousel">
        {techStack.length > 1 && (
          <button
            type="button"
            className="tech-carousel-arrow tech-carousel-arrow-prev"
            aria-label="Previous tech"
            onClick={() =>
              scrollToIndex(Math.max(0, centerIndexRef.current - 1))
            }
          >
            <FaChevronLeft aria-hidden="true" size={11} />
          </button>
        )}

        <div className="tech-carousel-track" ref={trackRef}>
          <div className="tech-carousel-spacer" aria-hidden="true" />
          {techStack.map((tech, index) => (
            <div
              className="tech-carousel-item"
              key={tech}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => scrollToIndex(index)}
              onFocus={() => scrollToIndex(index)}
            >
              <TechGem tech={tech} index={index} idle={false} />
            </div>
          ))}
          <div className="tech-carousel-spacer" aria-hidden="true" />
        </div>

        {techStack.length > 1 && (
          <button
            type="button"
            className="tech-carousel-arrow tech-carousel-arrow-next"
            aria-label="Next tech"
            onClick={() =>
              scrollToIndex(
                Math.min(techStack.length - 1, centerIndexRef.current + 1),
              )
            }
          >
            <FaChevronRight aria-hidden="true" size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TechCarousel;
