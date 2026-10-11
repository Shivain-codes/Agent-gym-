import React, { useState, useEffect } from 'react';
import { BlackBoxPanel } from '../ui/BlackBoxPanel';

const TRAJECTORY_DATA = [
  { step: 1, action: 'INIT_SESSION', status: 'SUCCESS', log: 'Loading golden fixture...' },
  { step: 2, action: 'READ_FILE', status: 'SUCCESS', log: 'main.py: line 12 read' },
  { step: 3, action: 'EXECUTE_CODE', status: 'SUCCESS', log: 'Running test_case_01...' },
  { step: 4, action: 'VALIDATE', status: 'SUCCESS', log: 'Trajectory matches target' },
  { step: 5, action: 'FINAL_SCORE', status: 'SUCCESS', log: 'Judge Score: 9.6/10' },
];

export const MiniReplay: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % TRAJECTORY_DATA.length);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const current = TRAJECTORY_DATA[step];
  const progress = ((step + 1) / TRAJECTORY_DATA.length) * 100;

  return (
    <BlackBoxPanel title="LIVE_REPLAY" technical>
      <div className="space-y-4 font-mono">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--color-soft-ink)] uppercase">
            <span>Progress</span>
            <span>Step {step + 1}/{TRAJECTORY_DATA.length}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-amber)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Log Area */}
        <div className="bg-black/20 p-2 rounded border border-white/5 min-h-[80px]">
          <div className="text-[10px] text-[var(--color-soft-ink)] mb-1 opacity-50">
            {`> ${current.action}`}
          </div>
          <div className="text-xs text-[var(--color-ink)] animate-in fade-in slide-in-from-left-1 duration-300">
            {current.log}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <span className="text-[var(--color-amber)]">STATUS:</span>
            <span className="text-[var(--color-pass)]">{current.status}</span>
          </div>
        </div>
      </div>
    </BlackBoxPanel>
  );
};
