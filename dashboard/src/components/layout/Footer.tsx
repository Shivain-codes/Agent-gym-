import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-bg)] py-12 text-[var(--color-soft-ink)]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
        <div className="col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--color-amber)]"></div>
            <span className="font-display text-lg font-bold text-[var(--color-ink)]">AgentGym</span>
          </div>
          <p className="text-xs leading-relaxed">
            The black box for coding agents. Mission control for AI trajectories.
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
            <li><a href="#" className="hover:text-[var(--color-amber)]">Nebius Token Factory</a></li>
            <li><a href="#" className="hover:text-[var(--color-amber)]">Nemotron-435B</a></li>
            <li><a href="#" className="hover:text-[var(--color-amber)]">JSONL Format</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">Legal</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#" className="hover:text-[var(--color-amber)]">MIT License</a></li>
            <li><a href="#" className="hover:text-[var(--color-amber)]">Privacy Policy</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 border-t border-[var(--color-hairline)] px-6 pt-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-tighter">
          © 2026 AGENTGYM // MISSION CONTROL // ALL SYSTEMS NOMINAL
        </p>
      </div>
    </footer>
  );
};
