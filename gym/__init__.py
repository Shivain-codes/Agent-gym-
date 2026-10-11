"""AgentGym environment package.

Provides the training gym primitives: task loading, a Docker sandbox,
a Gym-style environment with reset()/step(), and reward scoring.
"""

from gym.task_loader import TaskLoader, Task
from gym.sandbox import Sandbox, SandboxResult, SandboxError
from gym.env import GymEnv, Observation, StepResult, ActionError
from gym.reward import (
    Reward,
    RewardResult,
    parse_pytest,
    count_regressions,
    test_counts,
)

__all__ = [
    "TaskLoader",
    "Task",
    "Sandbox",
    "SandboxResult",
    "SandboxError",
    "GymEnv",
    "Observation",
    "StepResult",
    "ActionError",
    "Reward",
    "RewardResult",
    "parse_pytest",
    "count_regressions",
    "test_counts",
]
