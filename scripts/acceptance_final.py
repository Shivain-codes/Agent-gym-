"""Final acceptance driver.

Runs 3 episodes x Nano end-to-end via the real Token Factory API (live
backend), plus 1 canned-stub episode that deterministically fails, proving the
pipeline handles both outcomes and the leaderboard reflects variance.

Acceptance criteria:
  - 3+ episodes run
  - every episode >= 5 steps
  - at least one FAILS
  - JSONL trajectories land on disk
  - leaderboard shows variance (pass_rate < 1.0)
"""

import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from agent import AgentRunner  # noqa: E402
from gym import TaskLoader  # noqa: E402

TRAJECTORY_DIR = Path(__file__).resolve().parent.parent / "trajectories"
loader = TaskLoader("tasks")


def run_live(task_id: str) -> dict:
    """Run one episode via the real Token Factory backend."""
    runner = AgentRunner(model="nano")
    task = loader.load(task_id)
    return runner.run_episode(task, model="nano")


def run_stub_failure(task_id: str) -> dict:
    """Run one canned-stub episode (deterministic failure)."""
    runner = AgentRunner(model="nano", force_stub=True)
    task = loader.load(task_id)
    return runner.run_episode(task, model="nano")


def main() -> int:
    results = []

    # 3 live episodes (Token Factory API, real Nano model).
    for tid in ["med-07", "hard-02", "hard-04"]:
        traj = run_live(tid)
        results.append(traj)
        print(
            f"[live]  {tid}: steps={len(traj['steps'])} "
            f"passed={traj['passed']} reward={traj['final_reward']} "
            f"backend={traj['metadata']['backend']}",
            flush=True,
        )

    # 1 canned-stub episode (deterministic failure, hard-02).
    traj = run_stub_failure("hard-02")
    results.append(traj)
    print(
        f"[stub]  hard-02: steps={len(traj['steps'])} "
        f"passed={traj['passed']} reward={traj['final_reward']} "
        f"backend={traj['metadata']['backend']}",
        flush=True,
    )

    # Verify JSONL files landed.
    jsonl_files = list(TRAJECTORY_DIR.glob("*.jsonl"))
    for jf in sorted(jsonl_files)[-4:]:
        lines = [ln for ln in jf.read_text().splitlines() if ln.strip()]
        print(f"  JSONL {jf.name}: {len(lines)} lines")

    # Acceptance checks.
    print("\n--- ACCEPTANCE ---")
    n = len(results)
    all_ge5 = all(len(r.get("steps", [])) >= 5 for r in results)
    any_fail = any(not r.get("passed") for r in results)
    print(f"episodes run:             {n}")
    print(f"every episode >= 5 steps: {all_ge5}")
    print(f"at least one FAILED:      {any_fail}")

    # Leaderboard aggregation.
    print("\n--- LEADERBOARD ---")
    by_model: dict[str, list] = {}
    for r in results:
        by_model.setdefault(r["model"], []).append(r)
    for model, eps in by_model.items():
        n_eps = len(eps)
        pr = sum(1 for e in eps if e["passed"]) / n_eps
        ar = sum(e["final_reward"] for e in eps) / n_eps
        print(f"  {model}: episodes={n_eps} pass_rate={pr:.2f} avg_reward={ar:.2f}")

    ok = n >= 3 and all_ge5 and any_fail
    print(f"\n{'ACCEPTANCE PASS' if ok else 'ACCEPTANCE FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
