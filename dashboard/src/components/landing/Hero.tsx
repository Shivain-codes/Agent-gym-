import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { MiniReplay } from './MiniReplay';
import { TelemetryTicker } from './TelemetryTicker';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
} as const

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
  const navigate = useNavigate();

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

  const scrollToFresh = () => {
    document.getElementById('fresh')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative overflow-hidden px-6 pt-6 pb-16 md:px-12 md:pt-8">
      {/* Editorial index numeral — faint, oversized */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-2 select-none font-display text-[22rem] font-bold leading-none text-[var(--color-ink)]/[0.035]"
      >
        01
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* NAV — 72px: wordmark left, links center, black pill GitHub right */}
        <nav className="h-18 grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--color-hairline)]">
          <div className="flex items-center gap-3 justify-self-start">
            <span className="font-display text-xl font-bold tracking-tighter text-[var(--color-ink)]">AgentGym</span>
          </div>
          <div className="hidden items-center gap-8 md:flex justify-self-center">
            {['Leaderboard', 'Replay', 'Tasks', 'Battle'].map((item) => (
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

        {/* HERO — asymmetric editorial grid: words left, product right */}
        <div className="mt-14 md:mt-20 grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* Left — headline block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...blackBoxSpring, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="mb-7 flex flex-wrap items-center gap-3 font-mono text-[12px] uppercase tracking-widest text-zinc-500">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber)]" />
                Training gym for coding agents
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-[10px] tracking-tight">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber)]" />
                NVIDIA Hackathon
              </span>
            </div>

            <h1
              className="font-display font-bold leading-[1.02] tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: 'clamp(48px, 5.2vw, 80px)' }}
            >
              Watch AI <span className="text-[#65A30D]">learn</span>
              <br />
              to code.<sup className="ml-1 align-super font-mono text-[0.35em] font-normal text-[var(--color-micro)]">1</sup>
            </h1>

            <p className="mt-6 font-mono text-[15px] leading-relaxed text-zinc-600">
              Broken repo <span className="text-[var(--color-amber)]">→</span> sandbox{' '}
              <span className="text-[var(--color-amber)]">→</span> scored trajectory.
            </p>
            <p className="mt-3 max-w-sm font-mono text-[11px] leading-relaxed text-[var(--color-micro)]">
              <sup className="mr-1">1</sup>Every step logged. Every run replayable. Nothing hidden.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={scrollToFresh}
                className="rounded-full bg-black px-8 py-4 text-xs font-mono font-bold text-white hover:bg-zinc-800 transition-all shadow-sm cursor-pointer"
              >
                Explore the gym
              </motion.button>
              <button
                onClick={() => navigate('/replay')}
                className="group font-mono text-xs text-[var(--color-soft-ink)] hover:text-[var(--color-amber)] transition-colors"
              >
                Watch a replay{' '}
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>

            <div className="mt-10 flex items-center gap-6 border-t border-[var(--color-hairline)] pt-6 font-mono text-[13px] text-zinc-500">
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

          {/* Right — the product is the visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...blackBoxSpring, delay: 0.25 }}
            className="lg:col-span-7"
          >
            <div className="relative">
              {/* Single soft glow behind the panel */}
              <div className="absolute -inset-8 rounded-[32px] bg-[var(--color-amber)]/10 blur-[90px] opacity-70 pointer-events-none" />
              <div className="relative rounded-2xl border border-white/10 bg-[var(--color-ink)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                <MiniReplay />
              </div>
            </div>
            <p className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-micro)]">
              <span>Fig. 01 — Live trajectory replay</span>
              <span className="hidden sm:inline">golden-easy-03-nano</span>
            </p>
          </motion.div>
        </div>

        {/* FOLD PIN — Episode ticker strip with hairline top border */}
        <div className="mt-14 border-t border-[var(--color-hairline)]">
          <TelemetryTicker />
        </div>
      </div>
    </section>
  );
};
