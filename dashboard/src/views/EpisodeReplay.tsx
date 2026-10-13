import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { api, type EpisodeOut, type EpisodeSummary, type StepEvent } from "../api";
import { diffLines, diffStats, type DiffLine } from "../lib/diff";
import { actionColor, actionLabel } from "../lib/ui";
import { cn } from "../lib/utils";
import { Dropdown } from "../components/ui/Dropdown";

export default function EpisodeReplay() {
  const { episodeId } = useParams();
  if (!episodeId) return <EpisodePicker />;
  return <Replay episodeId={episodeId} />;
}

/* ------------------------------------------------------------------ picker */

function EpisodePicker() {
  const [fixtures, setFixtures] = useState<EpisodeSummary[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.fixtures(), api.episodes()])
      .then(([f, e]) => {
        setFixtures(f);
        setEpisodes(e.filter((x) => x.status === "completed"));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="text-[var(--color-fail)] font-mono">Failed to load: {error}</div>;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="px-6 py-12"
    >
      <div className="mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-amber)]">
          SYS_LOG // TRAJECTORY_ARCHIVE
        </p>
        <h1 className="mt-3 text-5xl font-display font-semibold tracking-tighter text-[var(--color-ink)]">Episode Replay</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-body)]">
          Step through an agent trajectory: every action, code diff, and sandbox
          output — the flight recorder for AI coders.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-sm bg-[var(--color-muted-fill)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {fixtures.length > 0 && (
            <>
              <h2 className="mb-4 text-sm font-mono uppercase tracking-widest text-[var(--color-amber)]">
                Golden demo episodes
              </h2>
              <div className="mb-12 grid gap-4 sm:grid-cols-3">
                {fixtures.map((f) => (
                  <EpisodeCard key={f.episode_id} ep={f} golden />
                ))}
              </div>
            </>
          )}

          <h2 className="mb-4 text-sm font-mono uppercase tracking-widest text-[var(--color-soft-ink)]">All episodes</h2>
          {episodes.length === 0 ? (
            <div className="mt-2 rounded-sm border border-dashed border-[var(--color-hairline)] p-8 text-center text-[var(--color-soft-ink)] font-mono">
              No episodes recorded yet.
            </div>
          ) : (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {episodes.map((e) => (
                <EpisodeCard key={e.episode_id} ep={e} />
              ))}
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}

function EpisodeCard({ ep, golden }: { ep: EpisodeSummary; golden?: boolean }) {
  return (
    <Link
      to={`/replay/${ep.episode_id}`}
      className={cn(
        "group rounded-sm border p-4 transition-all hover:border-[var(--color-amber)]",
        golden ? "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/5" : "border-[var(--color-hairline)] bg-[var(--color-panel)]"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            ep.passed ? "bg-[var(--color-pass)]" : "bg-[var(--color-fail)]"
          )}
        />
        <span className="font-mono text-sm text-[var(--color-ink)] group-hover:text-[var(--color-amber)] transition-colors">{ep.task_id}</span>
        <span className="capitalize text-[var(--color-soft-ink)]">· {ep.model}</span>
        {golden && (
          <span className="ml-auto rounded-sm bg-[var(--color-amber)]/15 px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-amber)]">
            golden
          </span>
        )}
      </div>
      <div className="mt-2 font-mono text-xs text-[var(--color-soft-ink)]">
        {ep.num_steps} steps · judge {ep.judge_score ?? "–"} · reward{" "}
        {ep.final_reward.toFixed(2)}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ replay */

function Replay({ episodeId }: { episodeId: string }) {
  const [ep, setEp] = useState<EpisodeOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setEp(null);
    setCursor(0);
    api.episode(episodeId).then(setEp).catch((e) => setError(String(e)));
  }, [episodeId]);

  const fileStates = useMemo(() => {
    const current: Record<string, string> = {
      ...((ep?.metadata?.original_files as Record<string, string> | undefined) ?? {}),
    };
    const out: { before: string; after: string; path: string }[] = [];

    const steps = ep?.steps ?? [];
    for (const s of steps) {
      const a = s.action ?? {};
      if ((a.type as string) === "edit_file") {
        const path = (a.path as string) ?? "";
        const before = current[path] ?? "";
        const after = (a.new_content as string) ?? "";
        out.push({ before, after, path });
        current[path] = after;
      } else {
        out.push({ before: "", after: "", path: "" });
      }
    }
    return out;
  }, [ep]);

  const steps = ep?.steps ?? [];
  const next = useCallback(
    () => setCursor((c) => Math.min(steps.length - 1, c + 1)),
    [steps.length]
  );
  const prev = useCallback(() => setCursor((c) => Math.max(0, c - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    if (isPlaying) {
      playbackRef.current = setInterval(() => {
        setCursor((c) => {
          if (c >= steps.length - 1) {
            setIsPlaying(false);
            return c;
          }
          return c + 1;
        });
      }, playbackSpeed);
    } else {
      if (playbackRef.current) clearInterval(playbackRef.current);
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, playbackSpeed, steps.length]);

  if (error) return <div className="text-[var(--color-fail)] font-mono">Failed to load: {error}</div>;
  if (!ep) return <div className="text-[var(--color-body)] font-mono">Loading episode…</div>;
  if (steps.length === 0)
    return <div className="text-[var(--color-body)] font-mono">This episode has no steps.</div>;

  const step = steps[cursor];
  const fs = fileStates[cursor];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="px-6 py-12"
    >
      <Header ep={ep} />

      <Timeline steps={steps} cursor={cursor} onSelect={setCursor} />

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="grid gap-8 md:grid-cols-2">
            <ActionPanel step={step} />
            <OutputPanel step={step} />
          </div>
          <DiffPanel step={step} before={fs?.before ?? ""} after={fs?.after ?? ""} />
        </div>
        <div className="space-y-8">
          <FileExplorer
            episodeId={episodeId}
            stepIndex={cursor}
            originalFiles={(ep.metadata?.original_files as Record<string, string> | undefined) ?? {}}
          />
        </div>
      </div>

      <Controls
        cursor={cursor}
        total={steps.length}
        onPrev={prev}
        onNext={next}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
      />
    </motion.section>
  );
}

function Header({ ep }: { ep: EpisodeOut }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link to="/replay" className="text-sm text-[var(--color-soft-ink)] hover:text-[var(--color-ink)] transition-colors">
        ← episodes
      </Link>
      <span className="font-mono text-sm text-[var(--color-ink)]">{ep.task_id}</span>
      <span className="capitalize text-[var(--color-soft-ink)]">· {ep.model}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          ep.passed
            ? "bg-[var(--color-pass)]/15 text-[var(--color-pass)]"
            : "bg-[var(--color-fail)]/15 text-[var(--color-fail)]"
        )}
      >
        {ep.passed ? "solved" : "failed"}
      </span>
      {ep.is_fixture && (
        <span className="rounded-full bg-[var(--color-amber)]/15 px-2 py-0.5 text-xs text-[var(--color-amber)]">
          golden fixture
        </span>
      )}
      <div className="ml-auto flex items-center gap-4 font-mono text-xs text-[var(--color-soft-ink)]">
        <span className="group">
          reward <span className="text-[var(--color-ink)]">{ep.final_reward.toFixed(2)}</span>
        </span>
        <span className="text-[var(--color-hairline)]">|</span>
        <span className="group">
          Ultra judge{" "}
          <span className="text-violet-300">{ep.judge_score ?? "–"}/10</span>
        </span>
      </div>
    </div>
  );
}

function Timeline({
  steps,
  cursor,
  onSelect,
}: {
  steps: StepEvent[];
  cursor: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-8 flex items-center gap-1 overflow-x-auto rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] p-2">
      {steps.map((s, i) => {
        const t = (s.action?.type as string) ?? "?";
        const active = i === cursor;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            title={`step ${s.step}: ${t}`}
            className={cn(
              "flex min-w-9 flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-all",
              active ? "bg-[var(--color-hairline)] text-[var(--color-ink)]" : "hover:bg-[var(--color-hairline)]/50 text-[var(--color-soft-ink)]"
            )}
          >
            <span className="font-mono text-xs">{s.step}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full", dotColor(t))} />
          </button>
        );
      })}
    </div>
  );
}

function dotColor(type: string): string {
  switch (type) {
    case "edit_file":
      return "bg-emerald-400";
    case "run_tests":
      return "bg-amber-400";
    case "run_command":
      return "bg-sky-400";
    case "give_up":
      return "bg-rose-400";
    default:
      return "bg-slate-500";
  }
}

function ActionPanel({ step }: { step: StepEvent }) {
  const type = (step.action?.type as string) ?? "?";
  const color = actionColor[type] ?? "text-slate-300";

  const sanitizedAction = useMemo(() => {
    const label = actionLabel(step.action);
    if (!label) return "";
    return label.replace(/\/var\/folders\/.*\/Screenshot\s\d{4}-\d{2}-\d{2}.*\.png/g, "[Local Screenshot Path Hidden]");
  }, [step.action]);

  return (
    <div className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-[var(--color-soft-ink)] font-mono">
          Action · step {step.step}
        </span>
        <span className="font-mono text-xs text-[var(--color-soft-ink)]">
          reward {step.reward.toFixed(2)} (Σ {step.reward_so_far.toFixed(2)})
        </span>
      </div>
      <div className="px-4 py-3">
        <code className={cn("font-mono text-sm", color)}>
          {sanitizedAction}
        </code>
        {step.thought && step.thought.trim() && (
          <p className="mt-3 border-l-2 border-[var(--color-hairline)] pl-3 text-sm italic text-[var(--color-soft-ink)]">
            {truncate(step.thought, 400)}
          </p>
        )}
      </div>
    </div>
  );
}

function OutputPanel({ step }: { step: StepEvent }) {
  const sanitizedObservation = useMemo(() => {
    if (!step.observation) return "(no output)";
    // Remove noisy macOS temporary screenshot paths that clutter the UI
    return step.observation.replace(/\/var\/folders\/.*\/Screenshot\s\d{4}-\d{2}-\d{2}.*\.png/g, "[Local Screenshot Path Hidden]");
  }, [step.observation]);

  return (
    <div className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden">
      <div className="border-b border-[var(--color-hairline)] px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-soft-ink)] font-mono">
        Sandbox output
      </div>
      <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-[var(--color-soft-ink)]">
        {sanitizedObservation.trim()}
      </pre>
    </div>
  );
}

function DiffPanel({
  step,
  before,
  after,
}: {
  step: StepEvent;
  before: string;
  after: string;
}) {
  const isEdit = (step.action?.type as string) === "edit_file";
  const lines: DiffLine[] = useMemo(
    () => (isEdit ? diffLines(before, after) : []),
    [isEdit, before, after]
  );
  const stats = diffStats(lines);

  return (
    <div className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-[var(--color-soft-ink)] font-mono">
          Code diff
        </span>
        {isEdit && (
          <span className="font-mono text-xs">
            <span className="text-emerald-400">+{stats.added}</span>{" "}
            <span className="text-rose-400">-{stats.removed}</span>
          </span>
        )}
      </div>
      {isEdit ? (
        <pre className="max-h-[32rem] overflow-auto font-mono text-xs leading-relaxed">
          {lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                "px-1",
                l.kind === "add"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : l.kind === "del"
                  ? "bg-rose-500/10 text-rose-300"
                  : "text-[var(--color-soft-ink)]"
              )}
            >
              <span className="select-none pl-3 pr-2 text-[var(--color-hairline)]">
                {l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}
              </span>
              {l.text || " "}
            </div>
          ))}
        </pre>
      ) : (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-soft-ink)]">
          No code change on this step.
        </div>
      )}
    </div>
  );
}

function FileExplorer({
  episodeId,
  stepIndex,
  originalFiles
}: {
  episodeId: string;
  stepIndex: number;
  originalFiles: Record<string, string>
}) {
  const sanitizedFiles = useMemo(() => {
    return Object.keys(originalFiles).map(f =>
      f.replace(/\/var\/folders\/.*\/Screenshot\s\d{4}-\d{2}-\d{2}.*\.png/g, "[Local Screenshot Path Hidden]")
    );
  }, [originalFiles]);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedFile) {
      setIsLoading(true);
      api.getFileAtStep(episodeId, stepIndex, selectedFile)
        .then(c => setContent(c))
        .catch(() => setContent(null))
        .finally(() => setIsLoading(false));
    } else {
      setContent(null);
    }
  }, [episodeId, stepIndex, selectedFile]);

  return (
    <div className="flex h-full flex-col rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden">
      <div className="border-b border-[var(--color-hairline)] px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-soft-ink)] font-mono">
        Forensic Explorer
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 border-r border-[var(--color-hairline)] overflow-y-auto p-2 space-y-1">
          {sanitizedFiles.map(f => (
            <button
              key={f}
              onClick={() => setSelectedFile(f)}
              className={cn(
                "w-full text-left px-2 py-1 rounded-sm text-xs font-mono truncate transition-colors",
                selectedFile === f
                  ? "bg-[var(--color-hairline)] text-[var(--color-ink)]"
                  : "text-[var(--color-soft-ink)] hover:bg-[var(--color-hairline)]/30"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[var(--color-soft-ink)] relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-panel)]/50 backdrop-blur-sm">
              <span className="animate-pulse text-[10px] uppercase tracking-widest">Fetching state...</span>
            </div>
          )}
          {content ? (
            <pre className="whitespace-pre-wrap">{content}</pre>
          ) : (
            <div className="h-full flex items-center justify-center text-center opacity-40 italic">
              {selectedFile ? "File not found at this step" : "Select a file to view its state"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Controls({
  cursor,
  total,
  onPrev,
  onNext,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
}: {
  cursor: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (v: number) => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPrev}
          disabled={cursor === 0}
          className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 text-sm text-[var(--color-ink)] enabled:hover:bg-[var(--color-hairline)] disabled:opacity-40 transition-colors"
        >
          ← Prev
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            "rounded-sm border px-4 py-2 text-sm font-mono transition-all",
            isPlaying
              ? "border-[var(--color-amber)] bg-[var(--color-amber)]/10 text-[var(--color-amber)]"
              : "border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
          )}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </motion.button>

        <Dropdown
          ariaLabel="Playback speed"
          size="sm"
          value={String(playbackSpeed)}
          onChange={(v) => setPlaybackSpeed(Number(v))}
          options={[
            { value: "2000", label: "0.5x" },
            { value: "1000", label: "1.0x" },
            { value: "500", label: "2.0x" },
            { value: "200", label: "5.0x" },
          ]}
        />
      </div>

      <span className="font-mono text-sm text-[var(--color-soft-ink)]">
        step {cursor + 1} / {total}
      </span>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onNext}
        disabled={cursor === total - 1}
        className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 text-sm text-[var(--color-ink)] enabled:hover:bg-[var(--color-hairline)] disabled:opacity-40 transition-colors"
      >
        Next →
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
