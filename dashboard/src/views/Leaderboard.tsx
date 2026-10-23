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
import { LeaderboardBars, type LeaderboardModel } from "../components/ui/leaderboard-bars";
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
        <h1 className="text-4xl font-display font-semibold tracking-tighter text-[var(--color-ink)]">Leaderboard</h1>
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
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-micro)]">
          Model rankings
        </p>
        <h1 className="mt-3 text-5xl font-display font-semibold tracking-tighter text-[var(--color-ink)]">Leaderboard</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-body)]">
          Every model passes every task. The gym separates them on efficiency —
          and on code quality, where the judge has its own opinion.
        </p>
      </div>

      <RankingTable rows={rows} matrix={matrix} />
      <Insight rows={rows} />
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
        <div className="relative border border-[var(--color-border)] border-l-2 border-l-[var(--color-amber)] bg-[var(--color-panel)] p-8 md:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
            The takeaway
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
            {cap(r.model)} passes everything.{" "}
            <span className="text-[var(--color-body)]">Add a rival to see the real story.</span>
          </p>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-[var(--color-body)]">
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
      <div className="relative border border-[var(--color-border)] border-l-2 border-l-[var(--color-amber)] bg-[var(--color-panel)] p-8 md:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
          The takeaway
        </p>
        <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
          {cap(insight.fastest.model)} is fastest.{" "}
          <span className="text-[var(--color-body)]">The judge disagrees.</span>
        </p>
        <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-[var(--color-body)]">
          {cap(insight.fastest.model)} averages {fmt(insight.fastest.avg_steps)} steps per task —
          but {cap(insight.bestJudge.model)} scores {fmt(insight.bestJudge.avg_judge_score)}/10
          on code quality. Speed and quality don't move together.
        </p>
      </div>
    </motion.div>
  );
}

function RankingTable({ rows, matrix }: { rows: LeaderboardRow[]; matrix: MatrixCell[] }) {
  const versions = useMemo(() => {
    const models: LeaderboardModel[] = rows.map((r) => ({
      id: r.model,
      color: accentFor(r.model),
      badge: r.model[0]?.toUpperCase(),
      runs: [
        // Aggregate row first — "Best" mode shows exactly this row per model.
        {
          score: (r.avg_judge_score ?? 0) * 10,
          x: { steps: r.avg_steps, episodes: r.episodes, pass: r.pass_rate * 100 },
        },
        // "Per task" mode expands every model x task cell (real matrix data).
        ...matrix
          .filter((c) => c.model === r.model)
          .map((c) => ({
            variant: c.task_id,
            score: (c.avg_judge_score ?? 0) * 10,
            x: { steps: c.avg_steps, episodes: c.episodes, pass: c.pass_rate * 100 },
          })),
      ],
    }));
    return [{ key: "current", label: "current", models }];
  }, [rows, matrix]);

  const totalEpisodes = rows.reduce((a, r) => a + r.episodes, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...blackBoxSpring, delay: 0.1 }}
      className="mx-auto max-w-5xl"
    >
      <LeaderboardBars
        versions={versions}
        columns={[
          { key: "steps", label: "steps", decimals: 1 },
          { key: "episodes", label: "episodes", decimals: 0 },
          { key: "pass", label: "pass", suffix: "%", decimals: 0 },
        ]}
        meta={`${rows.length} models · ${totalEpisodes} episodes`}
        footnote="Judge scores are 0–10 from the automated code judge, shown here ×10. Steps count agent actions per task — fewer is faster."
        scoreLabel="judge"
        scoreSuffix="%"
        modelColLabel="model"
        bestLabel="Best"
        allRunsLabel="Per task"
        modelsLabel="Models"
      />
    </motion.div>
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
      <BlackBoxPanel title="Models × tasks">
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
      <BlackBoxPanel title="Recent episodes">
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
