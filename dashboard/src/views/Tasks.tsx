import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type TaskOut, type MatrixCell } from "../api";
import { difficultyClass } from "../lib/ui";
import { cn } from "../lib/utils";
import { BlackBoxPanel } from "../components/ui/BlackBoxPanel";
import { ChevronDown, ChevronUp } from "lucide-react";

const blackBoxSpring = {
  type: "spring",
  stiffness: 260,
  damping: 26,
};

const ORDER = ["easy", "medium", "hard", "expert"];

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskOut[] | null>(null);
  const [matrix, setMatrix] = useState<MatrixCell[] | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.tasks(), api.matrix()])
      .then(([tks, mat]) => {
        setTasks(tks);
        setMatrix(mat);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tasks ?? []) c[t.difficulty] = (c[t.difficulty] ?? 0) + 1;
    return c;
  }, [tasks]);

  const getTaskStats = (taskId: string) => {
    if (!matrix) return null;
    const taskData = matrix.filter(m => m.task_id === taskId);
    if (taskData.length === 0) return null;

    return {
      episodes: taskData.reduce((acc, m) => acc + m.episodes, 0),
      avgSteps: (taskData.reduce((acc, m) => acc + m.avg_steps, 0) / taskData.length).toFixed(1),
      avgJudge: (taskData.reduce((acc, m) => acc + (m.avg_judge_score ?? 0), 0) / taskData.length).toFixed(2),
      passRate: (taskData.reduce((acc, m) => acc + m.pass_rate, 0) / taskData.length * 100).toFixed(1)
    };
  };

  if (error)
    return <div className="text-[var(--color-fail)] font-mono">Failed to load tasks: {error}</div>;
  if (!tasks) return <div className="text-[var(--color-body)] font-mono">Loading tasks…</div>;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={blackBoxSpring}
      className="px-6 py-12"
    >
      <div className="flex items-end justify-between mb-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-display font-bold tracking-tighter text-[var(--color-ink)]">Tasks</h1>
          <p className="mt-2 text-sm text-[var(--color-body)] font-mono uppercase tracking-widest">
            {tasks.length} broken-repo challenges // agent scoring set
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {ORDER.filter((d) => counts[d]).map((d) => (
            <span
              key={d}
              className={cn(
                "rounded-sm px-2.5 py-1 font-mono font-medium border border-[var(--color-border)] bg-[var(--color-panel)]",
                difficultyClass(d)
              )}
            >
              {counts[d]} {d}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map((t, i) => {
          const stats = getTaskStats(t.id);
          const isExpanded = expandedTask === t.id;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...blackBoxSpring,
                delay: (i % 10) * 0.05,
              }}
            >
              <div
                onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                className="cursor-pointer group"
              >
                <BlackBoxPanel
                  title={`TASK_${t.id.toUpperCase()}`}
                  technical
                  className="transition-all group-hover:border-[var(--color-amber)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--color-body)]">{t.id}</span>
                        <span
                          className={cn(
                            "rounded-sm px-2 py-0.5 text-[10px] font-mono font-medium border border-[var(--color-border)] bg-[var(--color-bg)]",
                            difficultyClass(t.difficulty)
                          )}
                        >
                          {t.difficulty}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">{t.name}</h3>
                    </div>

                    <div className="flex items-center gap-6">
                      {stats && (
                        <div className="hidden md:flex items-center gap-4 font-mono text-xs">
                          <div className="flex flex-col items-end">
                            <span className="text-[var(--color-micro)] uppercase text-[9px]">Pass Rate</span>
                            <span className="text-[var(--color-ink)] font-bold">{stats.passRate}%</span>
                          </div>
                        </div>
                      )}
                      <div className={cn(
                        "p-1 rounded-full transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6 mt-4 border-t border-[var(--color-border)] grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="text-sm text-[var(--color-body)] leading-relaxed font-mono mb-4">
                              {t.prompt}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                            <div className="p-3 rounded-lg bg-[var(--color-soft-fill)] border border-[var(--color-border)]">
                              <div className="text-[var(--color-micro)] uppercase text-[9px] mb-1">Episodes Run</div>
                              <div className="text-lg font-bold text-[var(--color-ink)]">{stats?.episodes ?? 0}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-soft-fill)] border border-[var(--color-border)]">
                              <div className="text-[var(--color-micro)] uppercase text-[9px] mb-1">Avg Steps</div>
                              <div className="text-lg font-bold text-[var(--color-ink)]">{stats?.avgSteps ?? '–'}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-soft-fill)] border border-[var(--color-border)]">
                              <div className="text-[var(--color-micro)] uppercase text-[9px] mb-1">Avg Judge</div>
                              <div className="text-lg font-bold text-[var(--color-amber)]">{stats?.avgJudge ?? '–'}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-soft-fill)] border border-[var(--color-border)]">
                              <div className="text-[var(--color-micro)] uppercase text-[9px] mb-1">Success Rate</div>
                              <div className="text-lg font-bold text-[var(--color-pass)]">{stats?.passRate ?? '0'}%</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </BlackBoxPanel>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
