import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
} as const

export const Nav: React.FC = () => {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={blackBoxSpring}
      className="sticky top-0 z-50 w-full border-b border-[var(--color-hairline)] bg-[var(--color-bg)] px-6 py-4"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center h-18">
        {/* Wordmark left */}
        <Link to="/" className="flex items-center gap-3 group justify-self-start">
          <span className="font-display text-xl font-bold tracking-tighter text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-amber)]">
            AgentGym
          </span>
        </Link>

        {/* Links center */}
        <div className="hidden items-center gap-8 md:flex justify-self-center">
          {['Leaderboard', 'Replay', 'Tasks'].map((item) => (
            <Link
              key={item}
              to={`/${item.toLowerCase()}`}
              className="relative text-sm font-medium text-[var(--color-soft-ink)] transition-colors hover:text-[var(--color-amber)] group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[var(--color-amber)] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        {/* Black pill GitHub right */}
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
      </div>
    </motion.nav>
  );
};
