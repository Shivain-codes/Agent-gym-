"""Task loading for AgentGym.

A Task is a broken repo plus a pytest-based test suite that grades the fix.
Tasks are stored as JSON files under ``tasks/`` with inline source: see
``tasks/validate.py`` for the schema. This module loads those JSON files into
:class:`Task` objects the gym can run.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Validator-only / non-task files that live in the tasks dir but are not tasks.
_NON_TASK_FILES = {"validate.py"}


@dataclass
class Task:
    """A single coding task: a broken repo + hidden tests that grade the fix.

    ``files`` and ``hidden_tests`` map a relative path to file contents. The
    agent sees ``files`` (the buggy repo); ``hidden_tests`` are written into
    the sandbox only to score the episode. ``fix_file`` / ``fix`` are ground
    truth used by the validator and by scripted (non-LLM) runs; an agent never
    receives them.
    """

    id: str
    title: str
    description: str
    files: dict[str, str] = field(default_factory=dict)
    hidden_tests: dict[str, str] = field(default_factory=dict)
    test_command: str = "pytest -q"
    difficulty: int = 2
    fix_file: str | None = None
    fix: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def prompt(self) -> str:
        """Human-readable task statement shown to the agent."""
        return f"{self.title}\n\n{self.description}"

    @property
    def hidden_test_paths(self) -> set[str]:
        """Paths an agent is forbidden from editing."""
        return set(self.hidden_tests.keys())

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Task":
        return cls(
            id=data["id"],
            title=data.get("title", data["id"]),
            description=data.get("description", ""),
            files=dict(data.get("files", {})),
            hidden_tests=dict(data.get("hidden_tests", {})),
            test_command=data.get("test_command", "pytest -q"),
            difficulty=int(data.get("difficulty", 2)),
            fix_file=data.get("fix_file"),
            fix=data.get("fix"),
            metadata=dict(data.get("metadata", {})),
        )


class TaskLoader:
    """Loads tasks from a directory of JSON task files."""

    def __init__(self, tasks_dir: str | Path = "tasks") -> None:
        self.tasks_dir = Path(tasks_dir)

    def _task_paths(self) -> list[Path]:
        return sorted(
            p
            for p in self.tasks_dir.glob("*.json")
            if p.name not in _NON_TASK_FILES
        )

    def list_tasks(self) -> list[Task]:
        """Return all available tasks, sorted by id."""
        tasks = [
            Task.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in self._task_paths()
        ]
        tasks.sort(key=lambda t: t.id)
        return tasks

    def load(self, task_id: str) -> Task:
        """Load a single task by id."""
        for path in self._task_paths():
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("id") == task_id:
                return Task.from_dict(data)
        raise KeyError(f"task not found: {task_id!r}")
