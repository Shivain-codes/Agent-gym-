"""Storage layer for AgentGym episodes.

The agent loop writes one JSONL file per episode under ``trajectories/``
(``{task_id}_{model}_{timestamp}.jsonl``) with a meta line, one line per step,
and a result line. This module reads those files to serve the API, and keeps a
small in-memory registry of run status for episodes kicked off in the
background.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any
from functools import lru_cache

TRAJECTORY_DIR = Path(__file__).resolve().parent.parent / "trajectories"
# Golden demo fixtures (recorded episodes) that replay identically to live ones.
FIXTURE_DIR = TRAJECTORY_DIR / "fixtures"

# In-memory status for background runs: episode_id -> {status, task_id, model,...}
_registry: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()

# Cache for summarized episodes to avoid redundant JSONL reads
_episode_cache: dict[str, dict[str, Any]] = {}

TRAJECTORY_DIR = Path(__file__).resolve().parent.parent / "trajectories"
# Golden demo fixtures (recorded episodes) that replay identically to live ones.
FIXTURE_DIR = TRAJECTORY_DIR / "fixtures"

# In-memory status for background runs: episode_id -> {status, task_id, model,...}
_registry: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()

# Cache for summarized episodes to avoid redundant JSONL reads
_episode_cache: dict[str, dict[str, Any]] = {}


# -- run registry ----------------------------------------------------------

def register_run(episode_id: str, task_id: str, model: str) -> None:
    with _lock:
        _registry[episode_id] = {
            "episode_id": episode_id,
            "task_id": task_id,
            "model": model,
            "status": "running",
        }


def update_run(episode_id: str, **fields: Any) -> None:
    with _lock:
        if episode_id in _registry:
            _registry[episode_id].update(fields)
            # Invalidate cache when run status changes
            if episode_id in _episode_cache:
                del _episode_cache[episode_id]


def get_run(episode_id: str) -> dict[str, Any] | None:
    with _lock:
        return dict(_registry[episode_id]) if episode_id in _registry else None


# -- trajectory files -------------------------------------------------------

def trajectory_path(episode_id: str) -> Path:
    """Resolve an episode's JSONL file, checking live dir then fixtures."""
    live = TRAJECTORY_DIR / f"{episode_id}.jsonl"
    if live.exists():
        return live
    return FIXTURE_DIR / f"{episode_id}.jsonl"


def read_trajectory_lines(episode_id: str) -> list[dict[str, Any]]:
    """Return every JSONL event (meta/step/result) for an episode, in order."""
    path = trajectory_path(episode_id)
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def iter_trajectory_raw(episode_id: str):
    """Yield raw JSONL lines (strings) for streaming responses."""
    path = trajectory_path(episode_id)
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield line if line.endswith("\n") else line + "\n"


def _list_episode_ids() -> list[str]:
    ids: set[str] = set()
    if TRAJECTORY_DIR.exists():
        ids.update(p.stem for p in TRAJECTORY_DIR.glob("*.jsonl"))
    if FIXTURE_DIR.exists():
        ids.update(p.stem for p in FIXTURE_DIR.glob("*.jsonl"))
    return sorted(ids)


def list_fixture_ids() -> list[str]:
    if not FIXTURE_DIR.exists():
        return []
    return sorted(p.stem for p in FIXTURE_DIR.glob("*.jsonl"))


def summarize_episode(episode_id: str) -> dict[str, Any] | None:
    """Collapse an episode's JSONL into a single summary dict.

    Completed trajectories are immutable and cached indefinitely.
    Running trajectories are cached with a short TTL (via manual check).
    """
    # Check if we have a cached version
    if episode_id in _episode_cache:
        cached = _episode_cache[episode_id]
        # If it was completed, return immediately
        if cached.get("status") == "completed":
            return cached
        # For running episodes, we only use cache if it's very fresh (< 1s)
        # (Simplified here: we just re-read running episodes for accuracy)

    events = read_trajectory_lines(episode_id)
    if not events:
        # Maybe it is still running with nothing flushed yet.
        return get_run(episode_id)

    meta = next((e for e in events if e.get("type") == "meta"), {})
    steps = [e for e in events if e.get("type") == "step"]
    result = next((e for e in events if e.get("type") == "result"), None)

    is_fixture = episode_id in set(list_fixture_ids())
    summary: dict[str, Any] = {
        "episode_id": episode_id,
        "task_id": meta.get("task_id"),
        "model": meta.get("model"),
        "steps": steps,
        "num_steps": len(steps),
        "final_reward": (result or {}).get("final_reward", 0.0),
        "passed": (result or {}).get("passed", False),
        "judge_score": (result or {}).get("judge_score"),
        "judge_reasoning": (result or {}).get("judge_reasoning", ""),
        "status": "completed" if result else "running",
        "is_fixture": is_fixture,
        "metadata": {
            "backend": meta.get("backend"),
            "model_id": meta.get("model_id"),
        },
    }
    # Overlay any registry status (e.g. "failed") if present.
    run = get_run(episode_id)
    if run and not result:
        summary["status"] = run.get("status", summary["status"])

    # Cache the result
    _episode_cache[episode_id] = summary
    return summary


def list_episode_summaries() -> list[dict[str, Any]]:
    out = []
    for eid in _list_episode_ids():
        s = summarize_episode(eid)
        if s:
            out.append(s)
    return out


def analyze_failure_patterns(episode_id: str) -> list[dict[str, Any]]:
    """Analyze a trajectory for common failure modes."""
    events = read_trajectory_lines(episode_id)
    steps = [e for e in events if e.get("type") == "step"]

    diagnostics = []

    # 1. Detect Edit Loops
    # Look for repeated edits to the same file with minimal content change
    edit_history: dict[str, list[int]] = {}
    for i, s in enumerate(steps):
        a = s.get("action", {})
        if a.get("type") == "edit_file":
            path = a.get("path", "unknown")
            edit_history.setdefault(path, []).append(i)

    for path, indices in edit_history.items():
        if len(indices) >= 3:
            # If the same file is edited 3+ times in a short window, it's a potential loop
            diagnostics.append({
                "type": "edit_loop",
                "path": path,
                "steps": indices,
                "description": f"Agent edited {path} {len(indices)} times; potential loop."
            })

    # 2. Detect Regression Cycles
    # Track test state changes
    test_states = []
    for s in steps:
        # We don't have the full state in the JSONL, but we can infer from observations
        # or we can just look at the final reward vs step rewards.
        # Since we now have the dense reward, we can check for negative rewards.
        pass

    # 3. Command Spam
    # Detect repeated ls/cat/pwd without edits
    cmd_counts = {}
    for s in steps:
        a = s.get("action", {})
        if a.get("type") == "run_command":
            cmd = a.get("cmd", "")
            if cmd in ["ls", "ls -la", "pwd", "cat"]:
                cmd_counts[cmd] = cmd_counts.get(cmd, 0) + 1

    for cmd, count in cmd_counts.items():
        if count > 5:
            diagnostics.append({
                "type": "command_spam",
                "cmd": cmd,
                "count": count,
                "description": f"Agent ran `{cmd}` {count} times; redundant exploration."
            })

    return diagnostics


def get_file_at_step(episode_id: str, step_index: int, path: str) -> str | None:
    """Retrieve the content of a specific file at a specific step index."""
    events = read_trajectory_lines(episode_id)
    # Find the most recent 'step' event that edited this path before or at step_index.
    last_content = None
    for e in events:
        if e.get("type") == "step":
            idx = e.get("step")
            if idx is not None and idx <= step_index:
                snapshot = e.get("snapshot", {})
                if path in snapshot:
                    last_content = snapshot[path]
    return last_content
