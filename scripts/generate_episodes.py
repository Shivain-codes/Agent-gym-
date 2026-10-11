"""Generate a matrix of episodes across Nano / Super / Ultra for the leaderboard.

Runs each (model, task) pair once with the live Token Factory backend and the
Ultra code-quality judge. Prints a summary. Trajectories land in trajectories/.

Usage: python scripts/generate_episodes.py [tasks] [models]
  tasks  comma-separated task ids (default: easy-03,med-02,hard-01)
  models comma-separated model aliases (default: nano,super,ultra)
"""

import sys
import time

from dotenv import load_dotenv

load_dotenv()

from agent import AgentRunner  # noqa: E402
from gym import TaskLoader  # noqa: E402

TASKS = (sys.argv[1].split(",") if len(sys.argv) > 1
         else ["easy-03", "med-02", "hard-01"])
MODELS = (sys.argv[2].split(",") if len(sys.argv) > 2
          else ["nano", "super", "ultra"])

loader = TaskLoader("tasks")


def main() -> int:
    results = []
    for task_id in TASKS:
        task = loader.load(task_id)
        for model in MODELS:
            t0 = time.monotonic()
            runner = AgentRunner(model=model, max_steps=25)
            traj = runner.run_episode(task, model=model)
            dt = time.monotonic() - t0
            results.append(traj)
            print(
                f"{task_id:10s} {model:6s} "
                f"steps={len(traj['steps']):2d} "
                f"passed={str(traj['passed']):5s} "
                f"reward={traj['final_reward']:.2f} "
                f"judge={traj.get('judge_score')} "
                f"({dt:.0f}s) -> {traj['episode_id']}",
                flush=True,
            )
    n = len(results)
    passed = sum(1 for r in results if r["passed"])
    print(f"\n{n} episodes, {passed} passed, {n - passed} failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
