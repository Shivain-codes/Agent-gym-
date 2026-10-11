// Shared UI helpers: difficulty badges, model accent colors, formatting.

export const difficultyStyle: Record<string, string> = {
  easy: "text-[var(--color-soft-ink)] border-[var(--color-hairline)]",
  medium: "text-[var(--color-soft-ink)] border-[var(--color-hairline)]",
  hard: "text-[var(--color-amber)] border-[var(--color-amber)]",
  expert: "text-[var(--color-amber)] border-[var(--color-amber)]",
};

export function difficultyClass(d: string): string {
  return (
    difficultyStyle[d] ?? "text-[var(--color-soft-ink)] border-[var(--color-hairline)]"
  );
}

// Accent color per model, used across charts and tables.
export const modelAccent: Record<string, string> = {
  nano: "#8A8F98", // soft ink
  super: "#76B900", // nvidia green
  ultra: "#EDEAE4", // ink
};

export function accentFor(model: string): string {
  return modelAccent[model] ?? "#1E242B";
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function fmt(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined) return "–";
  return x.toFixed(digits);
}

export function actionLabel(action: Record<string, unknown>): string {
  const t = (action?.type as string) ?? "?";
  if (t === "run_command") return `run_command  $ ${action.cmd ?? ""}`;
  if (t === "edit_file") return `edit_file  ${action.path ?? ""}`;
  if (t === "run_tests") return "run_tests";
  if (t === "give_up") return `give_up  (${action.reason ?? ""})`;
  if (t === "invalid_tool") return `invalid_tool  ${action.name ?? ""}`;
  return t;
}

export const actionColor: Record<string, string> = {
  run_command: "text-[var(--color-soft-ink)]",
  edit_file: "text-[var(--color-amber)]",
  run_tests: "text-[var(--color-amber)]",
  give_up: "text-[var(--color-fail)]",
  invalid_tool: "text-[var(--color-soft-ink)]",
};
