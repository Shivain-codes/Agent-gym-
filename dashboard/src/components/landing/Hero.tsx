import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { LiveTerminal } from './LiveTerminal';
import { TelemetryTicker } from './TelemetryTicker';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
} as const

const lineVariants = {
  hidden: { y: '110%' },
  visible: (i: number) => ({
    y: '0%',
    transition: { ...blackBoxSpring, delay: 0.15 + i * 0.12 },
  }),
};

export const Hero: React.FC = () => {
  const [stats, setStats] = useState<{ episodes: number; models: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.episodes(), api.leaderboard()]).then(([episodes]) => {
      setStats({
        episodes: episodes.length,
        models: new Set(episodes.map(e => e.model)).size,
      });
    });
  }, []);

  return (
    <section className="relative overflow-hidden px-6 pt-6 md:px-12 md:pt-8">
      {/* Single ambient glow — the only decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(118,185,0,0.35), transparent 65%)' }}
      />
      {/* Fine grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* NAV */}
        <nav className="grid h-18 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--color-hairline)]">
          <div className="justify-self-start">
            <span className="font-display text-xl font-bold tracking-tighter text-[var(--color-ink)]">
              AgentGym<span className="text-[var(--color-amber)]">.</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex justify-self-center">
            {['Leaderboard', 'Replay', 'Tasks', 'Battle'].map((item) => (
              <a
                key={item}
                href={`/${item.toLowerCase()}`}
                className="font-mono text-[13px] text-[var(--color-body)] transition-colors hover:text-[var(--color-amber)]"
              >
                {item}
              </a>
            ))}
          </div>
          <div className="justify-self-end">
            <a
              href="https://github.com/Shivain-codes/Agent-gym-"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-[var(--color-border)] px-4 py-1.5 font-mono text-xs text-[var(--color-soft-ink)] transition-all hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
            >
              GITHUB ↗
            </a>
          </div>
        </nav>

        {/* HEADLINE — kinetic, staggered line reveals */}
        <div className="mt-16 text-center md:mt-24">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mb-8 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-micro)]"
          >
            <span className="h-px w-8 bg-[var(--color-amber)]" />
            Training gym for coding agents
            <span className="h-px w-8 bg-[var(--color-amber)]" />
          </motion.div>

          <h1
            className="font-display font-bold leading-[0.95] tracking-tighter text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(52px, 9vw, 148px)' }}
          >
            {['Watch AI', 'learn to code.'].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  custom={i}
                  variants={lineVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {i === 1 ? (
                    <>learn <span className="text-[var(--color-amber)]">to code.</span></>
                  ) : (
                    line
                  )}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...blackBoxSpring, delay: 0.55 }}
            className="mx-auto mt-8 max-w-xl font-mono text-sm leading-relaxed text-[var(--color-body)]"
          >
            <span className="text-[var(--color-soft-ink)]">Broken repo</span>
            <span className="mx-2 text-[var(--color-amber)]">→</span>
            <span className="text-[var(--color-soft-ink)]">sandbox</span>
            <span className="mx-2 text-[var(--color-amber)]">→</span>
            <span className="text-[var(--color-soft-ink)]">scored trajectory</span>
            <span className="text-[var(--color-micro)]"> — every step recorded, replayable, exportable.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...blackBoxSpring, delay: 0.7 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-5"
          >
            <button
              onClick={() => navigate('/replay')}
              className="rounded-full bg-[var(--color-amber)] px-8 py-4 font-mono text-xs font-bold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Watch it happen ↓
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="font-mono text-xs text-[var(--color-body)] transition-colors hover:text-[var(--color-ink)]"
            >
              See the leaderboard <span className="text-[var(--color-amber)]">→</span>
            </button>
          </motion.div>

          {stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-micro)]"
            >
              {stats.episodes} episodes · {stats.models} model{stats.models === 1 ? '' : 's'} · live data
            </motion.div>
          )}
        </div>

        {/* THE TERMINAL — signature moment */}
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...blackBoxSpring, delay: 0.85 }}
          className="relative mx-auto mt-16 max-w-4xl md:mt-20"
        >
          <LiveTerminal />
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-micro)]">
            Real trajectory — not a mockup. Scrub it.
          </p>
        </motion.div>

        {/* Ticker */}
        <div className="mt-16 border-t border-[var(--color-hairline)]">
          <TelemetryTicker />
        </div>
      </div>
    </section>
  );
};
