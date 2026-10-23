import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CardSpotlightProps {
  children: React.ReactNode;
  className?: string;
  /** Spotlight radius in px */
  radius?: number;
  /** Spotlight color — keep faint */
  color?: string;
}

/**
 * Aceternity CardSpotlight pattern: a radial highlight follows the cursor
 * across the card. Tuned whisper-quiet for the premium bar — a hint of
 * light, not a flashlight.
 */
export function CardSpotlight({
  children,
  className,
  radius = 320,
  color = 'rgba(163, 230, 53, 0.06)',
}: CardSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -radius, y: -radius });
  const [active, setActive] = useState(false);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn('relative overflow-hidden', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
