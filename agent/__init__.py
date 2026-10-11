"""AgentGym agent package.

The agent loop that drives Nemotron models through gym episodes and emits
reusable trajectories.
"""

from agent.runner import AgentRunner
from agent.trajectory import Trajectory, Step, TrajectoryWriter, make_episode_id
from agent.llm import MODEL_REGISTRY, DEFAULT_MODEL, resolve_model
from agent.judge import Judge, JudgeResult

__all__ = [
    "AgentRunner",
    "Trajectory",
    "Step",
    "TrajectoryWriter",
    "make_episode_id",
    "MODEL_REGISTRY",
    "DEFAULT_MODEL",
    "resolve_model",
    "Judge",
    "JudgeResult",
]
