"""Gym-style environment for AgentGym.

``GymEnv`` runs one :class:`~gym.task_loader.Task` inside a :class:`~gym.sandbox.Sandbox`
and exposes a ``reset()`` / ``step()`` loop:

  - ``reset(task)`` starts a fresh container, loads the buggy repo *and* the
    hidden tests, and returns the initial :class:`Observation` (editable file
    listing + task description). The hidden tests live in the sandbox so they
    can score the agent, but they are not shown as editable files.
  - ``step(action)`` applies one action and returns ``(observation, reward,
    done)`` wrapped in a :class:`StepResult`.

Actions (dicts)::

    {"type": "edit_file", "path": "divide.py", "new_content": "..."}
    {"type": "run_command", "cmd": "ls -la"}
    {"type": "run_tests"}

Per-step reward is only the step penalty while the episode is live; the full
test-based reward (pass fraction minus penalties) is paid once at episode end
(when tests all pass, the step cap is hit, or ``close`` is called). Regressions
are tracked across steps: whenever tests run, a previously-passing hidden test
that now fails adds to a cumulative regression count.

Safety: at most ``max_steps`` (25) steps per episode; actions that edit a
hidden-test file are rejected without touching the sandbox.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from gym.reward import (
    Reward,
    RewardResult,
    count_regressions,
    parse_pytest,
    test_counts,
)
from gym.sandbox import Sandbox, get_sandbox
from gym.task_loader import Task

MAX_STEPS = 25
# Hidden tests live under this dir, locked to root so the agent (which runs
# commands as an unprivileged user) can run them but cannot read their source.
HIDDEN_DIR = "_hidden"
# Run tests verbosely enough that the reward parser sees one line per test.
# rootdir/sys.path include the workspace so hidden tests can import the fix.
_TEST_RUN_CMD = (
    f"PYTHONPATH=. python -m pytest {HIDDEN_DIR} -rA "
    "-o cacheprovider=no -p no:cacheprovider"
)
# The agent's shell commands run as this unprivileged user.
AGENT_USER = "agent"


@dataclass
class Observation:
    """What the agent sees at each step."""

    task_prompt: str
    files: dict[str, str] = field(default_factory=dict)
    last_output: str = ""
    step_index: int = 0
    tests_passed: int = 0
    tests_total: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class StepResult:
    """Returned by ``GymEnv.step()``."""

    observation: Observation
    reward: float
    done: bool
    snapshot: dict[str, str] = field(default_factory=dict)
    info: dict[str, Any] = field(default_factory=dict)


class ActionError(ValueError):
    """Raised when an action is malformed or forbidden."""


class GymEnv:
    """A single-task environment the agent interacts with."""

    def __init__(
        self,
        task: Task,
        sandbox: Sandbox | None = None,
        reward: Reward | None = None,
        max_steps: int = MAX_STEPS,
    ) -> None:
        self.task = task
        self.sandbox = sandbox or get_sandbox()
        self.reward = reward or Reward()
        self.max_steps = max_steps

        self.step_index = 0
        self.done = False
        self._editable_files: dict[str, str] = {}
        self._test_state: dict[str, bool] = {}
        self._regressions = 0
        self._final_reward: RewardResult | None = None

    # -- lifecycle ---------------------------------------------------------

    def reset(self, task: Task | None = None) -> Observation:
        """Start a fresh episode. Loads buggy files + hidden tests in sandbox."""
        if task is not None:
            self.task = task

        self.step_index = 0
        self.done = False
        self._regressions = 0
        self._test_state = {}
        self._final_reward = None
        self._editable_files = dict(self.task.files)

        # Fresh container. Buggy repo goes at the workspace root (agent-owned,
        # editable). Hidden tests go under _hidden/ owned by root and locked so
        # the agent can RUN them (as root, via run_tests) but cannot READ their
        # source (run_command executes as the unprivileged 'agent' user).
        self.sandbox.stop()
        hidden = {
            f"{HIDDEN_DIR}/{path}": content
            for path, content in self.task.hidden_tests.items()
        }
        self.sandbox.start({**self.task.files, **hidden})

        # Give the agent its editable files; lock the hidden tests to root.
        for path in self.task.files:
            self.sandbox.grant_agent(path)
        self.sandbox.lock_path(HIDDEN_DIR)

        return self._observation(last_output="episode reset")

    def close(self) -> RewardResult:
        """End the episode, score it, and tear down the sandbox."""
        if self._final_reward is None:
            self._final_reward = self._finalize()
        self.sandbox.stop()
        return self._final_reward

    def __enter__(self) -> "GymEnv":
        return self

    def __exit__(self, *exc: object) -> None:
        self.sandbox.stop()

    # -- stepping ----------------------------------------------------------

    def step(self, action: dict[str, Any]) -> StepResult:
        """Apply one action and return (observation, reward, done)."""
        if self.done:
            raise ActionError("episode is done; call reset() to start a new one")

        self.step_index += 1
        action_type = action.get("type")
        last_output = ""
        info: dict[str, Any] = {"action": action_type}
        snapshot: dict[str, str] = {}

        # Track state before action for reward shaping
        prev_test_state = dict(self._test_state)

        if action_type == "edit_file":
            last_output = self._do_edit(action)
            # Capture the state of the edited file
            path = action.get("path")
            if path:
                snapshot[path] = self._editable_files.get(path, "")
        elif action_type == "run_command":
            last_output = self._do_run_command(action)
        elif action_type == "run_tests":
            last_output = self._do_run_tests(info)

        # Dense reward shaping: reward progress in tests
        step_reward = 0.0
        if action_type == "run_tests":
            step_reward = self.reward.step_reward(
                prev_test_state, self._test_state, self.step_index
            )

        # Episode ends when all hidden tests pass, or the step cap is reached.
        solved = self._all_tests_passing()
        hit_cap = self.step_index >= self.max_steps
        self.done = solved or hit_cap

        if self.done:
            info["terminated_reason"] = "solved" if solved else "step_cap"
            self._final_reward = self._finalize()
            reward = self._final_reward.score
        else:
            # Live steps pay the dense reward minus the incremental step penalty
            reward = step_reward - self._incremental_step_penalty()

        obs = self._observation(last_output=last_output)
        return StepResult(observation=obs, reward=round(reward, 6), done=self.done, snapshot=snapshot, info=info)

    # -- action handlers ---------------------------------------------------

    def _do_edit(self, action: dict[str, Any]) -> str:
        path = action.get("path")
        content = action.get("new_content")
        if not isinstance(path, str) or content is None:
            raise ActionError("edit_file requires 'path' (str) and 'new_content'")

        if self._is_hidden_test_path(path):
            raise ActionError(f"editing hidden test file is forbidden: {path!r}")

        self.sandbox.write_file(path, content)
        self._editable_files[path] = content
        return f"wrote {path} ({len(content)} bytes)"

    def _do_run_command(self, action: dict[str, Any]) -> str:
        cmd = action.get("cmd")
        if not isinstance(cmd, str) or not cmd.strip():
            raise ActionError("run_command requires a non-empty 'cmd' string")
        res = self.sandbox.exec(cmd, user=AGENT_USER)
        return _format_output(res.stdout, res.stderr, res.exit_code, res.timed_out)

    def _do_run_tests(self, info: dict[str, Any]) -> str:
        res = self.sandbox.exec(_TEST_RUN_CMD)
        new_state = parse_pytest(res.stdout + res.stderr)

        # Track regressions vs the previous observed state.
        if self._test_state:
            self._regressions += count_regressions(self._test_state, new_state)
        self._test_state = new_state

        passed, total = test_counts(new_state)
        info["tests_passed"] = passed
        info["tests_total"] = total
        info["regressions"] = self._regressions
        return _format_output(res.stdout, res.stderr, res.exit_code, res.timed_out)

    # -- helpers -----------------------------------------------------------

    def _is_hidden_test_path(self, path: str) -> bool:
        norm = path.lstrip("./")
        return any(norm == hp.lstrip("./") for hp in self.task.hidden_test_paths)

    def _all_tests_passing(self) -> bool:
        return bool(self._test_state) and all(self._test_state.values())

    def _incremental_step_penalty(self) -> float:
        """Penalty attributable to taking this step, if over the free budget."""
        if self.step_index > self.reward.free_steps:
            return self.reward.step_penalty
        return 0.0

    def _finalize(self) -> RewardResult:
        """Run tests one final time (ground truth) and compute the reward."""
        res = self.sandbox.exec(_TEST_RUN_CMD)
        final_state = parse_pytest(res.stdout + res.stderr)
        if self._test_state:
            self._regressions += count_regressions(self._test_state, final_state)
        self._test_state = final_state
        return self.reward.score(
            final_state, steps=self.step_index, regressions=self._regressions
        )

    def _observation(self, last_output: str) -> Observation:
        passed, total = test_counts(self._test_state)
        return Observation(
            task_prompt=self.task.prompt,
            files=dict(self._editable_files),
            last_output=last_output,
            step_index=self.step_index,
            tests_passed=passed,
            tests_total=total,
            metadata={
                "task_id": self.task.id,
                "max_steps": self.max_steps,
                "regressions": self._regressions,
            },
        )


def _format_output(stdout: str, stderr: str, exit_code: int, timed_out: bool) -> str:
    parts = []
    if stdout.strip():
        parts.append(stdout.rstrip())
    if stderr.strip():
        parts.append("[stderr]\n" + stderr.rstrip())
    parts.append(f"[exit={exit_code}{' timeout' if timed_out else ''}]")
    return "\n".join(parts)
