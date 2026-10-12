import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  api,
  type EpisodeSummary,
  type LeaderboardRow,
  type MatrixCell,
} from "../api";
import { accentFor, fmt, pct } from "../lib/ui";
import { BlackBoxPanel } from "../components/ui/BlackBoxPanel";
import { cn } from "../lib/utils";

const blackBoxSpring = {
  type: "spring",
  stiffness: 260,
  damping: 26,
} as const

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [matrix, setMatrix] = useState<MatrixCell[] | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.leaderboard(), api.matrix(), api.episodes()])
      .then(([lb, mx, eps]) => {
        setRows(lb);
        setMatrix(mx);
        setEpisodes(eps);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return <div className="text-[var(--color-fail)] font-mono">Failed to load leaderboard: {error}</div>;
  if (!rows || !matrix || !episodes)
    return (
      <section className="space-y-12 px-6 py-12">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-4 w-48 bg-[var(--color-muted-fill)] animate-pulse rounded" />
          <div className="h-12 w-72 bg-[var(--color-muted-fill)] animate-pulse rounded" />
          <div className="h-4 w-96 bg-[var(--color-muted-fill)] animate-pulse rounded" />
        </div>
        <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-[var(--color-muted-fill)] animate-pulse" />
          ))}
        </div>
      </section>
    );

  if (rows.length === 0)
    return (
      <section className="px-6 py-24">
        <h1 className="text-4xl font-display font-bold tracking-tighter text-[var(--color-ink)]">Leaderboard</h1>
        <BlackBoxPanel className="mt-6 p-10 text-left text-[var(--color-body)] font-mono">
          No completed episodes yet. Run some episodes to populate the board.
        </BlackBoxPanel>
      </section>
    );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={blackBoxSpring}
      className="space-y-12 px-6 py-12"
    >
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-amber)]">
          SYS_LOG // MODEL_RANKINGS
        </p>
        <h1 className="mt-3 text-5xl font-display font-bold tracking-tighter text-[var(--color-ink)]">Leaderboard</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-body)]">
          Every model passes every task. The gym separates them on efficiency —
          and on code quality, where the judge has its own opinion.
        </p>
      </div>

      <ModelCards rows={rows} />
      <Insight rows={rows} />
      <Charts rows={rows} />
      <Matrix matrix={matrix} />
      <RecentEpisodes episodes={episodes} />
    </motion.section>
  );
}

function Insight({ rows }: { rows: LeaderboardRow[] }) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Single model: summarize what the data proves so far
  if (rows.length === 1) {
    const r = rows[0];
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...blackBoxSpring, delay: 0.15 }}
        className="mx-auto max-w-5xl"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-ink)] p-8 md:p-10">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #76B900, transparent 70%)" }}
          />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
            The takeaway
          </p>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            {cap(r.model)} passes everything.{" "}
            <span className="text-zinc-400">Add a rival to see the real story.</span>
          </p>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-zinc-400">
            {fmt(r.avg_steps)} steps per task · judge {fmt(r.avg_judge_score)}/10 ·{" "}
            {r.episodes} episodes. The gym's headline — speed vs quality — appears
            once two models share the board.
          </p>
        </div>
      </motion.div>
    );
  }

  const insight = useMemo(() => {
    if (rows.length < 2) return null;
    const fastest = [...rows].sort((a, b) => a.avg_steps - b.avg_steps)[0];
    const bestJudge = [...rows].sort(
      (a, b) => (b.avg_judge_score ?? 0) - (a.avg_judge_score ?? 0)
    )[0];
    if (fastest.model === bestJudge.model) return null;
    return { fastest, bestJudge };
  }, [rows]);

  if (!insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...blackBoxSpring, delay: 0.15 }}
      className="mx-auto max-w-5xl"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-ink)] p-8 md:p-10">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #76B900, transparent 70%)" }}
        />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
          The takeaway
        </p>
        <p className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          {cap(insight.fastest.model)} is fastest.{" "}
          <span className="text-zinc-400">The judge disagrees.</span>
        </p>
        <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-zinc-400">
          {cap(insight.fastest.model)} averages {fmt(insight.fastest.avg_steps)} steps per task —
          but {cap(insight.bestJudge.model)} scores {fmt(insight.bestJudge.avg_judge_score)}/10
          on code quality. Speed and quality don't move together.
        </p>
      </div>
    </motion.div>
  );
}

function ModelCards({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {rows.map((r, i) => (
        <motion.div
          key={r.model}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...blackBoxSpring, delay: i * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <BlackBoxPanel
            title={`MODEL_${r.model.toUpperCase()}`}
            technical
            className="relative overflow-hidden h-full"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-display font-bold capitalize text-[var(--color-ink)]">{r.model}</span>
              {i === 0 && (
                <span className="rounded-sm bg-[var(--color-amber)]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--color-amber)] uppercase">
                  leader
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Stat label="Pass rate" value={pct(r.pass_rate)} big />
              <Stat label="Judge" value={`${fmt(r.avg_judge_score)} / 10`} big />
              <Stat label="Avg steps" value={fmt(r.avg_steps)} />
              <Stat label="Episodes" value={String(r.episodes)} />
            </div>
          </BlackBoxPanel>
        </motion.div>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-body)] font-mono">
        {label}
      </div>
      <div className={cn(
        "font-display",
        big ? "text-2xl font-bold text-[var(--color-ink)]" : "text-base font-mono text-[var(--color-body)]"
      )}>
        {value}
      </div>
    </div>
  );
}

function Charts({ rows }: { rows: LeaderboardRow[] }) {
  const maxSteps = Math.max(1, ...rows.map((r) => r.avg_steps));
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <BarPanel title="Pass rate">
        {rows.map((r) => (
          <Bar
            key={r.model}
            label={r.model}
            value={r.pass_rate}
            display={pct(r.pass_rate)}
            frac={r.pass_rate}
            color={accentFor(r.model)}
          />
        ))}
      </BarPanel>
      <BarPanel title="Judge score (/10)">
        {rows.map((r) => (
          <Bar
            key={r.model}
            value={r.avg_judge_score ?? 0}
            display={fmt(r.avg_judge_score)}
            frac={(r.avg_judge_score ?? 0) / 10}
            color={accentFor(r.model)}
            label={r.model}
          />
        ))}
      </BarPanel>
      <BarPanel title="Avg steps (lower = faster)">
        {rows.map((r) => (
          <Bar
            key={r.model}
            value={r.avg_steps}
            display={fmt(r.avg_steps)}
            frac={r.avg_steps / maxSteps}
            color={accentFor(r.model)}
            label={r.model}
          />
        ))}
      </BarPanel>
    </div>
  );
}

function BarPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <BlackBoxPanel title={title.toUpperCase()} technical>
      <div className="mt-4 space-y-4">{children}</div>
    </BlackBoxPanel>
  );
}

function Bar({
  label,
  display,
  frac,
  color,
}: {
  label: string;
  value: number;
  display: string;
  frac: number;
  color: string;
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="capitalize text-[var(--color-body)] font-mono group-hover:text-[var(--color-ink)] transition-colors">{label}</span>
        <span className="font-mono text-[var(--color-ink)]">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-[var(--color-border)]">
        <div className="flex h-full w-full gap-0.5">
          {/* Segmented Bar Implementation */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1 rounded-none"
              style={{
                backgroundColor: (i / 20) < frac ? color : 'transparent',
                opacity: (i / 20) < frac ? 1 : 0.2
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Matrix({ matrix }: { matrix: MatrixCell[] }) {
  const models = useMemo(
    () => Array.from(new Set(matrix.map((c) => c.model))).sort(),
    [matrix]
  );
  const tasks = useMemo(
    () => Array.from(new Set(matrix.map((c) => c.task_id))).sort(),
    [matrix]
  );
  const lookup = useMemo(() => {
    const m = new Map<string, MatrixCell>();
    for (const c of matrix) m.set(`${c.model}:${c.task_id}`, c);
    return m;
  }, [matrix]);

  if (matrix.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={blackBoxSpring}
    >
      <BlackBoxPanel title="MODELS x TASKS" technical>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--color-panel)]">
              <tr className="text-[var(--color-body)] font-mono text-[10px] uppercase tracking-widest">
                <th className="px-3 py-2 text-left font-medium">Task</th>
                {models.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-2 text-left font-medium capitalize"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {tasks.map((task) => (
                <tr key={task} className="hover:bg-[var(--color-border)]/30 transition-colors group">
                  <td className="px-3 py-2 font-mono text-[var(--color-ink)] group-hover:text-[var(--color-amber)] transition-colors">{task}</td>
                  {models.map((m) => {
                    const c = lookup.get(`${m}:${task}`);
                    if (!c)
                      return (
                      <td key={m} className="px-3 py-2 text-[var(--color-body)]">
                        –
                      </td>
                      );
                    return (
                      <td key={m} className="px-3 py-2">
                        <span
                          className={cn(
                          "font-mono",
                          c.pass_rate >= 1
                            ? "text-[var(--color-pass)]"
                            : c.pass_rate > 0
                            ? "text-[var(--color-amber)]"
                            : "text-[var(--color-fail)]"
                          )}
                        >
                          {pct(c.pass_rate)}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-[var(--color-body)]">
                          {fmt(c.avg_steps)}s · {fmt(c.avg_judge_score)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlackBoxPanel>
    </motion.div>
  );
}

function RecentEpisodes({ episodes }: { episodes: EpisodeSummary[] }) {
  const completed = episodes.filter((e) => e.status === "completed").slice(0, 12);
  if (completed.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={blackBoxSpring}
    >
      <BlackBoxPanel title="RECENT_EPISODES" technical>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {completed.map((e) => (
            <Link
              key={e.episode_id}
              to={`/replay/${e.episode_id}`}
              className="flex items-center gap-3 py-3 text-sm hover:bg-[var(--color-border)]/30 transition-colors group"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                e.passed ? "bg-[var(--color-pass)]" : "bg-[var(--color-fail)]"
                }`}
              />
              <span className="font-mono text-[var(--color-ink)] group-hover:text-[var(--color-amber)] transition-colors">{e.task_id}</span>
              <span className="capitalize text-[var(--color-body)]">{e.model}</span>
              {e.is_fixture && (
                <span className="rounded-sm bg-[var(--color-amber)]/15 px-2 py-0.5 text-[10px] font-mono text-[var(--color-amber)]">
                  golden
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-[var(--color-body)]">
                {e.num_steps} steps · judge {e.judge_score ?? "–"} · reward{" "}
                {e.final_reward.toFixed(2)}
              </span>
            </Link>
          ))}
        </div>
      </BlackBoxPanel>
    </motion.div>
  );
}
