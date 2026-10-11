"""Scripted (non-LLM) end-to-end driver for the AgentGym environment.

Runs three episodes against the real Docker sandbox to prove reset/step/reward
work end-to-end, asserting the rewards match hand-computed expectations:

  1. SOLVE      - apply the ground-truth fix, run tests -> reward == 1.0
  2. REGRESSION - record a passing state, break it, score -> -0.05 penalty
  3. STEP CAP   - take 25 no-op steps without fixing -> hits the 25-step cap,
                  reward == -0.10 (10 steps over the 15-step free budget)

Run: ``python -m gym.scripts.scripted_run``  (exit 0 iff all expectations hold).
"""

from __future__ import annotations

from gym import GymEnv, Sandbox, TaskLoader
from gym.reward import REGRESSION_PENALTY, STEP_PENALTY
from gym.task_loader import Task


def _approx(a: float, b: float, tol: float = 1e-6) -> bool:
    return abs(a - b) <= tol


def _banner(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def episode_solve(loader: TaskLoader) -> bool:
    """Edit the buggy file with the known fix, run tests, expect reward 1.0."""
    _banner("Episode 1: SOLVE (easy-01, apply ground-truth fix)")
    task = loader.load("easy-01")
    env = GymEnv(task, sandbox=Sandbox())
    try:
        obs = env.reset()
        print(f"reset: editable file(s)={list(obs.files)}  prompt={task.title!r}")

        r1 = env.step(
            {"type": "edit_file", "path": task.fix_file, "new_content": task.fix}
        )
        print(f"step 1 (edit {task.fix_file}): reward={r1.reward} done={r1.done}")

        r2 = env.step({"type": "run_tests"})
        print(
            f"step 2 (run_tests): passed={r2.observation.tests_passed}/"
            f"{r2.observation.tests_total} done={r2.done} "
            f"reason={r2.info.get('terminated_reason')} reward={r2.reward}"
        )

        # 2 steps (<= 15 free budget), all tests pass, no regressions -> 1.0.
        ok = r2.done and _approx(r2.reward, 1.0)
        print(f"EXPECT 1.0  ACTUAL {r2.reward}  -> {'PASS' if ok else 'FAIL'}")
        return ok
    finally:
        env.close()


def episode_regression(loader: TaskLoader) -> bool:
    """Record a passing hidden test, break it, and score the regression.

    The env auto-terminates when all tests pass, which would end the episode
    before we can break anything. For this controlled scenario we disable that
    one termination path so we can observe pass -> break -> score within a
    single episode. Everything else (reward math, regression counter) is the
    real implementation.
    """
    _banner("Episode 2: REGRESSION (med-02, pass then break -> -0.05)")

    class NoAutoSolveEnv(GymEnv):
        def _all_tests_passing(self) -> bool:  # type: ignore[override]
            return False

    task = loader.load("med-02")
    env = NoAutoSolveEnv(task, sandbox=Sandbox())
    try:
        env.reset()

        # 1) Apply the fix and run tests -> records a PASSING state.
        env.step({"type": "edit_file", "path": task.fix_file, "new_content": task.fix})
        r_pass = env.step({"type": "run_tests"})
        print(
            f"after fix: passed={r_pass.observation.tests_passed}/"
            f"{r_pass.observation.tests_total}"
        )

        # 2) Break the file so the previously-passing test now FAILS (not errors
        #    at import — it still imports, just returns the wrong value).
        broken = (
            "def safe_divide(a, b):\n"
            "    if b == 0:\n"
            "        return 999\n"
            "    return a / b\n"
        )
        env.step({"type": "edit_file", "path": task.fix_file, "new_content": broken})
        r_break = env.step({"type": "run_tests"})
        print(
            f"after break: passed={r_break.observation.tests_passed}/"
            f"{r_break.observation.tests_total} regressions={env._regressions}"
        )

        # 3) Close scores the final (failing) state.
        result = env.close()

        # 4 steps (<= 15, no step penalty), final test fails (test_score 0),
        # exactly one regression -> reward == -0.05.
        expected = -REGRESSION_PENALTY
        ok = result.regressions >= 1 and _approx(result.score, expected)
        print(
            f"EXPECT {expected} (1 regression, 0 tests pass)  "
            f"ACTUAL {result.score} regressions={result.regressions}  "
            f"-> {'PASS' if ok else 'FAIL'}"
        )
        return ok
    finally:
        env.sandbox.stop()


def episode_step_cap(loader: TaskLoader) -> bool:
    """Take no-op steps without fixing; expect the 25-step cap to terminate."""
    _banner("Episode 3: STEP CAP (easy-02, 25 no-op commands)")
    task = loader.load("easy-02")
    env = GymEnv(task, sandbox=Sandbox(), max_steps=25)
    try:
        env.reset()
        last = None
        for _ in range(25):
            last = env.step({"type": "run_command", "cmd": "true"})
            if last.done:
                break
        assert last is not None
        print(
            f"terminated at step {last.observation.step_index} "
            f"reason={last.info.get('terminated_reason')} reward={last.reward}"
        )

        # No fix -> 0 tests pass -> test_score 0. 25 steps -> 10 over the free
        # budget -> step penalty 10 * 0.01 = 0.10. No regressions. reward -0.10.
        expected = -(25 - 15) * STEP_PENALTY
        ok = (
            last.done
            and last.info.get("terminated_reason") == "step_cap"
            and last.observation.step_index == 25
            and _approx(last.reward, expected)
        )
        print(f"EXPECT {expected} at step_cap  ACTUAL {last.reward}  "
              f"-> {'PASS' if ok else 'FAIL'}")
        return ok
    finally:
        env.close()


def episode_reject_hidden_edit(loader: TaskLoader) -> bool:
    """Bonus safety check: editing a hidden-test file must be rejected."""
    _banner("Safety: reject edits to hidden test files")
    task = loader.load("easy-01")
    hidden_path = next(iter(task.hidden_tests))
    env = GymEnv(task, sandbox=Sandbox())
    try:
        env.reset()
        try:
            env.step({"type": "edit_file", "path": hidden_path, "new_content": "x=1"})
        except Exception as exc:  # ActionError
            print(f"correctly rejected edit to {hidden_path!r}: {type(exc).__name__}")
            return True
        print(f"FAIL: edit to hidden test {hidden_path!r} was NOT rejected")
        return False
    finally:
        env.close()


def main() -> int:
    loader = TaskLoader("tasks")
    results = {
        "solve": episode_solve(loader),
        "regression": episode_regression(loader),
        "step_cap": episode_step_cap(loader),
        "reject_hidden_edit": episode_reject_hidden_edit(loader),
    }
    _banner("SUMMARY")
    for name, ok in results.items():
        print(f"  {name:20s} {'PASS' if ok else 'FAIL'}")
    all_ok = all(results.values())
    print(f"\n{'ALL CHECKS PASS' if all_ok else 'SOME CHECKS FAILED'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
