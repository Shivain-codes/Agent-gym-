"""Canned policies for the offline stub backend.

When no API key is present, :class:`~agent.llm.CannedClient` plays one of these
scripted tool-call sequences so episodes still run end-to-end and produce
realistic, varied trajectories (some solve, some fail). With a real key these
policies are unused — the live model drives the loop.

A policy is a list of :class:`~agent.llm.ToolCall`. The runner replays them one
per step; when the list is exhausted the stub keeps calling ``run_tests`` until
the step cap, which is how a "gives up / runs out" failure manifests.
"""

from __future__ import annotations

from agent.llm import ToolCall
from gym.task_loader import Task

# Tasks we intentionally let the stub FAIL on, to guarantee leaderboard
# variance. The stub inspects and runs tests but never applies the fix.
_FORCED_FAILURES = {"hard-02"}


def canned_policy(task: Task) -> list[ToolCall]:
    """Build a scripted policy for ``task``.

    The happy path: inspect the buggy file, run tests (fail), apply the known
    fix, run tests (pass). For forced-failure tasks: inspect and run tests a
    few times without ever fixing, so the episode exhausts steps and fails.
    """
    fix_file = task.fix_file or (next(iter(task.files), None))
    fix = task.fix

    inspect_steps: list[ToolCall] = [
        ToolCall(name="run_command", arguments={"cmd": "ls -la"}),
        ToolCall(name="run_command", arguments={"cmd": f"cat {fix_file}"}),
        ToolCall(name="run_tests", arguments={}),
    ]

    if task.id in _FORCED_FAILURES or not fix or not fix_file:
        # Realistic failure: keep probing without a correct fix.
        return inspect_steps + [
            ToolCall(name="run_command", arguments={"cmd": "ls -la"}),
            ToolCall(name="run_command", arguments={"cmd": f"cat {fix_file}"}),
            ToolCall(name="run_tests", arguments={}),
        ]

    return inspect_steps + [
        ToolCall(
            name="edit_file",
            arguments={"path": fix_file, "new_content": fix},
        ),
        ToolCall(name="run_tests", arguments={}),
    ]
