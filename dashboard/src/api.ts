// API client for the AgentGym backend.
// Base URL is configurable via VITE_API_BASE. When unset:
// - localhost dev (Vite on :5173) -> local FastAPI on :8000
// - any deployed host -> same origin (backend serves the frontend)

function defaultBase(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    // Deployed single-service: API lives under /api on the same origin.
    if (h !== "localhost" && h !== "127.0.0.1") return "/api";
  }
  // Local dev: Vite on :5173, FastAPI on :8000.
  return "http://127.0.0.1:8000/api";
}

const BASE = import.meta.env.VITE_API_BASE ?? defaultBase();

export interface TaskOut {
  id: string;
  name: string;
  prompt: string;
  difficulty: string;
  tags: string[];
}

export interface LeaderboardRow {
  model: string;
  episodes: number;
  pass_rate: number;
  avg_reward: number;
  avg_steps: number;
  avg_judge_score: number | null;
}

export interface MatrixCell {
  model: string;
  task_id: string;
  episodes: number;
  pass_rate: number;
  avg_steps: number;
  avg_judge_score: number | null;
}

export interface EpisodeSummary {
  episode_id: string;
  task_id: string;
  model: string;
  num_steps: number;
  final_reward: number;
  passed: boolean;
  judge_score: number | null;
  status: string;
  is_fixture: boolean;
}

export interface StepEvent {
  type: string;
  step: number;
  thought: string;
  action: Record<string, unknown>;
  observation: string;
  reward: number;
  reward_so_far: number;
}

export interface EpisodeOut {
  episode_id: string;
  task_id: string;
  model: string;
  steps: StepEvent[];
  final_reward: number;
  passed: boolean;
  judge_score: number | null;
  judge_reasoning: string;
  status: string;
  is_fixture: boolean;
  metadata: Record<string, unknown>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  tasks: () => get<TaskOut[]>("/tasks"),
  leaderboard: () => get<LeaderboardRow[]>("/leaderboard"),
  matrix: () => get<MatrixCell[]>("/leaderboard/matrix"),
  episodes: () => get<EpisodeSummary[]>("/episodes"),
  fixtures: () => get<EpisodeSummary[]>("/fixtures"),
  episode: (id: string) => get<EpisodeOut>(`/episodes/${id}`),
  getFileAtStep: (episodeId: string, stepIndex: number, path: string) =>
    get<string>(`/episodes/${episodeId}/file/${stepIndex}/${path}`),
  getDiagnostics: (episodeId: string) =>
    get<any[]>(`/episodes/${episodeId}/diagnostics`),
  battle: (taskId: string, modelA: string, modelB: string) =>
    get<any>(`/episodes/battle?task_id=${taskId}&model_a=${modelA}&model_b=${modelB}`),
  exportDatasetUrl: () => `${BASE}/export/dataset`,
  datasheet: async (): Promise<string> => {
    const res = await fetch(`${BASE}/export/datasheet`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for /export/datasheet`);
    return res.text();
  },
};

export { BASE as API_BASE };
