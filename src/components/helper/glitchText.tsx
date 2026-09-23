import { useEffect, useState } from "react";

/* eslint-disable react/prop-types -- TS interfaces already cover this */

const GLITCH_CHARS = "!<>-_\\/[]{}=+*^#$%&01";

interface GlitchTextProps {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  // Roughly how long each character takes to lock in, left to right.
  charDelayMs?: number;
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
}) => {
  const [display, setDisplay] = useState(() => buildFrame(text, 0));

  useEffect(() => {
    let frame: number;
    let start: number | null = null;

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp;
      const locked = Math.min(
        text.length,
        Math.floor((timestamp - start) / charDelayMs),
      );
      setDisplay(buildFrame(text, locked));
      if (locked < text.length) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, charDelayMs]);

  return <Tag className={className}>{display}</Tag>;
};

export default GlitchText;
