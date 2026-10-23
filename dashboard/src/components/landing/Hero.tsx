import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../../api';
import { HeroTerminal } from './HeroTerminal';
import { NumberTicker } from '../ui/number-ticker';
import { ShineBorder } from '../ui/shine-border';

const easeOut = {
  type: 'tween',
  duration: 0.8,
  ease: [0.22, 1, 0.36, 1],
} as const;

/** Whisper-quiet dot grid — Magic UI DotPattern, tuned to near-invisible. */
const DotGrid: React.FC = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0"
    style={{
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
      maskImage: 'radial-gradient(ellipse 90% 70% at 30% 20%, black 30%, transparent 75%)',
      WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 30% 20%, black 30%, transparent 75%)',
    }}
  />
);

export const Hero: React.FC = () => {
  const [stats, setStats] = useState<{ episodes: number; models: number; avgJudge: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.episodes(), api.leaderboard()])
      .then(([episodes, board]) => {
        const avgJudge =
          board.reduce((acc, r) => acc + (r.avg_judge_score ?? 0), 0) / Math.max(1, board.length);
        setStats({
          episodes: episodes.length,
          models: new Set(episodes.map((e) => e.model)).size,
          avgJudge,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative overflow-hidden px-6 md:px-12 pt-20 md:pt-28 pb-24">
      <DotGrid />
      <div className="relative mx-auto max-w-7xl">
        {/* Kicker */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 0.05 }}
          className="font-mono text-[11px] uppercase tracking-[0.35em] text-[var(--color-micro)]"
        >
          <span className="mr-3 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-amber)] align-middle" />
          Training gym for coding agents
        </motion.p>

        {/* Headline — editorial, left-aligned, all white */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 0.14 }}
          className="mt-8 max-w-4xl font-display font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(52px, 7vw, 104px)' }}
        >
          Watch AI
          <br />
          learn to code.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 0.26 }}
          className="mt-8 max-w-xl text-[17px] leading-[1.7] text-[var(--color-body)]"
        >
          A broken repo goes into the sandbox. A scored, replayable trajectory
          comes out — every step recorded, judged, and exportable as open data.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 0.36 }}
          className="mt-10 flex flex-wrap items-center gap-7"
        >
          <button
            onClick={() => navigate('/replay')}
            className="group inline-flex items-center gap-2.5 bg-[var(--color-ink)] px-6 py-3.5 font-mono text-[13px] font-bold text-black transition-all duration-300 hover:bg-[var(--color-amber)]"
          >
            Watch a trajectory
            <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            className="font-mono text-[13px] text-[var(--color-body)] underline underline-offset-[6px] decoration-[var(--color-border)] transition-colors hover:text-[var(--color-ink)] hover:decoration-[var(--color-amber)]"
          >
            See the leaderboard
          </button>
        </motion.div>

        {/* Stats — number tickers, real data */}
        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="mt-16 flex flex-wrap gap-x-14 gap-y-6 border-t border-[var(--color-hairline)] pt-8"
          >
            <div>
              <p className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">
                <NumberTicker value={stats.episodes} />
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-micro)]">
                Episodes recorded
              </p>
            </div>
            <div>
              <p className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">
                <NumberTicker value={stats.models} />
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-micro)]">
                Models on the board
              </p>
            </div>
            <div>
              <p className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">
                <NumberTicker value={stats.avgJudge} decimalPlaces={2} />
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-micro)]">
                Avg judge score
              </p>
            </div>
          </motion.div>
        )}

        {/* Terminal — the signature moment, subtle shine */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 0.5 }}
          className="mx-auto mt-20 max-w-4xl"
        >
          <ShineBorder shineColor="rgba(163, 230, 53, 0.28)" duration={16}>
            <HeroTerminal />
          </ShineBorder>
          <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-micro)]">
            Real trajectory — not a mockup
          </p>
        </motion.div>
      </div>
    </section>
  );
};
