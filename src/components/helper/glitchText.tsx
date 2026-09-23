import { useEffect, useState } from "react";

/* eslint-disable react/prop-types -- TS interfaces already cover this */

const GLITCH_CHARS = "!<>-_\\/[]{}=+*^#$%&01";

interface GlitchTextProps {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  // Roughly how long each character takes to lock in, left to right.
  charDelayMs?: number;
  // Holds the very first scrambled frame static for this long before
  // starting to resolve, so a panel's own tear-in animation (welcome-alert's
  // glitch-in) gets a clear beat to register before per-frame text flicker
  // starts competing with it for attention.
  startDelayMs?: number;
}

// Spaces stay put (so word boundaries read cleanly); every other
// not-yet-locked character is redrawn as a random glitch glyph each frame,
// which reads as flicker rather than a static placeholder.
const buildFrame = (text: string, locked: number) =>
  text
    .split("")
    .map((char, index) => {
      if (index < locked || char === " ") return char;
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    })
    .join("");

// Decrypt-style reveal: text resolves left to right out of scrambled glyphs,
// evoking a corrupted transmission being recovered rather than a plain
// typewriter effect.
const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  as: Tag = "span",
  className,
  charDelayMs = 16,
  startDelayMs = 0,
}) => {
  const [display, setDisplay] = useState(() => buildFrame(text, 0));

  useEffect(() => {
    let frame: number;
    let start: number | null = null;

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      if (elapsed < startDelayMs) {
        // Still in the hold: keep the first frame's scramble static rather
        // than re-rolling it every tick, so nothing flickers yet.
        frame = requestAnimationFrame(tick);
        return;
      }
      const locked = Math.min(
        text.length,
        Math.floor((elapsed - startDelayMs) / charDelayMs),
      );
      setDisplay(buildFrame(text, locked));
      if (locked < text.length) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, charDelayMs, startDelayMs]);

  return <Tag className={className}>{display}</Tag>;
};

export default GlitchText;
