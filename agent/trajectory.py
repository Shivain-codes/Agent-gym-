"""Trajectory data structures and JSONL logging for AgentGym.

A trajectory is the full record of an episode: the task, every step the agent
took (thought/action/observation/reward), and the final reward. Trajectories
are streamed to JSONL as the episode runs and reused as training data.

File layout: ``trajectories/{task_id}_{model}_{timestamp}.jsonl``.
  - line 1: a ``{"type": "meta", ...}`` header (episode id, task, model, start).
  - one line per step: ``{"type": "step", step, action, observation,
    reward_so_far}``.
  - final line: a ``{"type": "result", final_reward, passed, ...}`` summary.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TRAJECTORY_DIR = Path(__file__).resolve().parent.parent / "trajectories"


@dataclass
class Step:
    """A single agent step within an episode."""

    index: int
    thought: str = ""
    action: dict[str, Any] = field(default_factory=dict)
    observation: str = ""
    reward: float = 0.0
    reward_so_far: float = 0.0
    snapshot: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": "step",
            "step": self.index,
            "thought": self.thought,
            "action": self.action,
            "observation": self.observation,
            "reward": self.reward,
            "reward_so_far": self.reward_so_far,
            "snapshot": self.snapshot,
        }


@dataclass
class Trajectory:
    """The complete record of one episode."""

    episode_id: str
    task_id: str
    model: str
    steps: list[Step] = field(default_factory=list)
    final_reward: float = 0.0
    passed: bool = False
    judge_score: int | None = None
    judge_reasoning: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "episode_id": self.episode_id,
            "task_id": self.task_id,
            "model": self.model,
            "steps": [s.to_dict() for s in self.steps],
            "final_reward": self.final_reward,
            "passed": self.passed,
            "judge_score": self.judge_score,
            "judge_reasoning": self.judge_reasoning,
            "metadata": self.metadata,
        }


def make_episode_id(task_id: str, model: str, when: float | None = None) -> str:
    """Build the ``{task_id}_{model}_{timestamp}`` episode id / filename stem."""
    ts = datetime.fromtimestamp(when or time.time(), tz=timezone.utc)
    stamp = ts.strftime("%Y%m%dT%H%M%S") + f"{ts.microsecond // 1000:03d}"
    safe_model = model.replace("/", "-")
    return f"{task_id}_{safe_model}_{stamp}"


class TrajectoryWriter:
    """Streams a trajectory to a JSONL file, one line per event."""

    def __init__(self, episode_id: str, directory: Path | str = TRAJECTORY_DIR) -> None:
        self.episode_id = episode_id
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / f"{episode_id}.jsonl"
        # Truncate / create.
        self.path.write_text("", encoding="utf-8")

    def _append(self, obj: dict[str, Any]) -> None:
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(obj) + "\n")

    def write_meta(self, task_id: str, model: str, **extra: Any) -> None:
        self._append(
            {
                "type": "meta",
                "episode_id": self.episode_id,
                "task_id": task_id,
                "model": model,
                "started_at": datetime.now(timezone.utc).isoformat(),
                **extra,
            }
        )

    def write_step(self, step: Step) -> None:
        self._append(step.to_dict())

    def write_result(self, final_reward: float, passed: bool, **extra: Any) -> None:
        self._append(
            {
                "type": "result",
                "episode_id": self.episode_id,
                "final_reward": final_reward,
                "passed": passed,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                **extra,
            }
        )
