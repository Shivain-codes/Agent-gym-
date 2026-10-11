"""Reward scoring for AgentGym.

The episode reward combines:
  - test score: fraction of hidden tests passing at episode end (0..1), the
    dominant term;
  - a step penalty: -0.01 for every step beyond a free budget (15);
  - a regression penalty: -0.05 for each hidden test that was passing on a
    previous step but is failing now.

To support the regression term, the environment tracks per-test pass/fail
state across steps. :func:`parse_pytest` turns raw pytest output into that
per-test map, and :meth:`Reward.score` turns the final state (plus step count
and regression count) into a scalar.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# pytest `-rA` emits one summary line per test, e.g.:
#   PASSED test_divide.py::test_divide
#   FAILED test_x.py::test_y - AssertionError: ...
# Outcomes we treat as "passing": PASSED, XFAIL (expected fail), XPASS.
_SUMMARY_RE = re.compile(
    r"^(PASSED|FAILED|ERROR|XFAIL|XPASS|SKIPPED)\s+(\S+)", re.MULTILINE
)
_PASSING_OUTCOMES = {"PASSED", "XFAIL", "XPASS"}

FREE_STEPS = 15
STEP_PENALTY = 0.02
REGRESSION_PENALTY = 0.05


def parse_pytest(output: str) -> dict[str, bool]:
    """Parse pytest ``-rA`` output into {test_nodeid: passed}.

    Only tests that appear in the summary are included. ``SKIPPED`` tests are
    recorded as not-passing but are rarely used by our tasks.
    """
    state: dict[str, bool] = {}
    for outcome, nodeid in _SUMMARY_RE.findall(output):
        state[nodeid] = outcome in _PASSING_OUTCOMES
    return state


def test_counts(state: dict[str, bool]) -> tuple[int, int]:
    """Return (passed, total) from a per-test state map."""
    total = len(state)
    passed = sum(1 for ok in state.values() if ok)
    return passed, total


def count_regressions(
    prev: dict[str, bool], curr: dict[str, bool]
) -> int:
    """Count tests that were passing in ``prev`` but are not passing in ``curr``.

    A test missing from ``curr`` (e.g. it errored at collection) counts as a
    regression if it was previously passing.
    """
    return sum(
        1 for nodeid, was_ok in prev.items() if was_ok and not curr.get(nodeid, False)
    )


@dataclass
class RewardResult:
    """Breakdown of a reward computation."""

    score: float
    test_score: float = 0.0
    tests_passed: int = 0
    tests_total: int = 0
    step_penalty: float = 0.0
    regression_penalty: float = 0.0
    steps: int = 0
    regressions: int = 0
    details: dict[str, Any] = field(default_factory=dict)


class Reward:
    """Scores an episode from the final test state, step count, regressions."""

    def __init__(
        self,
        free_steps: int = FREE_STEPS,
        step_penalty: float = STEP_PENALTY,
        regression_penalty: float = REGRESSION_PENALTY,
    ) -> None:
        self.free_steps = free_steps
        self.step_penalty = step_penalty
        self.regression_penalty = regression_penalty

    def step_reward(
        self,
        prev_state: dict[str, bool],
        curr_state: dict[str, bool],
        step_index: int,
    ) -> float:
        """Compute a dense reward for a single step based on test progress.

        Returns a scalar reward:
        - +0.1 for each new test that passes.
        - -0.05 for each regression.
        - -0.01 for stagnation (no change in state).
        """
        if not prev_state:
            return 0.0

        # New passes
        new_passes = sum(
            1 for nodeid, ok in curr_state.items()
            if ok and not prev_state.get(nodeid, False)
        )
        # Regressions
        regressions = count_regressions(prev_state, curr_state)

        reward = (new_passes * 0.1) - (regressions * 0.05)

        # Stagnation penalty
        if prev_state == curr_state:
            reward -= 0.01

        return round(reward, 6)

    def score(
        self,
        final_state: dict[str, bool],
        steps: int,
        regressions: int = 0,
    ) -> RewardResult:
        """Compute the episode reward.

        Parameters
        ----------
        final_state:
            Per-hidden-test pass/fail map at episode end (from ``parse_pytest``).
        steps:
            Number of steps the agent took.
        regressions:
            Cumulative count of previously-passing tests broken during the
            episode (tracked by the environment across steps).
        """
        passed, total = test_counts(final_state)
        test_score = (passed / total) if total else 0.0

        over = max(0, steps - self.free_steps)
        step_pen = over * self.step_penalty
        reg_pen = regressions * self.regression_penalty

        score = test_score - step_pen - reg_pen
        return RewardResult(
            score=round(score, 6),
            test_score=round(test_score, 6),
            tests_passed=passed,
            tests_total=total,
            step_penalty=round(step_pen, 6),
            regression_penalty=round(reg_pen, 6),
            steps=steps,
            regressions=regressions,
        )
