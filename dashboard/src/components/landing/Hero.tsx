import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { api } from '../../api';
import { MiniReplay } from './MiniReplay';
import { TelemetryTicker } from './TelemetryTicker';
import { Trophy, FlaskConical } from 'lucide-react';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
} as const

// Telemetry Rain Canvas Component
interface TelemetryRainProps {
  className?: string;
}

const TelemetryRain: React.FC<TelemetryRainProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Size the canvas backing store only on mount/resize — never per frame.
  // (Resetting canvas.width every rAF reallocates the bitmap and can tear.)
  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Draw telemetry dashes
    // We'll generate deterministic pseudo-random dashes based on position
    const dashCount = 300;
    const now = prefersReducedMotion ? 0 : Date.now() * 0.00015; // Very slow drift

    for (let i = 0; i < dashCount; i++) {
      // Deterministic hash-based pseudo-random (decorrelated across
      // consecutive i — a naive LCG step marches in lockstep and draws
      // diagonal streaks instead of scattered rain).
      const rand = (s: number) => {
        const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
      };

      // Position - denser in the right third (empty space beside the headline)
      const randX = rand(i * 4);
      const randY = rand(i * 4 + 1);
      const randH = rand(i * 4 + 2);
      const randColor = rand(i * 4 + 3);

      // Bias toward right third: 60% of dashes land in x ∈ [0.67, 1.0]
      const xBias = randX < 0.6 ? 0.67 + randX * 0.55 : (randX - 0.6) * 1.675;
      const x = xBias * width;

      // Vertical position with slow drift
      const y = (randY * height + now * 50) % (height + 100) - 50;

      // Height: 8-64px
      const h = 8 + randH * 56;

      // 2px wide
      const w = 2;

      // Color: ~8% in #76B900 at 50% opacity, rest zinc-300
      const isAccent = randColor < 0.08;
      ctx.fillStyle = isAccent ? 'rgba(118, 185, 0, 0.5)' : 'rgba(212, 212, 216, 0.85)';
      ctx.fillRect(x, y, w, h);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      drawFrame(ctx, canvas);
    };
    window.addEventListener('resize', resize);
    resize();

    if (!prefersReducedMotion) {
      const animate = () => {
        drawFrame(ctx, canvas);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawFrame, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      // NOTE: canvas is a replaced element — inset-0 alone does NOT stretch it
      // (it keeps its 300x150 intrinsic size). h-full w-full is required.
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
};

// Skeleton shimmer for loading stats
const StatSkeleton: React.FC = () => (
  <div className="flex items-center gap-1.5">
    <div className="h-4 w-12 bg-[var(--color-muted-fill)] animate-pulse rounded" />
    <span className="text-[var(--color-micro)]">episodes</span>
  </div>
);

const StatItem: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[var(--color-ink)] font-bold font-mono">{value}</span>
    <span className="text-[var(--color-micro)]">{label}</span>
  </div>
);

export const Hero: React.FC = () => {
  const [stats, setStats] = useState<{ episodes: number; models: number; judge: string; judgeArr: string[] } | null>(null);

  useEffect(() => {
    Promise.all([api.episodes(), api.leaderboard()]).then(([episodes, leaderboard]) => {
      const models = new Set(episodes.map(e => e.model)).size;
      const avgJudge = leaderboard.reduce((acc, row) => acc + (row.avg_judge_score ?? 0), 0) / leaderboard.length;
      const judgeScores = leaderboard.map(row => row.avg_judge_score?.toFixed(2) ?? '0').slice(0, 3);

      setStats({
        episodes: episodes.length,
        models: models,
        judge: avgJudge.toFixed(2),
        judgeArr: judgeScores,
      });
    });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: blackBoxSpring,
    },
  };

  return (
    <section className="relative min-h-screen overflow-hidden px-6 pt-32 pb-0 md:px-12 md:pt-48">
      {/* L1 — White + dot-grid with edge-fade mask (z-0) */}
      <div
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #d4d4d8 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%)',
        }}
      />

      {/* L2 — TELEMETRY CANVAS: data waterfall (z-10) */}
      <TelemetryRain className="z-10" />

      {/* L3 — Two radial glows (z-20) */}
      <div className="absolute top-1/4 left-1/2 z-20 h-[600px] w-[600px] bg-[var(--color-amber)]/12 blur-[150px] rounded-full opacity-80 translate-x-[-50%] translate-y-[-50%]" />
      <div className="absolute top-[58%] left-1/2 z-20 h-[800px] w-[800px] bg-[var(--color-amber)]/5 blur-[200px] rounded-full opacity-50 translate-x-[-50%] translate-y-[-50%]" />

      {/* L4 — Content (z-30) */}
      <div className="relative z-30 mx-auto max-w-7xl">
        {/* NAV — 72px: wordmark left, links center, black pill GitHub right */}
        <nav className="mb-[96px] h-18 grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--color-hairline)]">
          <div className="flex items-center gap-3 justify-self-start">
            <span className="font-display text-xl font-bold tracking-tighter text-[var(--color-ink)]">AgentGym</span>
          </div>
          <div className="hidden items-center gap-8 md:flex justify-self-center">
            {['Leaderboard', 'Replay', 'Tasks'].map((item) => (
              <a
                key={item}
                href={`/${item.toLowerCase()}`}
                className="relative text-sm font-medium text-[var(--color-soft-ink)] transition-colors hover:text-[var(--color-amber)]"
              >
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center justify-self-end">
            <a
              href="https://github.com/Shivain-codes/Agent-gym-"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm bg-black px-4 py-1.5 text-xs font-mono text-white transition-all hover:bg-zinc-800 active:scale-95"
            >
              GITHUB
            </a>
          </div>
        </nav>

        {/* TEXT STACK — centered, top 40% */}
        <div className="text-center">
          {/* Eyebrow */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-6 flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-widest text-zinc-500"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber)]" />
            TRAINING GYM FOR CODING AGENTS
          </motion.div>

          {/* H1 — Exactly 2 lines */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 font-display font-bold leading-[1.0] tracking-tight text-[var(--color-ink)] max-w-[900px] mx-auto"
            style={{
              fontSize: 'clamp(56px, 7vw, 96px)',
            }}
          >
            Watch AI <span className="text-[#65A30D] relative inline-block">learn</span>{' '}
            <br />
            to code.
          </motion.h1>

          {/* Sub row */}
          <motion.div
            variants={itemVariants}
            className="mb-8 flex items-center justify-center gap-3 text-[18px] text-zinc-600 leading-relaxed max-w-xl mx-auto"
          >
            <p>Broken repo <span className="text-[var(--color-amber)] font-mono">→</span> sandbox <span className="text-[var(--color-amber)] font-mono">→</span> scored trajectory.</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-[10px] font-mono uppercase tracking-tight">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber)]" />
              NVIDIA Hackathon
            </span>
          </motion.div>

          {/* CTA + Proof line */}
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-fit rounded-full bg-black px-8 py-4 text-xs font-mono font-bold text-white hover:bg-zinc-800 transition-all shadow-sm"
            >
              Explore the gym
            </motion.button>

            <div className="flex items-center justify-center gap-6 font-mono text-[13px] text-zinc-500">
              {stats ? (
                <>
                  <StatItem value={stats.episodes} label={stats.episodes === 1 ? "episode" : "episodes"} />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <StatItem value={stats.models} label={stats.models === 1 ? "model" : "models"} />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-ink)] font-bold">
                      {stats.judgeArr.join(' / ')}
                    </span>
                    <span>avg judge</span>
                  </div>
                </>
              ) : (
                <>
                  <StatSkeleton />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <StatSkeleton />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-24 bg-[var(--color-muted-fill)] animate-pulse rounded" />
                    <span className="text-[var(--color-micro)]">avg judge</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* PRODUCT STAGE — 64px below proof line */}
        <div className="relative mt-16 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...blackBoxSpring, delay: 0.5 }}
            className="relative w-full max-w-[1080px] translate-y-[64px]"
          >
            {/* Green glow halo spilling ~30% beyond edges */}
            <div className="absolute inset-0 -z-10 rounded-[24px] bg-[var(--color-amber)]/10 blur-[80px] opacity-60 scale-130" />

            {/* Dark replay viewer panel */}
            <div className="relative z-10 rounded-2xl border border-white/10 bg-[var(--color-ink)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
              <MiniReplay />
            </div>

            {/* Floating Telemetry Card 1 - overlapping left edge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute -left-6 top-1/4 z-20 p-4 rounded-2xl border border-[var(--color-border)] bg-white/95 backdrop-blur shadow-xl flex items-center gap-4 max-w-[220px]"
            >
              <div className="p-2 rounded-lg bg-[var(--color-amber)]/10 text-[var(--color-amber)]">
                <Trophy size={20} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-[var(--color-micro)]">Performance</span>
                <span className="text-sm font-display font-bold text-[var(--color-ink)]">
                  {stats ? `Judge: ${stats.judge} / 10` : (
                    <span className="inline-block h-4 w-28 bg-[var(--color-muted-fill)] animate-pulse rounded" />
                  )}
                </span>
              </div>
            </motion.div>

            {/* Floating Telemetry Card 2 - overlapping right edge */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
              className="absolute -right-6 top-1/3 z-20 p-4 rounded-2xl border border-[var(--color-border)] bg-white/95 backdrop-blur shadow-xl flex items-center gap-4 max-w-[220px]"
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <FlaskConical size={20} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-[var(--color-micro)]">Efficiency</span>
                <span className="text-sm font-display font-bold text-[var(--color-ink)]">Avg Steps: 5.4</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* FOLD PIN — Episode ticker strip at very bottom with hairline top border */}
        <div className="relative mt-8 border-t border-[var(--color-hairline)]">
          <TelemetryTicker />
        </div>
      </div>
    </section>
  );
};