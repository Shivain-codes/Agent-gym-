"""AgentGym FastAPI application.

Routes:
  - GET  /tasks              list available tasks
  - POST /episodes/run       kick off an agent episode (runs in background)
  - GET  /episodes/{id}      fetch a trajectory (summary JSON)
  - GET  /episodes/{id}/stream   stream the raw trajectory JSONL
  - GET  /leaderboard        Nano vs Super vs Ultra comparison
"""

from __future__ import annotations

import threading
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # make NEBIUS_API_KEY available to the agent loop

from fastapi import FastAPI, HTTPException, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from agent import AgentRunner, make_episode_id
from api import storage
from api.models import (
    EpisodeOut,
    EpisodeSummary,
    LeaderboardRow,
    RunEpisodeRequest,
    RunEpisodeResponse,
    TaskLeaderboardCell,
    TaskOut,
)
from gym import TaskLoader

_DIFFICULTY_LABEL = {1: "easy", 2: "medium", 3: "hard", 4: "expert"}

app = FastAPI(title="AgentGym API", version="0.1.0")

# All API routes live under /api/* so they never collide with frontend pages
# (/tasks and /leaderboard exist as both API endpoints and SPA routes).
router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_loader = TaskLoader("tasks")


@router.get("/health")
def health() -> dict:
    from agent.llm import have_api_key

    return {
        "status": "ok",
        "live_runs": {
            # Live episode runs need a model key on the server; without one
            # the UI hides the live-run controls instead of faking it.
            "model_key_configured": have_api_key(),
            "max_steps_per_run": _LIVE_MAX_STEPS,
        },
    }


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks() -> list[TaskOut]:
    """List available tasks with difficulty badges."""
    return [
        TaskOut(
            id=t.id,
            name=t.title,
            prompt=t.description,
            difficulty=_DIFFICULTY_LABEL.get(t.difficulty, str(t.difficulty)),
        )
        for t in _loader.list_tasks()
    ]


def _run_episode_bg(
    episode_id: str,
    task_id: str,
    model: str,
    max_steps: int,
    require_reproduce: bool,
) -> None:
    """Background worker: run one episode and update the registry."""
    try:
        task = _loader.load(task_id)
    except KeyError:
        storage.update_run(episode_id, status="failed", error="task not found")
        return
    try:
        runner = AgentRunner(
            model=model, max_steps=max_steps, require_reproduce=require_reproduce
        )
        traj = runner.run_episode(task, model=model, episode_id=episode_id)
        storage.update_run(
            episode_id,
            status="completed",
            final_reward=traj["final_reward"],
            passed=traj["passed"],
        )
    except Exception as exc:  # keep the server alive; surface the failure
        storage.update_run(episode_id, status="failed", error=str(exc))


# --- live-run credit guards -------------------------------------------------
# Live episode runs burn real API credits, so they are deliberately throttled:
# one run at a time, capped steps, and a short cooldown between runs.
_LIVE_MAX_STEPS = 10
_LIVE_COOLDOWN_S = 60
_run_lock = threading.Lock()
_last_run_started = 0.0


def _live_run_with_lock(
    episode_id: str,
    task_id: str,
    model: str,
    max_steps: int,
    require_reproduce: bool,
) -> None:
    """Run the episode, then release the single-run lock."""
    try:
        _run_episode_bg(episode_id, task_id, model, max_steps, require_reproduce)
    finally:
        _run_lock.release()


@router.post("/episodes/run", response_model=RunEpisodeResponse)
def run_episode(req: RunEpisodeRequest) -> RunEpisodeResponse:
    """Kick off an agent episode in the background and return its id.

    Credit guards: no model key -> 503 (never fake a "live" run with the
    stub); one run at a time -> 429; steps capped; short cooldown between
    runs so a stray double-click or script can't drain the API key.
    """
    global _last_run_started
    from agent.llm import have_api_key

    if not have_api_key():
        raise HTTPException(
            status_code=503,
            detail="live runs unavailable: no model API key configured on the server",
        )
    try:
        _loader.load(req.task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"task not found: {req.task_id}")

    if not _run_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="a live run is already in progress — please wait for it to finish",
        )
    try:
        now = time.monotonic()
        wait = _LIVE_COOLDOWN_S - (now - _last_run_started)
        if wait > 0:
            raise HTTPException(
                status_code=429,
                detail=f"live runs are rate-limited — try again in {int(wait) + 1}s",
            )
        _last_run_started = now

        max_steps = max(1, min(req.max_steps, _LIVE_MAX_STEPS))
        episode_id = make_episode_id(req.task_id, req.model)
        storage.register_run(episode_id, req.task_id, req.model)

        thread = threading.Thread(
            target=_live_run_with_lock,
            args=(
                episode_id,
                req.task_id,
                req.model,
                max_steps,
                req.require_reproduce,
            ),
            daemon=True,
        )
        thread.start()

        return RunEpisodeResponse(
            episode_id=episode_id,
            task_id=req.task_id,
            model=req.model,
            status="running",
        )
    except HTTPException:
        _run_lock.release()
        raise
    except Exception:
        _run_lock.release()
        raise


@router.get("/episodes", response_model=list[EpisodeSummary])
def list_episodes() -> list[EpisodeSummary]:
    """List all episodes (newest first), without the step payload."""
    rows = [
        EpisodeSummary(
            episode_id=s["episode_id"],
            task_id=s.get("task_id") or "",
            model=s.get("model") or "",
            num_steps=s.get("num_steps", 0),
            final_reward=s.get("final_reward", 0.0),
            passed=s.get("passed", False),
            judge_score=s.get("judge_score"),
            status=s.get("status", "running"),
            is_fixture=s.get("is_fixture", False),
        )
        for s in storage.list_episode_summaries()
    ]
    rows.sort(key=lambda r: r.episode_id, reverse=True)
    return rows


@router.get("/episodes/battle")
def battle_mode(task_id: str, model_a: str, model_b: str):
    """Compare the latest completed episodes for two models on the same task."""
    all_eps = storage.list_episode_summaries()

    def get_latest(model: str):
        matches = [
            e for e in all_eps
            if e["task_id"] == task_id and e["model"] == model and e["status"] == "completed"
        ]
        if not matches:
            return None
        # Sort by episode_id (timestamped)
        return sorted(matches, key=lambda x: x["episode_id"], reverse=True)[0]

    ep_a = get_latest(model_a)
    ep_b = get_latest(model_b)

    if not ep_a or not ep_b:
        raise HTTPException(status_code=404, detail="Could not find completed episodes for both models on this task")

    return {
        "task_id": task_id,
        "model_a": {
            "episode_id": ep_a["episode_id"],
            "summary": ep_a
        },
        "model_b": {
            "episode_id": ep_b["episode_id"],
            "summary": ep_b
        }
    }


@router.get("/export/dataset")
def export_dataset():
    """Bundle all trajectories into a single JSONL and generate a datasheet."""
    bundle_path, _ = _generate_export_files()
    return FileResponse(bundle_path, filename="agentgym_dataset.jsonl")


@router.get("/export/datasheet")
def export_datasheet():
    """Return the generated dataset datasheet as a text file."""
    _, datasheet_path = _generate_export_files()
    return FileResponse(datasheet_path, filename="agentgym_datasheet.txt", media_type="text/plain")


def _generate_export_files():
    """Generate the JSONL bundle + datasheet; return (bundle_path, datasheet_path)."""
    from pathlib import Path

    # NOTE: exports live in trajectories/exports/ (not trajectories/ itself),
    # otherwise _list_episode_ids() would count the bundle as a phantom episode.
    export_dir = Path("trajectories/exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    # 1. Bundle trajectories
    bundle_path = export_dir / "dataset_export.jsonl"
    with bundle_path.open("w", encoding="utf-8") as out:
        for eid in storage._list_episode_ids():
            for line in storage.iter_trajectory_raw(eid):
                out.write(line)
            out.write("\n")

    # 2. Generate simple datasheet
    datasheet_path = export_dir / "datasheet.txt"
    summaries = storage.list_episode_summaries()

    total_eps = len(summaries)
    passed_eps = sum(1 for s in summaries if s.get("passed"))

    with datasheet_path.open("w", encoding="utf-8") as f:
        f.write("AgentGym Dataset Summary\n")
        f.write("========================\n")
        f.write(f"Total Episodes: {total_eps}\n")
        f.write(f"Overall Pass Rate: {(passed_eps/total_eps if total_eps else 0):.2%}\n\n")
        f.write("License: MIT\n")

    return bundle_path, datasheet_path


@router.get("/fixtures", response_model=list[EpisodeSummary])
def list_fixtures() -> list[EpisodeSummary]:
    """List the golden demo fixtures."""
    out = []
    for eid in storage.list_fixture_ids():
        s = storage.summarize_episode(eid)
        if s:
            out.append(
                EpisodeSummary(
                    episode_id=s["episode_id"],
                    task_id=s.get("task_id") or "",
                    model=s.get("model") or "",
                    num_steps=s.get("num_steps", 0),
                    final_reward=s.get("final_reward", 0.0),
                    passed=s.get("passed", False),
                    judge_score=s.get("judge_score"),
                    status=s.get("status", "completed"),
                    is_fixture=True,
                )
            )
    return out


@router.get("/episodes/{episode_id}", response_model=EpisodeOut)
def get_episode(episode_id: str) -> EpisodeOut:
    """Fetch a trajectory summary (meta + steps + result collapsed)."""
    summary = storage.summarize_episode(episode_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="episode not found")

    # Seed the replay viewer with original files for the task.
    # This ensures the first edit shows a true diff against the baseline.
    original_files = {}
    try:
        task = _loader.load(summary["task_id"])
        original_files = task.files
    except Exception:
        pass

    return EpisodeOut(
        episode_id=summary["episode_id"],
        task_id=summary.get("task_id") or "",
        model=summary.get("model") or "",
        steps=summary.get("steps", []),
        final_reward=summary.get("final_reward", 0.0),
        passed=summary.get("passed", False),
        judge_score=summary.get("judge_score"),
        judge_reasoning=summary.get("judge_reasoning", ""),
        status=summary.get("status", "running"),
        is_fixture=summary.get("is_fixture", False),
        metadata={
            **summary.get("metadata", {}),
            "original_files": original_files,
        },
    )


@router.get("/episodes/{episode_id}/stream")
def stream_episode(episode_id: str) -> StreamingResponse:
    """Stream the raw trajectory JSONL (one event per line)."""
    if storage.summarize_episode(episode_id) is None:
        raise HTTPException(status_code=404, detail="episode not found")
    return StreamingResponse(
        storage.iter_trajectory_raw(episode_id),
        media_type="application/x-ndjson",
    )


def _completed_episodes() -> list[dict]:
    return [
        s
        for s in storage.list_episode_summaries()
        if s.get("status") == "completed"
    ]


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


@router.get("/leaderboard", response_model=list[LeaderboardRow])
def leaderboard() -> list[LeaderboardRow]:
    """Aggregate completed episodes per model: pass rate, steps, judge score."""
    episodes = _completed_episodes()
    if not episodes:
        return []

    by_model: dict[str, list[dict]] = {}
    for ep in episodes:
        by_model.setdefault(ep.get("model", "unknown"), []).append(ep)

    rows: list[LeaderboardRow] = []
    for model, eps in by_model.items():
        n = len(eps)
        passed = sum(1 for e in eps if e.get("passed"))
        judge_scores = [
            e["judge_score"] for e in eps if e.get("judge_score") is not None]
        rows.append(
            LeaderboardRow(
                model=model,
                episodes=n,
                pass_rate=round(passed / n, 4) if n else 0.0,
                avg_reward=round(_avg([ep.get("final_reward", 0.0) for ep in eps]), 4),
                avg_steps=round(_avg([ep.get("num_steps", 0) for ep in eps]), 2),
                avg_judge_score=(
                    round(_avg(judge_scores), 2) if judge_scores else None
                ),
            )
        )
    return rows


@router.get("/leaderboard/matrix", response_model=list[TaskLeaderboardCell])
def leaderboard_matrix() -> list[TaskLeaderboardCell]:
    """Models x tasks matrix: pass rate / avg steps / avg judge per cell."""
    episodes = _completed_episodes()
    cells: dict[tuple[str, str], list[dict]] = {}
    for ep in episodes:
        cells.setdefault((ep.get("model", "unknown"), ep.get("task_id", "unknown")), []).append(ep)

    out: list[TaskLeaderboardCell] = []
    for (model, task_id), eps in cells.items():
        n = len(eps)
        passed = sum(1 for e in eps if e.get("passed"))
        judge_scores = [
            e["judge_score"] for e in eps if e.get("judge_score") is not None]
        out.append(
            TaskLeaderboardCell(
                model=model,
                task_id=task_id,
                episodes=n,
                pass_rate=round(passed / n, 4) if n else 0.0,
                avg_steps=round(_avg([e.get("num_steps", 0) for e in eps]), 2),
                avg_judge_score=(
                    round(_avg(judge_scores), 2) if judge_scores else None
                ),
            )
        )
    return out


@router.get("/episodes/{episode_id}/file/{step_index}/{path:path}")
def get_episode_file(episode_id: str, step_index: int, path: str) -> str | None:
    """Retrieve the content of a specific file at a specific step index."""
    content = storage.get_file_at_step(episode_id, step_index, path)
    if content is None:
        raise HTTPException(status_code=404, detail="file state not found at this step")
    return content


@router.get("/episodes/{episode_id}/diagnostics")
def get_episode_diagnostics(episode_id: str):
    """Retrieve failure pattern analysis for an episode."""
    return storage.analyze_failure_patterns(episode_id)


# ---- Single-service deploy ----
# API under /api/*, dashboard static files at /, SPA fallback for frontend
# routes. Order matters: API first, then SPA pages, then static files last.
app.include_router(router, prefix="/api")

_dist_dir = Path(__file__).resolve().parent.parent / "dashboard" / "dist"

# Frontend SPA routes (react-router). Serve index.html for browser navigations
# so deep links and refreshes work on the deployed single URL.
_SPA_PAGES = {"leaderboard", "tasks", "replay", "battle"}


@app.get("/{page}", include_in_schema=False)
@app.get("/{page}/{subpath:path}", include_in_schema=False)
async def _spa_fallback(page: str, request: Request, subpath: str = ""):
    if _dist_dir.is_dir():
        # Real static asset (js/css/images)? serve it directly.
        candidate = _dist_dir / page / subpath if subpath else _dist_dir / page
        if candidate.is_file():
            return FileResponse(candidate)
        # Frontend page navigation? serve the SPA shell.
        wants_html = "text/html" in request.headers.get("accept", "")
        if page in _SPA_PAGES and wants_html:
            return FileResponse(_dist_dir / "index.html")
    raise HTTPException(status_code=404, detail="Not Found")


if _dist_dir.is_dir():
    app.mount("/", StaticFiles(directory=_dist_dir, html=True), name="dashboard")
