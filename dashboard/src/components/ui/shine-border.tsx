import React from 'react';
import { cn } from '@/lib/utils';

interface ShineBorderProps {
  children: React.ReactNode;
  className?: string;
  /** Border shine color — keep whisper-quiet */
  shineColor?: string;
  duration?: number;
  borderWidth?: number;
}

/**
 * Aceternity-style shine border, tuned down for the premium bar:
 * a faint light sweep around the border, not a neon glow.
 */
export function ShineBorder({
  children,
  className,
  shineColor = 'rgba(163, 230, 53, 0.35)',
  duration = 14,
  borderWidth = 1,
}: ShineBorderProps) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ padding: borderWidth, borderRadius: 8 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-100%] animate-[shine-spin_var(--shine-duration)_linear_infinite]"
        style={
          {
            '--shine-duration': `${duration}s`,
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 300deg, ${shineColor} 330deg, transparent 360deg)`,
          } as React.CSSProperties
        }
      />
      <div className="relative h-full w-full overflow-hidden rounded-[7px] bg-[var(--color-bg)]">
        {children}
      </div>
      <style>{`@keyframes shine-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
