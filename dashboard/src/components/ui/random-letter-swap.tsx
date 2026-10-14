"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&@$";

export interface RandomLetterSwapProps {
  label: string;
  className?: string;
  /** seconds between each letter's scramble start */
  staggerDuration?: number;
  /** accepted for API compatibility; scramble pacing derives from duration */
  transition?: { duration?: number; type?: string };
}

/**
 * Text that scrambles through random glyphs letter-by-letter on hover/focus,
 * then settles back — staggered per character. Respects prefers-reduced-motion.
 */
export function RandomLetterSwap({
  label,
  className,
  staggerDuration = 0.025,
  transition = { duration: 0.6, type: "spring" },
}: RandomLetterSwapProps) {
  const [display, setDisplay] = useState(label);
  const timers = useRef<number[]>([]);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      timers.current.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    setDisplay(label);
  }, [label]);

  const clearTimers = () => {
    timers.current.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    timers.current = [];
  };

  const scramble = useCallback(() => {
    if (reduceMotion.current) return;
    clearTimers();
    const chars = label.split("");
    const tickMs = Math.max(
      25,
      Math.min(80, ((transition.duration ?? 0.6) * 1000) / 14)
    );

    chars.forEach((targetChar, i) => {
      if (targetChar === " ") return;
      const startId = window.setTimeout(() => {
        let ticks = 0;
        const maxTicks = 5 + Math.floor(Math.random() * 5);
        const iv = window.setInterval(() => {
          ticks += 1;
          if (ticks >= maxTicks) {
            window.clearInterval(iv);
            setDisplay((prev) => {
              const arr = prev.split("");
              if (i < arr.length) arr[i] = targetChar;
              return arr.join("");
            });
            return;
          }
          const g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          setDisplay((prev) => {
            const arr = prev.split("");
            if (i < arr.length) arr[i] = g;
            return arr.join("");
          });
        }, tickMs);
        timers.current.push(iv);
      }, Math.round(i * staggerDuration * 1000));
      timers.current.push(startId);
    });

    // safety: guarantee we land back on the true label
    const endId = window.setTimeout(
      () => setDisplay(label),
      Math.round(chars.length * staggerDuration * 1000) + 700
    );
    timers.current.push(endId);
  }, [label, staggerDuration, transition.duration]);

  return (
    <span
      className={cn("inline-block", className)}
      onMouseEnter={scramble}
      onFocus={scramble}
      aria-label={label}
    >
      {display}
    </span>
  );
}

export default RandomLetterSwap;
