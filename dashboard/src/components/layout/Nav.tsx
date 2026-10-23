import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

const easeOut = {
  type: 'tween',
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1],
} as const;

const LINKS = ['Leaderboard', 'Replay', 'Tasks', 'Battle'];

export const Nav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={easeOut}
      className="sticky top-0 z-50 w-full border-b border-[var(--color-hairline)] bg-[var(--color-bg)]/85 backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center h-16 px-6">
        <Link to="/" className="justify-self-start">
          <span className="font-display text-lg font-semibold tracking-tighter text-[var(--color-ink)]">
            AgentGym<span className="text-[var(--color-amber)]">.</span>
          </span>
        </Link>

        {/* Desktop: centered links */}
        <div className="hidden items-center gap-8 md:flex justify-self-center">
          {LINKS.map((item) => {
            const href = `/${item.toLowerCase()}`;
            const active = pathname === href || (item === 'Replay' && pathname.startsWith('/replay'));
            return (
              <Link
                key={item}
                to={href}
                className={cn(
                  'font-mono text-[13px] transition-colors',
                  active ? 'text-[var(--color-ink)]' : 'text-[var(--color-body)] hover:text-[var(--color-ink)]'
                )}
              >
                {item}
              </Link>
            );
          })}
        </div>

        <div className="justify-self-end">
          <a
            href="https://github.com/Shivain-codes/Agent-gym-"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center font-mono text-xs text-[var(--color-body)] transition-colors hover:text-[var(--color-amber)]"
          >
            GitHub ↗
          </a>
        </div>
      </div>

      {/*
        Mobile: web.dev overflow pattern — keep the 4 links visible and
        swipeable instead of hiding them behind a hamburger. Only 4 items,
        so they fit; scroll only on the narrowest screens.
      */}
      <div className="md:hidden border-t border-[var(--color-hairline)]">
        <div className="flex gap-7 overflow-x-auto px-6 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((item) => {
            const href = `/${item.toLowerCase()}`;
            const active = pathname === href || (item === 'Replay' && pathname.startsWith('/replay'));
            return (
              <Link
                key={item}
                to={href}
                className={cn(
                  'shrink-0 font-mono text-[13px] py-2 transition-colors',
                  active
                    ? 'text-[var(--color-amber)]'
                    : 'text-[var(--color-body)] hover:text-[var(--color-ink)]'
                )}
              >
                {item}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};
