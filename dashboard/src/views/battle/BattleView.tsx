import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { api } from "../../api";
import { cn } from "../../lib/utils";
import { Dropdown } from "../../components/ui/Dropdown";

const blackBoxSpring = {
  type: "spring",
  stiffness: 260,
  damping: 26,
} as const;

export default function BattleView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ taskId: string; modelA: string; modelB: string } | null>(null);

  const taskId = searchParams.get("task_id");
  const modelA = searchParams.get("model_a");
  const modelB = searchParams.get("model_b");
  const hasParams = !!(taskId && modelA && modelB);

  useEffect(() => {
    if (!hasParams) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.battle(taskId!, modelA!, modelB!)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [taskId, modelA, modelB, hasParams]);

  const handleLiveDone = (t: string, a: string, b: string) => {
    setLoading(true);
    api.battle(t, a, b)
      .then((d) => {
        setLive(null);
        setData(d);
      })
      .catch((e) => {
        setLive(null);
        setError(String(e));
      })
      .finally(() => setLoading(false));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={blackBoxSpring}
      className="px-6 py-12"
    >
      <div className="mb-12 max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-amber)]">
          SYS_LOG // MODEL_BATTLE
        </p>
        <h1 className="mt-3 text-5xl font-display font-bold tracking-tighter text-[var(--color-ink)]">
          Model Battle
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-body)]">
          Same broken repo, two models, head to head. Compare their trajectories
          step by step — who solves it faster, and whose code the judge prefers.
        </p>
      </div>

      {loading ? (
        <BattleSkeleton />
      ) : live ? (
        <LiveBattle
          taskId={live.taskId}
          modelA={live.modelA}
          modelB={live.modelB}
          onDone={() => handleLiveDone(live.taskId, live.modelA, live.modelB)}
          onCancel={() => setLive(null)}
        />
      ) : !hasParams ? (
        <BattlePicker
          onStart={(t, a, b) => setSearchParams({ task_id: t, model_a: a, model_b: b })}
          onLiveStart={(t, a, b) => {
            setData(null);
            setError(null);
            setLive({ taskId: t, modelA: a, modelB: b });
          }}
        />
      ) : error ? (
        <div className="flex flex-col items-start gap-4 font-mono">
          <span className="text-[var(--color-fail)]">{error}</span>
          <button
            onClick={() => setSearchParams({})}
            className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 text-xs text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors"
          >
            ← Pick a different matchup
          </button>
        </div>
      ) : data ? (
        <BattleResult
          data={data}
          modelA={modelA!}
          modelB={modelB!}
          onReset={() => {
            setData(null);
            setSearchParams({});
          }}
        />
      ) : null}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ picker */

const LIVE_MODELS = [
  { value: "nano", label: "nano — Nemotron 3 Nano" },
  { value: "super", label: "super — Nemotron 3 Super" },
  { value: "ultra", label: "ultra — Nemotron 3 Ultra" },
];

function BattlePicker({
  onStart,
  onLiveStart,
}: {
  onStart: (t: string, a: string, b: string) => void;
  onLiveStart: (t: string, a: string, b: string) => void;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [taskId, setTaskId] = useState("");
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  const [liveMaxSteps, setLiveMaxSteps] = useState(10);

  useEffect(() => {
    Promise.all([api.tasks().catch(() => []), api.leaderboard().catch(() => [])]).then(
      ([tks, lb]) => {
        setTasks(tks);
        const ms = (lb as any[]).map((r) => r.model);
        setModels(ms);
        if (tks.length > 0) setTaskId(tks[0].id);
        if (ms.length > 0) setModelA(ms[0]);
        if (ms.length > 1) setModelB(ms[1]);
      }
    );
    api.health()
      .then((h) => {
        setLiveAvailable(!!h.live_runs?.model_key_configured);
        if (h.live_runs?.max_steps_per_run) setLiveMaxSteps(h.live_runs.max_steps_per_run);
      })
      .catch(() => setLiveAvailable(false));
  }, []);

  useEffect(() => {
    if (liveMode) {
      if (!modelA) setModelA("nano");
      if (!modelB || modelB === modelA) setModelB("super");
    }
  }, [liveMode]);

  const valid = taskId && modelA && modelB && modelA !== modelB;
  const modelOptions = liveMode
    ? LIVE_MODELS
    : models.map((m) => ({ value: m, label: m }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...blackBoxSpring, delay: 0.1 }}
      className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-micro)] mb-6">
        Configure matchup
      </p>
      <div className="space-y-5">
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-body)]">
            Task
          </label>
          <Dropdown
            ariaLabel="Task"
            value={taskId}
            onChange={setTaskId}
            options={tasks.map((t) => ({ value: t.id, label: `${t.id} — ${t.name}` }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-body)]">
              Model A
            </label>
            <Dropdown
              ariaLabel="Model A"
              value={modelA}
              onChange={setModelA}
              options={modelOptions}
            />
          </div>
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-body)]">
              Model B
            </label>
            <Dropdown
              ariaLabel="Model B"
              value={modelB}
              onChange={setModelB}
              options={modelOptions}
            />
          </div>
        </div>
        {modelA === modelB && modelA && (
          <p className="font-mono text-xs text-[var(--color-fail)]">
            Pick two different models to battle.
          </p>
        )}
        {liveAvailable === true && (
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors",
              liveMode
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-ink)]"
                : "border-[var(--color-hairline)] text-[var(--color-body)] hover:border-[var(--color-micro)]"
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  liveMode ? "bg-[var(--color-accent)] animate-pulse" : "bg-[var(--color-micro)]"
                )}
              />
              Live run — solve fresh right now
            </span>
            <span className="text-[10px] opacity-70">{liveMode ? "ON" : "OFF"}</span>
          </button>
        )}
        {liveAvailable === false && (
          <p className="font-mono text-[10px] leading-relaxed text-[var(--color-micro)]">
            Live runs unavailable — no model key configured on the server.
          </p>
        )}
        {liveMode && liveAvailable && (
          <p className="font-mono text-[10px] leading-relaxed text-[var(--color-micro)]">
            Runs both models live, one after the other. Capped at {liveMaxSteps} steps
            per run · one live run at a time.
          </p>
        )}
        <button
          onClick={() =>
            valid && (liveMode ? onLiveStart(taskId, modelA, modelB) : onStart(taskId, modelA, modelB))
          }
          disabled={!valid}
          className="w-full rounded-full bg-[var(--color-amber)] px-8 py-4 text-xs font-mono font-bold text-black transition-all hover:bg-[var(--color-accent-ink)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {liveMode ? "Run live battle" : "Start battle"}
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ live run */

function LiveBattle({
  taskId,
  modelA,
  modelB,
  onDone,
  onCancel,
}: {
  taskId: string;
  modelA: string;
  modelB: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [epA, setEpA] = useState<any>(null);
  const [epB, setEpB] = useState<any>(null);
  const [phase, setPhase] = useState<"a" | "b">("a");
  const [error, setError] = useState<string | null>(null);
  const [waitNote, setWaitNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const pollUntilDone = async (episodeId: string, setEp: (e: any) => void) => {
      for (;;) {
        if (cancelled) throw new Error("__cancelled__");
        const ep = await api.episode(episodeId);
        if (cancelled) throw new Error("__cancelled__");
        setEp(ep);
        if (ep.status === "completed" || ep.status === "failed") return ep;
        await sleep(3000);
      }
    };

    // Start one leg, transparently waiting out the server's rate-limit
    // cooldown so a battle's second leg isn't killed by the first leg
    // finishing fast (e.g. an auth failure).
    const startLeg = async (model: string, setEp: (e: any) => void) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) throw new Error("__cancelled__");
        try {
          const r = await api.runEpisode(taskId, model);
          setWaitNote(null);
          return await pollUntilDone(r.episode_id, setEp);
        } catch (e: any) {
          const msg = e.message || "";
          const m = msg.match(/try again in (\d+)s/);
          if (m && attempt < 4) {
            const waitS = parseInt(m[1], 10) + 2;
            setWaitNote(`Rate limit — starting ${model} in ${waitS}s…`);
            await sleep(waitS * 1000);
            setWaitNote(null);
            continue;
          }
          throw e;
        }
      }
      throw new Error("Rate limit persisted — please try again later.");
    };

    (async () => {
      try {
        const doneA: any = await startLeg(modelA, setEpA);
        if (doneA.status === "failed")
          throw new Error(
            `${modelA} run failed${doneA.judge_reasoning ? ` — ${doneA.judge_reasoning.slice(0, 120)}` : ""} — fix the server model key, then try again.`
          );
        if (cancelled) return;
        setPhase("b");
        const doneB: any = await startLeg(modelB, setEpB);
        if (doneB.status === "failed")
          throw new Error(`${modelB} run failed — try again or pick another model.`);
        if (cancelled) return;
        onDone();
      } catch (e: any) {
        if (!cancelled && e.message !== "__cancelled__")
          setError(e.message || "Live run failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={blackBoxSpring}
      className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8"
    >
      <p className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent-ink)]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
        Live battle in progress
      </p>
      <div className="space-y-4">
        <LiveRow
          label={`Model A · ${modelA}`}
          ep={epA}
          active={phase === "a" && !error}
        />
        <LiveRow
          label={`Model B · ${modelB}`}
          ep={epB}
          active={phase === "b" && !error}
          waiting={phase === "a"}
        />
      </div>
      {error ? (
        <div className="mt-6 flex flex-col items-start gap-4">
          <p className="font-mono text-xs text-[var(--color-fail)]">{error}</p>
          <button
            onClick={onCancel}
            className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 font-mono text-xs text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
          >
            ← Back to setup
          </button>
        </div>
      ) : (
        <p className="mt-6 font-mono text-[10px] leading-relaxed text-[var(--color-micro)]">
          {waitNote ??
            "Each model is solving the task live on the server. Runs are capped at 10 steps — grab a coffee, this takes a few minutes."}
        </p>
      )}
    </motion.div>
  );
}

function LiveRow({
  label,
  ep,
  active,
  waiting = false,
}: {
  label: string;
  ep: any;
  active: boolean;
  waiting?: boolean;
}) {
  const steps = ep?.steps?.length ?? 0;
  const done = ep?.status === "completed";
  const status = done
    ? `done · ${steps} steps${ep.passed ? " · solved" : " · not solved"}`
    : waiting
      ? "queued"
      : active
        ? `solving… ${steps} step${steps === 1 ? "" : "s"}`
        : "starting…";
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3",
        done
          ? "border-[var(--color-accent)]/40"
          : "border-[var(--color-hairline)]"
      )}
    >
      <span className="font-mono text-xs text-[var(--color-ink)]">{label}</span>
      <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-body)]">
        {active && !done && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-amber)]" />
        )}
        {status}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ result */

function BattleResult({
  data,
  modelA,
  modelB,
  onReset,
}: {
  data: any;
  modelA: string;
  modelB: string;
  onReset: () => void;
}) {
  const epA = data.model_a.summary;
  const epB = data.model_b.summary;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const faster = epA.num_steps <= epB.num_steps ? modelA : modelB;
  const stepDiff = Math.abs(epA.num_steps - epB.num_steps);
  const judgeA = epA.judge_score ?? 0;
  const judgeB = epB.judge_score ?? 0;
  const betterJudge = judgeA >= judgeB ? modelA : modelB;
  const split = faster !== betterJudge;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <p className="font-mono text-sm text-[var(--color-soft-ink)]">
          Task: <span className="text-[var(--color-ink)]">{data.task_id}</span>
          <span className="mx-2 text-[var(--color-micro)]">|</span>
          <span className="capitalize">{modelA}</span>
          <span className="mx-2 text-[var(--color-amber)]">vs</span>
          <span className="capitalize">{modelB}</span>
        </p>
        <button
          onClick={onReset}
          className="rounded-sm border border-[var(--color-hairline)] px-4 py-2 text-xs font-mono text-[var(--color-ink)] hover:bg-[var(--color-hairline)] transition-colors"
        >
          ← New matchup
        </button>
      </div>

      {/* Verdict */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...blackBoxSpring, delay: 0.1 }}
        className="relative mb-12 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #76B900, transparent 70%)" }}
        />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
          The verdict
        </p>
        <p className="mt-3 font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          {cap(faster)} is faster
          {stepDiff > 0 && <span className="text-[var(--color-body)]"> by {stepDiff} step{stepDiff === 1 ? "" : "s"}.</span>}
          {split ? (
            <span className="text-[var(--color-body)]"> The judge prefers {betterJudge}.</span>
          ) : (
            <span className="text-[var(--color-body)]"> And the judge agrees.</span>
          )}
        </p>
        <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--color-body)]">
          {cap(modelA)}: {epA.num_steps} steps · judge {judgeA.toFixed(1)} ·{" "}
          {cap(modelB)}: {epB.num_steps} steps · judge {judgeB.toFixed(1)}
        </p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...blackBoxSpring, delay: 0.2 }}
        >
          <BattleColumn model={modelA} ep={epA} color="var(--color-sky-400)" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...blackBoxSpring, delay: 0.3 }}
        >
          <BattleColumn model={modelB} ep={epB} color="var(--color-amber)" />
        </motion.div>
      </div>
    </div>
  );
}

function BattleColumn({ model, ep, color }: { model: string; ep: any; color: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] p-4">
        <span className="text-xl font-display font-bold text-[var(--color-ink)] capitalize">{model}</span>
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
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
            className="rounded-sm border border-[var(--color-hairline)] bg-[var(--color-panel)] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-3 py-1 bg-[var(--color-hairline)]/10">
              <span className="text-[10px] font-mono text-[var(--color-soft-ink)]">Step {s.step}</span>
              <span className="text-[10px] font-mono" style={{ color }}>{s.action?.type}</span>
            </div>
            <div className="p-3">
              <div className="text-xs italic text-[var(--color-soft-ink)] mb-2 line-clamp-2">
                {s.thought}
              </div>
              <div className="font-mono text-[11px] text-[var(--color-ink)] bg-white/5 p-2 rounded-sm truncate">
                {JSON.stringify(s.action)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BattleSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-40 rounded-2xl bg-[var(--color-muted-fill)] animate-pulse" />
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-20 rounded-sm bg-[var(--color-muted-fill)] animate-pulse" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-24 rounded-sm bg-[var(--color-muted-fill)] animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
