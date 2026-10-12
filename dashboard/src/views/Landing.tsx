import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { api, type EpisodeSummary, type TaskOut, type LeaderboardRow } from '../api';
import { Hero } from '../components/landing/Hero';
import { MiniReplay } from '../components/landing/MiniReplay';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const blackBoxSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 26,
} as const

const CountUp = ({ value, label }: { value: number | string, label: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const spring = useSpring(0, { stiffness: 260, damping: 26 });
  const display = useTransform(spring, (current) => {
    if (typeof value === 'string') return value;
    return Math.round(current).toString();
  });

  useEffect(() => {
    setIsLoaded(true);
    if (typeof value === 'number') {
      spring.set(value);
    }
  }, [value, spring]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="h-6 w-16 bg-[var(--color-muted-fill)] animate-pulse" />
        <div className="h-3 w-20 bg-[var(--color-muted-fill)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.span className="text-3xl font-display font-bold text-[var(--color-ink)] tracking-tighter">
        {display}
      </motion.span>
      <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-micro)]">{label}</span>
    </div>
  );
};

const StatsStrip: React.FC = () => {
  const [stats, setStats] = useState<{ episodes: number, models: number, judge: string, steps: string } | null>(null);

  useEffect(() => {
    Promise.all([api.episodes(), api.leaderboard()]).then(([episodes, leaderboard]) => {
      const models = new Set(episodes.map(e => e.model)).size;
      const avgJudge = leaderboard.reduce((acc, row) => acc + (row.avg_judge_score ?? 0), 0) / leaderboard.length;
      const avgSteps = leaderboard.reduce((acc, row) => acc + row.avg_steps, 0) / leaderboard.length;

      setStats({
        episodes: episodes.length,
        models: models,
        judge: avgJudge.toFixed(2),
        steps: avgSteps.toFixed(1)
      });
    });
  }, []);

  if (!stats) return <div className="w-full border-y border-[var(--color-border)] py-12 flex justify-around items-center opacity-0" />;

  return (
    <div className="w-full border-y border-[var(--color-border)] py-12 bg-white">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        <CountUp value={stats.episodes} label="Recorded Episodes" />
        <CountUp value={stats.models} label="Nemotron Models" />
        <CountUp value={stats.judge} label="Avg Judge Score" />
        <CountUp value={stats.steps} label="Avg Steps" />
      </div>
    </div>
  );
};

const FreshFromGym: React.FC = () => {
  const [episodes, setEpisodes] = useState<EpisodeSummary[] | null>(null);
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.episodes().catch(() => [] as EpisodeSummary[]), api.fixtures().catch(() => [] as EpisodeSummary[]), api.tasks().catch(() => [] as TaskOut[])]).then(([eps, fixs, tks]) => {
      const pool = eps.length > 0 ? eps : fixs;
      // Diversify: prefer distinct tasks so cards never repeat the same task name
      const seen = new Set<string>();
      const picked: EpisodeSummary[] = [];
      const sorted = [...pool].sort((a, b) => b.episode_id.localeCompare(a.episode_id));
      for (const ep of sorted) {
        if (!seen.has(ep.task_id)) { seen.add(ep.task_id); picked.push(ep); }
        if (picked.length === 3) break;
      }
      for (const ep of sorted) {
        if (picked.length === 3) break;
        if (!picked.includes(ep)) picked.push(ep);
      }
      setEpisodes(picked);
      setTasks(tks);
    });
  }, []);

  const getTaskName = (id: string) => tasks.find(t => t.id === id)?.name ?? id.replace(/-/g, ' ');

  return (
    <section className="px-6 py-24 border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-baseline justify-between mb-16">
          <div className="flex items-baseline gap-4">
            <h2 className="font-display text-4xl font-bold tracking-tighter text-[var(--color-ink)] uppercase">Fresh from the Gym</h2>
            <span className="font-mono text-xs text-[var(--color-micro)]">LATEST_TRAJECTORIES</span>
          </div>
          <div className="hidden md:block h-px flex-1 mx-8 bg-[var(--color-border)]" />
          <div className="font-mono text-[10px] text-[var(--color-micro)] uppercase tracking-widest">
            Updated: Just Now
          </div>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {episodes === null ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="p-8 rounded-2xl border border-[var(--color-border)] bg-white">
                <div className="h-3 w-2/3 bg-[var(--color-muted-fill)] animate-pulse rounded mb-4" />
                <div className="h-6 w-1/2 bg-[var(--color-muted-fill)] animate-pulse rounded mb-8" />
                <div className="h-20 w-full bg-[var(--color-muted-fill)] animate-pulse rounded" />
              </div>
            ))
          ) : episodes.length === 0 ? (
            <div className="md:col-span-3 py-16 text-center font-mono text-sm text-[var(--color-micro)] border border-dashed border-[var(--color-border)] rounded-2xl">
              No trajectories recorded yet — run the gym to populate this feed.
            </div>
          ) : episodes.map((ep) => (
            <motion.div
              key={ep.episode_id}
              whileHover={{ y: -4 }}
              onClick={() => navigate(`/replay/${ep.episode_id}`)}
              className="cursor-pointer p-8 rounded-2xl border border-[var(--color-border)] bg-white hover:border-[var(--color-amber)] transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                  ep.passed ? "border-green-500 text-green-600 bg-green-50" : "border-red-500 text-red-600 bg-red-50"
                )}>
                  {ep.passed ? "PASSED" : "FAILED"}
                </span>
              </div>
              <div className="mb-8">
                <span className="font-mono text-[10px] text-[var(--color-micro)] block mb-2">{ep.episode_id}</span>
                <h3 className="font-display text-xl font-bold text-[var(--color-ink)] line-clamp-1 group-hover:text-[var(--color-amber)] transition-colors">{getTaskName(ep.task_id)}</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-4 font-mono text-[11px] border-t border-[var(--color-border)] pt-6">
                <div className="text-[var(--color-micro)] uppercase text-[9px]">Model</div>
                <div className="text-right text-[var(--color-ink)] font-bold">{ep.model}</div>
                <div className="text-[var(--color-micro)] uppercase text-[9px]">Steps</div>
                <div className="text-right text-[var(--color-ink)]">{ep.num_steps}</div>
                <div className="text-[var(--color-micro)] uppercase text-[9px]">Judge Score</div>
                <div className="text-right text-[var(--color-amber)] font-bold">{ep.judge_score ?? 'N/A'}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks: React.FC = () => {
  const steps = [
    { id: '01', title: 'Feed it broken code', desc: 'Inject a repository with intentional bugs into the gym environment.' },
    { id: '02', title: 'Agent acts in sandbox', desc: 'The AI agent iterates, edits, and tests code within an isolated container.' },
    { id: '03', title: 'Trajectory saved', desc: 'Every thought and action is recorded as a flight-recorder trajectory.' },
  ];

  return (
    <section id="how-it-works" className="px-6 py-32 border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={blackBoxSpring}
              className="sticky top-32"
            >
              <div className="flex items-baseline gap-4 mb-6">
                <span className="font-mono text-6xl font-bold text-[var(--color-border)] opacity-50">01</span>
                <h2 className="font-display text-4xl font-bold tracking-tighter text-[var(--color-ink)] uppercase">How it works</h2>
              </div>
              <p className="text-lg text-[var(--color-body)] leading-relaxed max-w-md">
                Our pipeline transforms broken code into high-fidelity training data through a rigorous, automated loop.
              </p>
            </motion.div>
          </div>
          <div className="lg:col-span-8 grid gap-0 border-l border-[var(--color-border)] pl-0 lg:pl-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  ...blackBoxSpring,
                  delay: i * 0.1,
                }}
                className="relative group py-16 border-b border-[var(--color-border)] last:border-b-0"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-8">
                  <div className="md:w-1/4">
                    <div className="font-mono text-5xl font-bold text-[var(--color-border)] group-hover:text-[var(--color-amber)] transition-colors duration-500">
                      {step.id}
                    </div>
                  </div>
                  <div className="md:w-3/4">
                    <h3 className="mb-4 font-display text-2xl font-bold text-[var(--color-ink)]">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--color-body)] font-mono">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ModelComparison: React.FC = () => {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    api.leaderboard()
      .then((data) => {
        const order = ['nano', 'super', 'ultra'];
        setRows([...data].sort((a, b) => order.indexOf(a.model.toLowerCase()) - order.indexOf(b.model.toLowerCase())));
      })
      .catch(() => setRows([]));
  }, []);

  const ultra = rows?.find((r) => r.model.toLowerCase() === 'ultra');
  const loading = rows === null;

  return (
    <section id="models" className="px-6 py-32 bg-white border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={blackBoxSpring}
              className="sticky top-32"
            >
              <div className="flex items-baseline gap-4 mb-6">
                <span className="font-mono text-6xl font-bold text-[var(--color-border)] opacity-50">02</span>
                <h2 className="font-display text-4xl font-bold tracking-tighter text-[var(--color-ink)] uppercase">Model Comparison</h2>
              </div>
              <p className="text-lg text-[var(--color-body)] leading-relaxed max-w-md">
                All three models pass every task. The gym still separates them — on efficiency
                and on code quality.
              </p>
            </motion.div>
          </div>
          <div className="lg:col-span-8">
            <div className="grid gap-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={blackBoxSpring}
                className="w-full py-16 border-y border-[var(--color-border)] text-center bg-white"
              >
                <h3 className="text-6xl md:text-9xl font-display font-bold tracking-tighter text-[var(--color-ink)] leading-none">
                  Ultra is fastest. <br />
                  <span className="text-[var(--color-body)]">The judge disagrees.</span>
                </h3>
                <div className="mt-8 flex justify-center gap-8 font-mono text-xs uppercase text-[var(--color-accent-ink)]">
                  {loading ? (
                    <span className="h-4 w-40 bg-[var(--color-muted-fill)] animate-pulse rounded" />
                  ) : ultra ? (
                    <>
                      <span>{ultra.avg_steps.toFixed(1)} steps</span>
                      <span className="text-[var(--color-border)]">/</span>
                      <span>{ultra.avg_judge_score?.toFixed(1) ?? '—'} judge</span>
                    </>
                  ) : (
                    <span>5.2 steps / 9.6 judge</span>
                  )}
                </div>
              </motion.div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-14 w-full bg-[var(--color-muted-fill)] animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : rows && rows.length > 0 ? (
                <table className="w-full border-collapse font-mono text-sm">
                  <thead className="bg-[var(--color-soft-fill)]">
                    <tr className="text-[10px] uppercase text-[var(--color-micro)] border-b border-[var(--color-border)]">
                      <th className="text-left py-4 pl-4">Rank</th>
                      <th className="text-left py-4">Model</th>
                      <th className="text-right py-4">Avg Steps</th>
                      <th className="text-right py-4">Pass Rate</th>
                      <th className="text-right py-4 pr-4">Judge</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {rows.map((r, i) => {
                      const isUltra = r.model.toLowerCase() === 'ultra';
                      return (
                      <tr
                        key={r.model}
                        className={cn(
                        "border-b border-[var(--color-border)] transition-colors",
                        isUltra && "bg-[var(--color-amber)]/10 border-l-2 border-l-[var(--color-amber)]"
                        )}
                      >
                        <td className="py-4 pl-4 text-[var(--color-body)] opacity-50">0{i + 1}</td>
                        <td className="py-4 font-bold text-[var(--color-ink)] capitalize">{r.model}</td>
                        <td className="py-4 text-right text-[var(--color-body)]">{r.avg_steps.toFixed(1)}</td>
                        <td className="py-4 text-right text-[var(--color-body)]">{(r.pass_rate * 100).toFixed(0)}%</td>
                        <td className={cn("py-4 text-right pr-4 font-bold", isUltra ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-ink)]')}>
                          {r.avg_judge_score != null ? `${r.avg_judge_score.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                ) : (
                  <div className="py-16 text-center font-mono text-sm text-[var(--color-micro)] border border-dashed border-[var(--color-border)] rounded-2xl">
                    No completed episodes yet — run the gym to populate this table.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const DatasetSection: React.FC = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetText, setSheetText] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const openDatasheet = () => {
    setSheetOpen(true);
    setSheetText(null);
    setSheetError(null);
    api.datasheet().then(setSheetText).catch((e) => setSheetError(String(e)));
  };

  return (
    <section id="dataset" className="px-6 py-32 border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={blackBoxSpring}
              className="text-left"
            >
              <div className="flex items-baseline gap-4 mb-6">
                <span className="font-mono text-6xl font-bold text-[var(--color-border)] opacity-50">03</span>
                <h2 className="font-display text-4xl font-bold tracking-tighter text-[var(--color-ink)] uppercase">The Flight Data Archive</h2>
              </div>
              <p className="text-lg text-[var(--color-body)] leading-relaxed mb-12 max-w-md">
                Our dataset provides high-fidelity trajectories of AI agents solving real-world coding tasks.
                Each entry contains a full sequence of thoughts, tool calls, and environment responses.
              </p>
              <div className="flex flex-wrap gap-4">
                <motion.a
                  href={api.exportDatasetUrl()}
                  download
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-sm bg-[var(--color-amber)] px-6 py-2 text-xs font-mono font-bold text-[var(--color-bg)] hover:opacity-90 transition-opacity"
                >
                  EXPORT JSONL
                </motion.a>
                <motion.button
                  onClick={openDatasheet}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-sm border border-[var(--color-border)] px-6 py-2 text-xs font-mono text-[var(--color-ink)] hover:bg-[var(--color-border)] transition-colors"
                >
                  READ DATASHEET
                </motion.button>
              </div>
            </motion.div>
          </div>
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={blackBoxSpring}
              className="relative z-10"
            >
              <MiniReplay />
            </motion.div>
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--color-amber)]/10 blur-3xl rounded-full pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Datasheet modal */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-amber)]">
                SYS_LOG // DATASHEET
              </p>
              <button
                onClick={() => setSheetOpen(false)}
                className="font-mono text-xs text-[var(--color-micro)] hover:text-[var(--color-ink)]"
              >
                CLOSE ✕
              </button>
            </div>
            {sheetError ? (
              <p className="font-mono text-sm text-[var(--color-fail)]">{sheetError}</p>
            ) : sheetText === null ? (
              <div className="h-24 animate-pulse rounded bg-[var(--color-muted-fill)]" />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[var(--color-ink)]">
                {sheetText}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export const Landing: React.FC = () => {
  return (
    <div className="flex flex-col">
      <Hero />
      <StatsStrip />
      <FreshFromGym />
      <HowItWorks />
      <ModelComparison />
      <DatasetSection />
    </div>
  );
};
