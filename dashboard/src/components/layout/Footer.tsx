import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[var(--color-hairline)] py-12 text-[var(--color-body)]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
        <div className="col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--color-amber)]"></div>
            <span className="font-display text-lg font-semibold text-[var(--color-ink)]">AgentGym</span>
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-body)]">
            The proving ground for coding agents. Watch AI learn to code — every run
            recorded, scored, and replayable.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">Project</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="/leaderboard" className="hover:text-[var(--color-amber)]">Leaderboard</a></li>
            <li><a href="/replay" className="hover:text-[var(--color-amber)]">Replay Viewer</a></li>
            <li><a href="/tasks" className="hover:text-[var(--color-amber)]">Task Set</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">Data</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="https://tokenfactory.nebius.com" target="_blank" rel="noreferrer" className="hover:text-[var(--color-amber)]">Nebius Token Factory</a></li>
            <li><a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="hover:text-[var(--color-amber)]">Nemotron Nano · Super · Ultra</a></li>
            <li><a href="https://jsonlines.org" target="_blank" rel="noreferrer" className="hover:text-[var(--color-amber)]">JSONL Format</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">Legal</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="https://github.com/Shivain-codes/Agent-gym-/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-[var(--color-amber)]">MIT License</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 border-t border-[var(--color-hairline)] px-6 pt-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-tighter text-[var(--color-body)]">
          Official entry · Coding &amp; Agentic Engineering · Nebius × NVIDIA Global AI Hackathon
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-tighter text-[var(--color-micro)]">
          © 2026 AgentGym // MIT License
        </p>
      </div>
    </footer>
  );
};
