#!/usr/bin/env python3
"""Validator for AgentGym bug-fix tasks.

For every task JSON under ``tasks/`` (excluding this file), this script:

  1. Creates a fresh temp dir.
  2. Writes the task's ``files`` (the buggy repo) and ``hidden_tests``.
  3. Runs ``test_command`` -> asserts it FAILS on the buggy code.
  4. Applies the task's intended ``fix`` to the single editable file.
  5. Runs ``test_command`` again -> asserts it PASSES.

A task is valid only if it fails-before and passes-after.

Task JSON schema
----------------
{
  "id": "easy-01",
  "title": "...",
  "description": "...",
  "files": { "pkg/mod.py": "<buggy source>" },
  "test_command": "pytest -q",
  "hidden_tests": { "test_mod.py": "<test source>" },
  "difficulty": 1,                   # 1=easy .. 3=hard, 4=expert
  "fix_file": "pkg/mod.py",          # the ONE file an agent must edit
  "fix": "<full fixed contents of fix_file>"
}

``fix_file`` + ``fix`` are ground truth used only by this validator; they are
the single-file edit that turns the buggy repo into a passing one. The agent
never sees them.

Run: ``python tasks/validate.py``  (exit 0 iff every task passes).
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

TASKS_DIR = Path(__file__).resolve().parent
REQUIRED_KEYS = {
    "id",
    "title",
    "description",
    "files",
    "test_command",
    "hidden_tests",
    "difficulty",
    "fix_file",
    "fix",
}


class TaskError(Exception):
    """Raised when a task is structurally invalid."""


def _write_tree(root: Path, files: dict[str, str]) -> None:
    for rel, content in files.items():
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")


def _run_tests(root: Path, test_command: str) -> tuple[bool, str]:
    """Run the test command in ``root``. Returns (passed, combined_output).

    We force a clean import every run: ``PYTHONDONTWRITEBYTECODE`` plus pytest's
    importlib import mode and no cache provider. Without this, the buggy run
    writes ``__pycache__`` and, when the fix is written within the same
    filesystem mtime tick, Python can reuse the stale bytecode and the "after"
    run would wrongly see buggy behavior.
    """
    base = shlex.split(_normalize_cmd(test_command))
    extra: list[str] = []
    if base and base[0] == "pytest":
        extra = ["-p", "no:cacheprovider", "--import-mode=importlib"]

    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"

    try:
        proc = subprocess.run(
            [sys.executable, "-m", *base, *extra],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return False, "[validator] test run timed out (120s)"
    output = proc.stdout + proc.stderr
    return proc.returncode == 0, output


def _normalize_cmd(test_command: str) -> str:
    """Turn ``pytest ...`` into ``pytest ...`` runnable via ``python -m``.

    Tasks declare ``pytest -q``; we execute it as ``python -m pytest -q`` so the
    validator uses the current interpreter's environment.
    """
    parts = shlex.split(test_command)
    if parts and parts[0] == "python":
        parts = parts[1:]
        if parts and parts[0] == "-m":
            parts = parts[1:]
    return shlex.join(parts)


def _validate_schema(task: dict, path: Path) -> None:
    missing = REQUIRED_KEYS - task.keys()
    if missing:
        raise TaskError(f"{path.name}: missing keys {sorted(missing)}")
    if not isinstance(task["files"], dict) or not task["files"]:
        raise TaskError(f"{path.name}: 'files' must be a non-empty object")
    if not isinstance(task["hidden_tests"], dict) or not task["hidden_tests"]:
        raise TaskError(f"{path.name}: 'hidden_tests' must be a non-empty object")
    if task["fix_file"] not in task["files"]:
        raise TaskError(
            f"{path.name}: 'fix_file' {task['fix_file']!r} not in 'files'"
        )
    if task["difficulty"] not in (1, 2, 3, 4):
        raise TaskError(f"{path.name}: 'difficulty' must be 1-4 (4 = expert)")
    # Enforce the single-file rule: the fix only differs from the buggy repo in
    # exactly one file (fix_file), and it does differ there.
    if task["fix"] == task["files"][task["fix_file"]]:
        raise TaskError(
            f"{path.name}: 'fix' is identical to the buggy '{task['fix_file']}'"
        )


def validate_task(path: Path) -> tuple[bool, str]:
    """Validate one task file. Returns (ok, message)."""
    try:
        task = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, f"invalid JSON: {exc}"

    try:
        _validate_schema(task, path)
    except TaskError as exc:
        return False, str(exc)

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        # Buggy repo + hidden tests.
        _write_tree(root, task["files"])
        _write_tree(root, task["hidden_tests"])

        passed_before, out_before = _run_tests(root, task["test_command"])
        if passed_before:
            return False, (
                "expected FAIL on buggy code but tests PASSED\n"
                + _tail(out_before)
            )

        # Apply the single-file fix.
        (root / task["fix_file"]).write_text(task["fix"], encoding="utf-8")

        passed_after, out_after = _run_tests(root, task["test_command"])
        if not passed_after:
            return False, (
                "expected PASS after fix but tests FAILED\n" + _tail(out_after)
            )

    return True, "fail-before, pass-after"


def _tail(text: str, lines: int = 12) -> str:
    return "\n".join(text.strip().splitlines()[-lines:])


def main() -> int:
    task_files = sorted(
        p for p in TASKS_DIR.glob("*.json") if p.name != "validate.py"
    )
    if not task_files:
        print("No task JSON files found under tasks/.")
        return 1

    passed = 0
    failures: list[tuple[str, str]] = []

    for path in task_files:
        ok, msg = validate_task(path)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {path.name}: {msg.splitlines()[0]}")
        if ok:
            passed += 1
        else:
            failures.append((path.name, msg))

    total = len(task_files)
    print(f"\n{passed}/{total} tasks valid (fail-before, pass-after).")

    if failures:
        print("\n--- Failures ---")
        for name, msg in failures:
            print(f"\n{name}:\n{msg}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
