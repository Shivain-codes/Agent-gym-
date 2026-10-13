import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api, type EpisodeSummary, type TaskOut, type LeaderboardRow } from '../api';
import { Hero } from '../components/landing/Hero';
import { MiniReplay } from '../components/landing/MiniReplay';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Bug, Terminal, History, ArrowRight } from 'lucide-react';
import { EditorialList } from '../components/ui/editorial-list';

// Softer spring for scroll-triggered reveals — settles without judder
const revealSpring = {
  type: 'spring',
  stiffness: 120,
  damping: 24,
} as const

const StatsStrip: React.FC = () => {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.episodes(), api.leaderboard()]).then(([episodes, leaderboard]) => {
      const models = new Set(episodes.map(e => e.model)).size;
      const avgJudge = leaderboard.reduce((acc, row) => acc + (row.avg_judge_score ?? 0), 0) / Math.max(1, leaderboard.length);
      const avgSteps = leaderboard.reduce((acc, row) => acc + row.avg_steps, 0) / Math.max(1, leaderboard.length);
      setLine(
        `${episodes.length} recorded episodes · ${models} model${models === 1 ? '' : 's'} · ${avgJudge.toFixed(1)} avg judge · ${avgSteps.toFixed(1)} avg steps`
      );
    }).catch(() => {});
  }, []);

  if (!line) return <div className="w-full border-y border-[var(--color-border)] py-5" />;

  return (
    <div className="w-full border-y border-[var(--color-border)] py-5">
      <div className="mx-auto max-w-7xl px-6">
        <p className="font-mono text-xs text-[var(--color-micro)]">{line}</p>
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
  const getTaskPrompt = (id: string) => {
    const pr = tasks.find(t => t.id === id)?.prompt ?? '';
    return pr.length > 96 ? pr.slice(0, 96).trimEnd() + '…' : pr;
  };

  return (
    <section id="fresh" className="px-6 py-24 border-t border-[var(--color-border)] scroll-mt-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-baseline justify-between mb-16">
          <div className="flex items-baseline gap-4">
            <h2 className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">Fresh from the gym</h2>
            <span className="font-mono text-xs text-[var(--color-micro)]">LATEST_TRAJECTORIES</span>
          </div>
          <div className="hidden md:block h-px flex-1 mx-8 bg-[var(--color-border)]" />
          <div className="font-mono text-[10px] text-[var(--color-micro)] uppercase tracking-widest">
            Updated: Just Now
          </div>
        </div>
        {episodes === null ? (
          <div className="border-t border-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-b border-[var(--color-border)] py-8 flex items-baseline gap-8">
                <div className="h-4 w-8 shrink-0 bg-[var(--color-muted-fill)] animate-pulse rounded" />
                <div className="flex-1">
                  <div className="h-7 w-2/3 bg-[var(--color-muted-fill)] animate-pulse rounded mb-3" />
                  <div className="h-3 w-1/3 bg-[var(--color-muted-fill)] animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <div className="py-16 text-center font-mono text-sm text-[var(--color-micro)] border-y border-dashed border-[var(--color-border)]">
            No trajectories recorded yet — run the gym to populate this feed.
          </div>
        ) : (
          <EditorialList
            items={episodes.map((ep, i) => {
              const diffMatch = ep.task_id.match(/^(easy|medium|hard|expert)/i);
              const difficulty = diffMatch ? diffMatch[1] : 'task';
              const prompt = getTaskPrompt(ep.task_id);
              return {
                id: ep.episode_id,
                index: String(i + 1).padStart(2, '0'),
                title: getTaskName(ep.task_id),
                descriptor: (
                  <span className={ep.passed ? 'text-[var(--color-pass)]' : 'text-[var(--color-fail)]'}>
                    {ep.passed ? '\u25cf solved' : '\u25cf not solved'}
                  </span>
                ),
                meta: (
                  <>
                    <span className="uppercase tracking-widest">{difficulty}</span>
                    <span className="text-[var(--color-border)]">{' / '}</span>
                    <span className="capitalize">{ep.model}</span>
                    <span className="text-[var(--color-border)]">{' / '}</span>
                    <span>{ep.num_steps} steps</span>
                    <span className="text-[var(--color-border)]">{' / '}</span>
                    <span>judge {ep.judge_score != null ? ep.judge_score.toFixed(1) : '—'}</span>
                  </>
                ),
                detail: (
                  <div className="font-mono text-[11px] leading-relaxed text-[var(--color-micro)]">
                    {prompt && <p className="opacity-70">{'// '}{prompt}</p>}
                    <p className="mt-2">episode {ep.episode_id}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/replay/${ep.episode_id}`)}
                      className="mt-3 inline-flex items-center gap-1.5 text-[var(--color-ink)] hover:text-[var(--color-amber)] transition-colors"
                    >
                      Open replay <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </section>
  );
};

const HowItWorks: React.FC = () => {
  const steps = [
    { icon: Bug, title: 'Feed it broken code.', desc: 'A repository with an intentional bug goes into the gym environment. Nothing mocked, nothing staged.' },
    { icon: Terminal, title: 'The agent works the sandbox.', desc: 'It reads, edits, and runs tests inside an isolated container, one step at a time.' },
    { icon: History, title: 'Every step is kept.', desc: 'Thoughts, actions, and verdicts are recorded as a replayable trajectory.' },
  ];

  return (
    <section id="how-it-works" className="px-6 py-24 border-t border-[var(--color-border)] scroll-mt-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">How it works</h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--color-body)]">
          Broken code goes in. A scored, replayable trajectory comes out.
        </p>
        <div className="mt-12 grid md:grid-cols-3 border-t border-l border-[var(--color-border)]">
          {steps.map((step) => (
            <div
              key={step.title}
              className="border-b border-r border-[var(--color-border)] p-8 transition-colors duration-200 hover:bg-white/[0.015]"
            >
              <step.icon size={20} strokeWidth={1.75} className="text-[var(--color-amber)]" />
              <h3 className="mt-6 font-display text-xl font-semibold tracking-tight text-[var(--color-ink)]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-body)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ComparisonHeadline: React.FC<{ rows: LeaderboardRow[] }> = ({ rows }) => {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (rows.length === 0) return null;
  const line =
    rows.length === 1
      ? `${cap(rows[0].model)} holds the board.`
      : (() => {
          const fastest = [...rows].sort((a, b) => a.avg_steps - b.avg_steps)[0];
          const bestJudge = [...rows].sort(
            (a, b) => (b.avg_judge_score ?? 0) - (a.avg_judge_score ?? 0)
          )[0];
          const split = fastest.model !== bestJudge.model;
          return `${cap(fastest.model)} is fastest. ${split ? 'The judge disagrees.' : 'The judge agrees.'}`;
        })();
  const stat =
    rows.length === 1
      ? { steps: rows[0].avg_steps, judge: rows[0].avg_judge_score, who: null as string | null }
      : (() => {
          const fastest = [...rows].sort((a, b) => a.avg_steps - b.avg_steps)[0];
          const bestJudge = [...rows].sort(
            (a, b) => (b.avg_judge_score ?? 0) - (a.avg_judge_score ?? 0)
          )[0];
          return { steps: fastest.avg_steps, judge: bestJudge.avg_judge_score, who: cap(bestJudge.model) };
        })();
  return (
    <>
      <h3 className="font-display text-3xl md:text-5xl font-semibold tracking-tighter text-[var(--color-ink)] leading-tight">
        {line}
      </h3>
      <div className="mt-6 flex justify-center gap-8 font-mono text-xs uppercase text-[var(--color-accent-ink)]">
        <span>{stat.steps.toFixed(1)} steps</span>
        <span className="text-[var(--color-border)]">/</span>
        <span>
          {stat.judge?.toFixed(1) ?? '—'} judge{stat.who ? ` · ${stat.who}` : ''}
        </span>
      </div>
    </>
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

  const loading = rows === null;

  return (
    <section id="models" className="px-6 py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={revealSpring}
              className="sticky top-32"
            >
              <div className="mb-6">
                <h2 className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">Model comparison</h2>
              </div>
              <p className="text-lg text-[var(--color-body)] leading-relaxed max-w-md">
                {rows && rows.length >= 2 ? (
                  <>All three models pass every task. The gym still separates them — on efficiency
                  and on code quality.</>
                ) : (
                  <>One model on the board, every task passed. The gym is ready for rivals —
                  that's when efficiency and code quality start to diverge.</>
                )}
              </p>
            </motion.div>
          </div>
          <div className="lg:col-span-8">
            <div className="grid gap-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={revealSpring}
                className="w-full py-10 md:py-12 border-y border-[var(--color-border)] text-center bg-[var(--color-panel)]"
              >
                {loading ? (
                  <div className="h-10 w-64 bg-[var(--color-muted-fill)] animate-pulse rounded mx-auto" />
                ) : (
                  <ComparisonHeadline rows={rows ?? []} />
                )}
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
                  <tbody className="bg-[var(--color-panel)]">
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
    <section id="dataset" className="px-6 py-32 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={revealSpring}
              className="text-left"
            >
              <div className="flex items-baseline gap-4 mb-6">
                <h2 className="font-display text-4xl font-semibold tracking-tighter text-[var(--color-ink)]">The flight data archive</h2>
              </div>
              <p className="text-lg text-[var(--color-body)] leading-relaxed mb-12 max-w-md">
                Our dataset provides high-fidelity trajectories of AI agents solving real-world coding tasks.
                Each entry contains a full sequence of thoughts, tool calls, and environment responses.
              </p>
              <p className="font-mono text-sm leading-relaxed text-[var(--color-body)]">
                Every trajectory exports as JSONL.{' '}
                <a
                  href={api.exportDatasetUrl()}
                  download
                  className="text-[var(--color-ink)] underline underline-offset-4 transition-colors hover:text-[var(--color-amber)]"
                >
                  Get the dataset →
                </a>
                <span className="text-[var(--color-border)]">{' · '}</span>
                <button
                  onClick={openDatasheet}
                  className="text-[var(--color-ink)] underline underline-offset-4 transition-colors hover:text-[var(--color-amber)]"
                >
                  Read the datasheet →
                </button>
              </p>
            </motion.div>
          </div>
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={revealSpring}
              className="relative z-10"
            >
              <MiniReplay />
            </motion.div>

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
            className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 shadow-2xl"
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
