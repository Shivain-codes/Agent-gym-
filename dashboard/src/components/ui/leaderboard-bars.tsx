import { useEffect, useMemo, useRef, useState } from "react";

/**
 * LeaderboardBars — adapted from 21st.dev "Leaderboard Table" (eugeneshilow).
 * One row per model: badge + name, score as a horizontal bar in the model's
 * accent color, numeric economy columns on the right. Answers the 2-second
 * question: "who leads on quality, and what does that quality cost?"
 *
 * Adaptations for AgentGym (all data is real — nothing invented):
 * - Score = judge score x10 (0-100 scale). No +/-std whiskers: we don't
 *   track per-model score spread, so none is drawn.
 * - "Best" mode shows the aggregate row per model (runs[0]); "All" mode
 *   expands every model x task cell as its own row (variant = task id).
 * - Model colors come from lib/ui accentFor (the established per-model
 *   mapping), not the component's categorical palette.
 * - Light-theme --vz-* tokens remapped to the AgentGym dark theme.
 * - 'use client' removed (Vite, not Next.js).
 *
 * Motion: rows slide to their new rank via translateY, bars re-stretch;
 * hovering a row focuses it (others dim, the bar thickens); entering the
 * viewport grows bars from the left with a stagger. All disabled under
 * prefers-reduced-motion.
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

export type LeaderboardRun = {
  /** e.g. task id — rendered as [task-id]; omit for the aggregate row */
  variant?: string;
  /** score 0-100, bar length */
  score: number;
  /** X value per column key: { steps: 5.9, episodes: 12, pass: 100 } */
  x: Record<string, number>;
};

export type LeaderboardModel = {
  /** name as shown in the row: 'ultra' */
  id: string;
  /** series color — pass accentFor(model) */
  color?: string;
  /** vendor badge letter; defaults to first letter of id */
  badge?: string;
  runs: LeaderboardRun[];
};

export type LeaderboardVersion = {
  key: string;
  /** toggle button text */
  label: string;
  models: LeaderboardModel[];
};

export type LeaderboardColumn = {
  /** value key in run.x: 'steps' */
  key: string;
  /** column header (rendered uppercase): 'steps' */
  label: string;
  prefix?: string;
  suffix?: string;
  /** digits after the decimal point; default 0 */
  decimals?: number;
};

/** clean tick step from {1, 2, 2.5, 5} x 10^k, at most maxTicks divisions */
function niceStep(max: number, maxTicks = 5): number {
  if (max <= 0) return 1;
  const bases = [1, 2, 2.5, 5];
  for (let exp = -2; exp <= 12; exp++) {
    for (const b of bases) {
      const step = b * 10 ** exp;
      if (max / step <= maxTicks) return step;
    }
  }
  return max;
}

const ROW_H = 48;
const EASE = "cubic-bezier(.22, 1, .36, 1)";
const MOTION_CSS = `
.vlb-rows { transition: height .55s ${EASE}; }
.vlb-row { transition: transform .55s ${EASE}, opacity .25s ease, background-color .15s ease; }
.vlb-rows:hover .vlb-row:not(:hover) { opacity: .38; }
.vlb-row:hover { background-color: var(--color-muted-fill); }
.vlb-bar { transition: width .55s ${EASE}; transform-origin: left center; }
.vlb-barbox { transition: height .18s ease; }
.vlb-row:hover .vlb-barbox { height: 19px; }
.vlb-dim { color: var(--color-body); transition: color .15s ease; }
.vlb-row:hover .vlb-dim { color: var(--color-ink); }
.vlb-fadein { animation: vlb-fadein .35s ease both; }
@keyframes vlb-fadein { from { opacity: 0; } }
.vlb-enter .vlb-bar { animation: vlb-grow .8s ${EASE} both; animation-delay: var(--vlb-d, 0ms); }
@keyframes vlb-grow { from { transform: scaleX(0); } }
.vlb-enter .vlb-late { animation: vlb-fadein .45s ease both; animation-delay: calc(var(--vlb-d, 0ms) + 260ms); }
.vlb-pop { animation: vlb-pop .18s cubic-bezier(.34, 1.56, .64, 1) both; }
@keyframes vlb-pop { from { opacity: 0; transform: scale(.92) translateY(3px); } }
@media (prefers-reduced-motion: reduce) {
  .vlb-rows, .vlb-row, .vlb-bar, .vlb-barbox, .vlb-dim { transition: none !important; }
  .vlb-enter .vlb-bar, .vlb-enter .vlb-late, .vlb-fadein, .vlb-pop { animation: none !important; }
  .vlb-rows:hover .vlb-row:not(:hover) { opacity: 1; }
}
`;

export function LeaderboardBars({
  versions,
  columns,
  meta,
  footnote,
  xMax: xMaxProp,
  scoreSuffix = "%",
  scoreLabel = "judge",
  modelColLabel = "model",
  bestLabel = "Best",
  allRunsLabel = "Per task",
  modelsLabel = "Models",
  allLabel = "all",
}: {
  versions: LeaderboardVersion[];
  /** numeric columns right of the score, keyed into run.x */
  columns: LeaderboardColumn[];
  /** string right of the toggles: '3 models · 24 episodes' */
  meta?: string;
  /** footnote under the board */
  footnote?: string;
  /** score-scale ceiling; default: nice step above max(score) */
  xMax?: number;
  scoreSuffix?: string;
  scoreLabel?: string;
  modelColLabel?: string;
  bestLabel?: string;
  allRunsLabel?: string;
  modelsLabel?: string;
  allLabel?: string;
}) {
  const [versionKey, setVersionKey] = useState(versions[0]?.key);
  const [mode, setMode] = useState<"best" | "all">("best");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setEntered(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const version = versions.find((v) => v.key === versionKey) ?? versions[0];
  const models = useMemo(() => version?.models ?? [], [version]);
  const visible = models.filter((m) => !hiddenIds.includes(m.id));

  const rows = useMemo(() => {
    const out = visible.flatMap((m) => {
      // "Best" = the aggregate row per model (runs[0]); "All" = every run.
      const runs = mode === "best" ? [m.runs[0]].filter(Boolean) : m.runs;
      return runs.map((run) => ({ model: m, run }));
    });
    out.sort(
      (a, b) => b.run.score - a.run.score || a.model.id.localeCompare(b.model.id)
    );
    return out;
  }, [visible, mode]);

  /* scale spans all models of the version (not the filter) so the axis stays put */
  const axisMax = useMemo(() => {
    if (xMaxProp) return xMaxProp;
    const max = Math.max(1, ...models.flatMap((m) => m.runs.map((r) => r.score)));
    const step = niceStep(max * 1.02);
    return step * Math.ceil((max * 1.02) / step);
  }, [models, xMaxProp]);
  const tickStep = niceStep(axisMax);
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += tickStep) ticks.push(r2(t));

  const pct = (v: number) => `${r2((v / axisMax) * 100)}%`;
  const fmtVal = (v: number, c: LeaderboardColumn) =>
    `${c.prefix ?? ""}${c.decimals != null ? v.toFixed(c.decimals) : Math.round(v)}${c.suffix ?? ""}`;

  const toggleModel = (id: string) =>
    setHiddenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const seg =
    "border border-[var(--color-border)] px-3.5 py-1.5 text-[13.5px] font-medium leading-none transition-all duration-150 active:scale-[0.94]";
  const segActive =
    "bg-[var(--color-ink)] text-[var(--color-bg)] border-[var(--color-ink)]";
  const segIdle =
    "bg-[var(--color-panel)] text-[var(--color-ink)] hover:bg-[var(--color-muted-fill)]";

  return (
    <div
      ref={rootRef}
      className={`text-[var(--color-ink)] [font-variant-numeric:tabular-nums] ${entered ? "vlb-enter" : ""}`}
    >
      <style>{MOTION_CSS}</style>
      {/* control panel */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {versions.length > 1 ? (
          <div className="flex -space-x-px">
            {versions.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVersionKey(v.key)}
                className={`${seg} first:rounded-l-[5px] last:rounded-r-[5px] ${v.key === version.key ? segActive : segIdle}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex -space-x-px">
          {(
            [
              ["best", bestLabel],
              ["all", allRunsLabel],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`${seg} first:rounded-l-[5px] last:rounded-r-[5px] ${mode === key ? segActive : segIdle}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {meta ? (
            <p className="font-mono text-[13.5px] text-[var(--color-micro)]">{meta}</p>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className={`${seg} rounded-[5px] ${segIdle}`}
            >
              {modelsLabel} ({visible.length}/{models.length}) <span aria-hidden>⌄</span>
            </button>
            {menuOpen ? (
              <div className="vlb-pop absolute right-0 z-10 mt-1 max-h-72 w-60 origin-top-right overflow-auto rounded-[5px] border border-[var(--color-border)] bg-[var(--color-panel)] py-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setHiddenIds([])}
                  className="block w-full px-3 py-1.5 text-left text-[12px] uppercase tracking-[0.08em] text-[var(--color-micro)] hover:bg-[var(--color-muted-fill)]"
                >
                  {allLabel}
                </button>
                {models.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13.5px] hover:bg-[var(--color-muted-fill)]"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenIds.includes(m.id)}
                      onChange={() => toggleModel(m.id)}
                      className="accent-[#76B900]"
                    />
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.id}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* the board */}
      <div className="relative mt-4 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="overflow-x-auto px-4 pt-3 md:px-5">
          <div className="min-w-[700px] pb-6">
            {/* column header */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-1 pb-2.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-micro)]">
              <div className="w-[215px] shrink-0">{modelColLabel}</div>
              <div className="min-w-[100px] flex-1" />
              <div className="w-[84px] shrink-0 text-right">{scoreLabel}</div>
              {columns.map((c) => (
                <div key={c.key} className="w-[68px] shrink-0 text-right">
                  {c.label}
                </div>
              ))}
            </div>

            {/* rows: absolute + translateY by rank — morphs on toggle */}
            <div className="vlb-rows relative" style={{ height: rows.length * ROW_H }}>
              {rows.map(({ model: m, run }, i) => (
                <div
                  key={`${m.id}::${run.variant ?? "solo"}`}
                  className="vlb-row vlb-fadein absolute left-0 right-0 flex items-center gap-3 border-b border-[var(--color-border)] px-1"
                  style={{
                    transform: `translateY(${i * ROW_H}px)`,
                    height: ROW_H,
                    ["--vlb-d" as string]: `${i * 55}ms`,
                  }}
                >
                  <div className="flex w-[215px] shrink-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--color-ink)] text-[11px] font-bold text-[var(--color-bg)]"
                    >
                      {m.badge ?? m.id[0]?.toUpperCase()}
                    </span>
                    <span className="truncate font-mono text-[13px] font-semibold capitalize">
                      {m.id}
                      {run.variant ? (
                        <span className="font-normal text-[var(--color-micro)]">
                          {" "}
                          [{run.variant}]
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="vlb-barbox relative h-[14px] min-w-[100px] flex-1">
                    <div className="absolute inset-0 rounded-r-[4px] bg-[var(--color-muted-fill)]" />
                    <div
                      className="vlb-bar absolute inset-y-0 left-0 rounded-r-[4px]"
                      style={{
                        width: pct(run.score),
                        backgroundColor: m.color,
                      }}
                    />
                  </div>
                  <div className="vlb-late w-[84px] shrink-0 whitespace-nowrap text-right">
                    <span className="font-mono text-[15px] font-semibold">
                      {run.score.toFixed(1)}
                      {scoreSuffix}
                    </span>
                  </div>
                  {columns.map((c) => (
                    <div
                      key={c.key}
                      className="vlb-dim vlb-late w-[68px] shrink-0 whitespace-nowrap text-right font-mono text-[13.5px]"
                    >
                      {fmtVal(run.x[c.key] ?? 0, c)}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* score axis under the bars */}
            <div className="flex items-center gap-3 px-1 pt-2">
              <div className="w-[215px] shrink-0" />
              <div className="relative h-[16px] min-w-[100px] flex-1">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute top-0 -translate-x-1/2 font-mono text-[11.5px] text-[var(--color-micro)]"
                    style={{ left: pct(t) }}
                  >
                    {t}
                    {scoreSuffix}
                  </span>
                ))}
              </div>
              <div className="w-[84px] shrink-0" />
              {columns.map((c) => (
                <div key={c.key} className="w-[68px] shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {footnote ? (
        <p className="mt-3 font-mono text-[13px] leading-6 text-[var(--color-body)]">{footnote}</p>
      ) : null}
    </div>
  );
}
