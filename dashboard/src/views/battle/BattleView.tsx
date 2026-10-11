import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { api } from "../../api";
import { cn } from "../../lib/utils";

export default function BattleView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taskId = searchParams.get("task_id");
  const modelA = searchParams.get("model_a");
  const modelB = searchParams.get("model_b");

  useEffect(() => {
    if (!taskId || !modelA || !modelB) {
      setError("Missing parameters: task_id, model_a, and model_b are required.");
      setLoading(false);
      return;
    }

    api.battle(taskId, modelA, modelB)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [taskId, modelA, modelB]);

  if (loading) return <div className="flex h-screen items-center justify-center font-mono text-[var(--color-soft-ink)]">Loading Battle...</div>;
  if (error) return <div className="flex h-screen flex-col items-center justify-center gap-4 font-mono text-[var(--color-fail)]">
    <span>{error}</span>
    <button onClick={() => navigate("/replay")} className="text-xs underline text-[var(--color-ink)]">Back to Replay</button>
  </div>;
  if (!data) return null;

  const epA = data.model_a.summary;
  const epB = data.model_b.summary;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 py-12"
    >
      <div className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tighter text-[var(--color-ink)]">Model Battle</h1>
          <p className="mt-2 text-sm text-[var(--color-soft-ink)] font-mono">
            Task: {data.task_id} | {modelA} vs {modelB}
          </p>
        </div>
        <button
          onClick={() => navigate("/replay")}
          className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 text-xs font-mono text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <BattleColumn model={modelA ?? ""} ep={epA} color="var(--color-sky-400)" />
        <BattleColumn model={modelB ?? ""} ep={epB} color="var(--color-amber)" />
      </div>
    </motion.section>
  );
}

function BattleColumn({ model, ep, color }: { model: string; ep: any; color: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] p-4">
        <span className="text-xl font-display font-bold text-[var(--color-ink)]">{model}</span>
        <div className="text-right font-mono text-xs">
          <div className={cn("font-bold", ep.passed ? "text-[var(--color-pass)]" : "text-[var(--color-fail)]")}>
            {ep.passed ? "SOLVED" : "FAILED"}
          </div>
          <div className="text-[var(--color-soft-ink)]">Reward: {ep.final_reward.toFixed(2)}</div>
          <div className="text-[var(--color-soft-ink)]">Steps: {ep.num_steps}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-[var(--color-soft-ink)] font-mono">Trajectory</h3>
        {ep.steps.map((s: any, i: number) => (
          <div key={i} className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-3 py-1 bg-[var(--color-hairline)]/10">
              <span className="text-[10px] font-mono text-[var(--color-soft-ink)]">Step {s.step}</span>
              <span className="text-[10px] font-mono" style={{ color }}>{s.action?.type}</span>
            </div>
            <div className="p-3">
              <div className="text-xs italic text-[var(--color-soft-ink)] mb-2 line-clamp-2">
                {s.thought}
              </div>
              <div className="font-mono text-[11px] text-[var(--color-ink)] bg-black/5 p-2 rounded-sm truncate">
                {JSON.stringify(s.action)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
