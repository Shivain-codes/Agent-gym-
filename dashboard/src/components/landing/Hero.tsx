import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { api } from '../../api';
import { MiniReplay } from './MiniReplay';
import { Trophy, FlaskConical } from 'lucide-react';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
};

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Draw telemetry dashes
    // We'll generate deterministic pseudo-random dashes based on position
    const dashCount = 300;
    const now = prefersReducedMotion ? 0 : Date.now() * 0.00015; // Very slow drift

    for (let i = 0; i < dashCount; i++) {
      // Deterministic pseudo-random based on index
      const seed = i * 12345 + 67890;
      const seededRandom = (s: number) => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };

      // Position - denser in right third
      const randX = seededRandom(seed);
      const randY = seededRandom(seed + 1);
      const randH = seededRandom(seed + 2);
      const randColor = seededRandom(seed + 3);

      // Bias toward right third
      const xBias = randX < 0.6 ? randX * 0.5 : 0.5 + (randX - 0.6) * 1.25;
      const x = xBias * width;

      // Vertical position with slow drift
      const y = (randY * height + now * 50) % (height + 100) - 50;

      // Height: 8-64px
      const h = 8 + randH * 56;

      // 2px wide
      const w = 2;

      // Color: ~8% in #76B900 at 40% opacity, rest #E4E4E7
      const isAccent = randColor < 0.08;
      ctx.fillStyle = isAccent ? 'rgba(118, 185, 0, 0.4)' : 'rgba(228, 228, 231, 0.6)';
      ctx.fillRect(x, y, w, h);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => draw();
    window.addEventListener('resize', resize);
    draw();

    if (!prefersReducedMotion) {
      const animate = () => {
        draw();
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
  }, [draw, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
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
        <nav className="mb-[96px] h-18 flex items-center justify-between border-b border-[var(--color-hairline)]">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl font-bold tracking-tighter text-[var(--color-ink)]">AgentGym</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {['Leaderboard', 'Replay', 'Tasks'].map((item) => (
              <a
                key={item}
                href={`/${item.toLowerCase()}`}
                className="relative text-sm font-medium text-[var(--color-soft-ink)] transition-colors hover:text-[var(--color-amber)]"
              >
                {item}
              </a>
            ))}
            <a
              href="https://github.com"
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
                  <StatItem value={stats.episodes} label="episodes" />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <StatItem value={stats.models} label="models" />
                  <div className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-ink)] font-bold">
                      {stats.judgeArr.join(' / ')}
                    </span>
                    <span>judge</span>
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
                    <span className="text-[var(--color-micro)]">judge</span>
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
                  Judge: {stats?.judge ?? (
                    <span className="h-4 w-24 bg-[var(--color-muted-fill)] animate-pulse rounded-inline" />
                  )} / 10
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

// TelemetryTicker component (copied and adjusted for hero fold pin)
const TelemetryTicker: React.FC = () => {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);

  useEffect(() => {
    api.episodes().then(setEpisodes);
  }, []);

  if (episodes.length === 0) return null;

  return (
    <div className="relative overflow-hidden border-t border-[var(--color-hairline)] bg-[var(--color-panel)] py-1">
      {/* Scanline Overlay Effect */}
      <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.03] bg-[linear-gradient(to bottom,transparent_50%,var(--color-ink)_50%)] bg-[length:100%_4px] animate-scanline" />

      <div className="flex whitespace-nowrap animate-marquee">
        {[...episodes, ...episodes].map((ep, i) => (
          <div key={i} className="mx-12 flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.02, filter: 'brightness(1.2)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-center gap-2 cursor-default px-2 py-1 rounded-sm transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-soft-ink)] opacity-60">ID</span>
              <span className="text-sm font-mono font-medium text-[var(--color-ink)]">[{ep.episode_id}]</span>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, filter: 'brightness(1.2)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-center gap-2 cursor-default px-2 py-1 rounded-sm transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-soft-ink)] opacity-60">MODEL</span>
              <span className="text-sm font-mono font-medium text-[var(--color-ink)]">{ep.model}</span>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, filter: 'brightness(1.2)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-center gap-2 cursor-default px-2 py-1 rounded-sm transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-soft-ink)] opacity-60">STATUS</span>
              <span className={`text-sm font-mono font-medium ${ep.passed ? 'text-[var(--color-pass)]' : 'text-[var(--color-fail)]'}`}>
                {ep.passed ? '● PASSED' : '● FAILED'}
              </span>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, filter: 'brightness(1.2)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-center gap-2 cursor-default px-2 py-1 rounded-sm transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-soft-ink)] opacity-60">REWARD</span>
              <span className="text-sm font-mono font-medium text-[var(--color-ink)]">{ep.final_reward.toFixed(2)}</span>
            </motion.div>
            <div className="text-[var(--color-hairline)]">|</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Type import for TelemetryTicker
interface EpisodeSummary {
  episode_id: string;
  model: string;
  passed: boolean;
  final_reward: number;
  num_steps: number;
  judge_score: number | null;
  task_id: string;
  status: string;
  is_fixture: boolean;
}