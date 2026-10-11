"""Acceptance driver: run 3 tasks x Nano through the HTTP API.

Posts /episodes/run for each task, polls /episodes/{id} until completion, then
verifies: every episode has >= 5 steps, and at least one episode FAILED.
"""

import sys
import time

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8077"
# Each task spec is "task_id" or "task_id:max_steps".
SPECS = sys.argv[2].split(",") if len(sys.argv) > 2 else [
    "med-07", "hard-03", "hard-02:4",
]
MODEL = "nano"


def run_one(client: httpx.Client, spec: str) -> dict:
    # spec: "task_id" | "task_id:max_steps" | "task_id:max_steps:R" (R = reproduce)
    parts = spec.split(":")
    task_id = parts[0]
    payload = {"task_id": task_id, "model": MODEL}
    if len(parts) > 1 and parts[1]:
        payload["max_steps"] = int(parts[1])
    if len(parts) > 2 and parts[2] == "R":
        payload["require_reproduce"] = True
    r = client.post("/episodes/run", json=payload)
    r.raise_for_status()
    episode_id = r.json()["episode_id"]
    print(f"started {spec} -> {episode_id}")

    # Poll until completed/failed (episodes touch Docker + the LLM, so allow time).
    deadline = time.time() + 600
    while time.time() < deadline:
        ep = client.get(f"/episodes/{episode_id}").json()
        if ep.get("status") in ("completed", "failed"):
            return ep
        time.sleep(3)
    raise TimeoutError(f"episode {episode_id} did not finish in time")


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=30) as client:
        results = []
        for spec in SPECS:
            ep = run_one(client, spec)
            n_steps = len(ep.get("steps", []))
            print(
                f"  {spec}: status={ep['status']} steps={n_steps} "
                f"reward={ep.get('final_reward')} passed={ep.get('passed')} "
                f"backend={ep.get('metadata', {}).get('backend')}"
            )
            results.append(ep)

        # Verify stream endpoint on the first episode.
        first_id = results[0]["episode_id"]
        raw = client.get(f"/episodes/{first_id}/stream").text
        n_lines = len([ln for ln in raw.splitlines() if ln.strip()])
        print(f"\nstream check: {first_id} -> {n_lines} JSONL lines")

        # Acceptance checks.
        all_ge5 = all(len(e.get("steps", [])) >= 5 for e in results)
        any_fail = any(not e.get("passed") for e in results)
        print("\n--- ACCEPTANCE ---")
        print(f"3 episodes run:          {len(results) == 3}")
        print(f"every episode >= 5 steps: {all_ge5}")
        print(f"at least one FAILED:      {any_fail}")

        print("\n--- LEADERBOARD ---")
        lb = client.get("/leaderboard").json()
        for row in lb:
            print(
                f"  {row['model']}: episodes={row['episodes']} "
                f"pass_rate={row['pass_rate']} avg_reward={row['avg_reward']}"
            )

        ok = len(results) == 3 and all_ge5 and any_fail
        print(f"\n{'ACCEPTANCE PASS' if ok else 'ACCEPTANCE FAIL'}")
        return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
