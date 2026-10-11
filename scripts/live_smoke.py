"""One-off live smoke test: run a single Nano episode via Token Factory."""

import sys

from dotenv import load_dotenv

load_dotenv()

from agent import AgentRunner  # noqa: E402
from gym import TaskLoader  # noqa: E402

loader = TaskLoader("tasks")
runner = AgentRunner()  # live backend (key from .env)
task_id = sys.argv[1] if len(sys.argv) > 1 else "easy-01"
task = loader.load(task_id)
traj = runner.run_episode(task, model="nano")

print("backend:", traj["metadata"]["backend"], "model_id:", traj["metadata"]["model_id"])
print("episode_id:", traj["episode_id"])
print("steps:", len(traj["steps"]), "final_reward:", traj["final_reward"], "passed:", traj["passed"])
for s in traj["steps"]:
    act = s["action"].get("type")
    obs = (s["observation"] or "").splitlines()
    tail = obs[-1] if obs else ""
    print(f"  step {s['step']}: {act:12s} reward_so_far={s['reward_so_far']}  | {tail[:70]}")
