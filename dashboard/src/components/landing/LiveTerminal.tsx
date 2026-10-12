import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type EpisodeOut } from '../../api';
import { cn } from '../../lib/utils';

type Phase = 'thought' | 'action' | 'observation' | 'verdict';

const TYPE_MS = 14; // per character
const PAUSE_ACTION_MS = 900;
const PAUSE_OBS_MS = 1400;

export const LiveTerminal: React.FC = () => {
  const [episode, setEpisode] = useState<EpisodeOut | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('thought');
  const [typed, setTyped] = useState('');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const charRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Load a real fixture episode
  useEffect(() => {
    api.fixtures()
      .then((fixs) => {
        const id = fixs[0]?.episode_id;
        if (id) return api.episode(id);
        return api.episodes().then((eps) => api.episode(eps[0].episode_id));
      })
      .then(setEpisode)
      .catch(() => {});
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms / speed));
  };

  const steps = episode?.steps ?? [];
  const step = steps[stepIdx];
  const isLastStep = stepIdx === steps.length - 1;

  // Typewriter + phase machine (pauses off-screen to keep scroll smooth)
  useEffect(() => {
    if (!step || !playing || !visible || phase === 'verdict') return;
    clearTimers();

    if (reducedMotion) {
      charRef.current = step.thought.length;
      setTyped(step.thought);
      setPhase('observation');
      later(() => {
        if (isLastStep) setPhase('verdict');
        else {
          charRef.current = 0;
          setStepIdx((i) => i + 1);
          setPhase('thought');
          setTyped('');
        }
      }, 1200);
      return;
    }

    setPhase('thought');
    const tick = () => {
      charRef.current += 1;
      setTyped(step.thought.slice(0, charRef.current));
      if (charRef.current < step.thought.length) {
        timers.current.push(setTimeout(tick, TYPE_MS / speed));
      } else {
        later(() => setPhase('action'), 250);
        later(() => setPhase('observation'), 250 + PAUSE_ACTION_MS);
        later(() => {
          if (isLastStep) setPhase('verdict');
          else {
            charRef.current = 0;
            setStepIdx((i) => i + 1);
            setPhase('thought');
            setTyped('');
          }
        }, 250 + PAUSE_ACTION_MS + PAUSE_OBS_MS);
      }
    };
    timers.current.push(setTimeout(tick, TYPE_MS / speed));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, playing, speed, visible, episode, reducedMotion]);

  const jumpTo = useCallback((i: number) => {
    if (!episode) return;
    clearTimers();
    charRef.current = 0;
    setStepIdx(Math.max(0, Math.min(i, steps.length - 1)));
    setPhase('thought');
    setTyped('');
    setPlaying(true);
  }, [episode, steps.length]);

  const restart = () => jumpTo(0);

  // Keyboard: space = play/pause, arrows = step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === 'ArrowRight') jumpTo(stepIdx + 1);
      if (e.key === 'ArrowLeft') jumpTo(stepIdx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIdx, jumpTo]);

  if (!episode) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8">
        <div className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-muted-fill)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted-fill)]" />
          <div className="h-24 animate-pulse rounded bg-[var(--color-muted-fill)]" />
        </div>
      </div>
    );
  }

  const progress = steps.length > 0 ? ((stepIdx + (phase === 'verdict' ? 1 : 0)) / steps.length) * 100 : 0;

  return (
    <div ref={rootRef} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#0C0C0F] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-micro)]">
            Live replay
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-[var(--color-micro)]">
          {episode.episode_id} · <span className="capitalize text-[var(--color-soft-ink)]">{episode.model}</span>
        </span>
      </div>

      {/* Terminal body */}
      <div className="min-h-[300px] p-5 font-mono text-[13px] leading-relaxed md:min-h-[340px]">
        <div className="mb-4 text-[var(--color-micro)]">
          <span className="text-[var(--color-amber)]">$</span> agentgym replay --episode {episode.episode_id}
        </div>

        <AnimatePresence mode="wait">
          {phase === 'verdict' ? (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-bold tracking-widest",
                episode.passed ? "bg-[var(--color-amber)]/15 text-[var(--color-accent-ink)]" : "bg-red-500/15 text-[var(--color-fail)]"
              )}>
                {episode.passed ? '✓ TASK SOLVED' : '✗ TASK FAILED'}
              </div>
              <div className="text-[var(--color-soft-ink)]">
                Judge score: <span className="font-bold text-[var(--color-amber)]">{episode.judge_score?.toFixed(1) ?? '—'}/10</span>
                <span className="text-[var(--color-micro)]"> · {steps.length} steps · reward {episode.final_reward.toFixed(2)}</span>
              </div>
              {episode.judge_reasoning && (
                <p className="max-w-xl text-[12px] italic leading-relaxed text-[var(--color-micro)]">
                  "{episode.judge_reasoning.slice(0, 220)}{episode.judge_reasoning.length > 220 ? '…' : ''}"
                </p>
              )}
              <button
                onClick={restart}
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-soft-ink)] transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
              >
                <RotateCcw size={12} /> Replay trajectory
              </button>
            </motion.div>
          ) : step ? (
            <motion.div key={stepIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[var(--color-micro)]">
                <span>Step {step.step}/{steps.length}</span>
                <span className={cn(
                  "rounded-sm px-2 py-0.5",
                  phase === 'thought' && "bg-white/5 text-[var(--color-soft-ink)]",
                  phase === 'action' && "bg-[var(--color-amber)]/15 text-[var(--color-accent-ink)]",
                  phase === 'observation' && "bg-white/5 text-[var(--color-micro)]",
                )}>
                  {phase === 'thought' ? '◌ thinking' : phase === 'action' ? '● acting' : '✓ observed'}
                </span>
              </div>

              {/* Thought — typewriter */}
              <p className="min-h-[3.5rem] text-[var(--color-soft-ink)]">
                <span className="text-[var(--color-micro)]">&gt; </span>
                {typed}
                {phase === 'thought' && <span className="ml-0.5 inline-block h-[14px] w-[7px] animate-pulse bg-[var(--color-amber)]" />}
              </p>

              {/* Action */}
              {(phase === 'action' || phase === 'observation') && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-sm border border-[var(--color-border)] bg-white/[0.02] p-3">
                  <span className="text-[var(--color-amber)]">$ </span>
                  <span className="text-[var(--color-ink)]">{String(step.action?.type ?? 'action')}</span>
                  <span className="text-[var(--color-micro)]"> {JSON.stringify(step.action)?.slice(0, 90)}</span>
                </motion.div>
              )}

              {/* Observation */}
              {phase === 'observation' && step.observation && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] text-[var(--color-micro)]">
                  <span className="text-[var(--color-pass)]">← </span>
                  {step.observation.slice(0, 160)}{step.observation.length > 160 ? '…' : ''}
                  <span className="ml-3 text-[var(--color-amber)]">+{step.reward.toFixed(2)}</span>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Scrubber */}
      <div className="border-t border-[var(--color-border)] px-5 py-4">
        <div
          className="group relative h-6 cursor-pointer"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            jumpTo(Math.floor(((e.clientX - r.left) / r.width) * steps.length));
          }}
        >
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[var(--color-amber)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="absolute top-1/2 flex w-full -translate-y-1/2 justify-between">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); jumpTo(i); }}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border transition-all",
                  i <= stepIdx
                    ? "border-[var(--color-amber)] bg-[var(--color-amber)]"
                    : "border-white/20 bg-transparent group-hover:border-white/40"
                )}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-amber)] text-black transition-transform hover:scale-105 active:scale-95"
            >
              {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button
              onClick={() => jumpTo(stepIdx - 1)}
              aria-label="Previous step"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-soft-ink)] transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => jumpTo(stepIdx + 1)}
              aria-label="Next step"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-soft-ink)] transition-colors hover:border-[var(--color-amber)] hover:text-[var(--color-amber)]"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-micro)]">
            <span className="hidden sm:inline">space ⏯ · ←/→ step</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-sm px-2 py-1 transition-colors",
                  speed === s ? "bg-[var(--color-amber)]/20 text-[var(--color-accent-ink)]" : "hover:text-[var(--color-soft-ink)]"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
