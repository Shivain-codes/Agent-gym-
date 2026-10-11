"""Pydantic request/response models for the AgentGym API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TaskOut(BaseModel):
    id: str
    name: str
    prompt: str = ""
    difficulty: str = "medium"
    tags: list[str] = Field(default_factory=list)


class RunEpisodeRequest(BaseModel):
    task_id: str
    model: str = "nano"
    max_steps: int = 25
    require_reproduce: bool = False


class RunEpisodeResponse(BaseModel):
    episode_id: str
    task_id: str
    model: str
    status: str = "queued"


class EpisodeOut(BaseModel):
    episode_id: str
    task_id: str
    model: str
    steps: list[dict[str, Any]] = Field(default_factory=list)
    final_reward: float = 0.0
    passed: bool = False
    judge_score: int | None = None
    judge_reasoning: str = ""
    status: str = "running"
    is_fixture: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class EpisodeSummary(BaseModel):
    """Lightweight episode row (no step payload) for lists."""

    episode_id: str
    task_id: str = ""
    model: str = ""
    num_steps: int = 0
    final_reward: float = 0.0
    passed: bool = False
    judge_score: int | None = None
    status: str = "running"
    is_fixture: bool = False


class LeaderboardRow(BaseModel):
    model: str
    episodes: int = 0
    pass_rate: float = 0.0
    avg_reward: float = 0.0
    avg_steps: float = 0.0
    avg_judge_score: float | None = None


class TaskLeaderboardCell(BaseModel):
    """One (model, task) cell for the models x tasks matrix."""

    model: str
    task_id: str
    episodes: int = 0
    pass_rate: float = 0.0
    avg_steps: float = 0.0
    avg_judge_score: float | None = None
