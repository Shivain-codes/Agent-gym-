import React, { useEffect, useState } from 'react';
import { api, type EpisodeSummary } from '../../api';
import { motion } from 'motion/react';

export const TelemetryTicker: React.FC = () => {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);

  useEffect(() => {
    api.episodes().then(setEpisodes);
  }, []);

  if (episodes.length === 0) return null;

  return (
    <div className="relative overflow-hidden border-y border-[var(--color-hairline)] bg-[var(--color-panel)] py-1">
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
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
          display: flex;
          width: max-content;
        }
        .animate-scanline {
          animation: scanline 10s linear infinite;
        }
      `}</style>
    </div>
  );
};
