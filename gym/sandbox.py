"""Docker sandbox for AgentGym.

Runs agent-authored code and tests inside an isolated container. One container
is created per episode (``start``), reused across steps, and destroyed on
``stop``. The container has no network access (``--network none``) and every
command is bounded by a wall-clock timeout.

Implementation notes
--------------------
- Image: ``python:3.11-slim`` with ``pytest`` installed once at start (there is
  no network inside the container, so pytest is installed via a short-lived
  helper container into a volume... instead, simpler: we install pytest in a
  derived image on first use). To keep the dependency surface tiny and offline,
  we build (once) a thin image ``agentgym-sandbox:py311`` that layers pytest on
  top of the base, then run episode containers from it with ``--network none``.
- The container runs ``sleep infinity`` so it stays up; commands run via
  ``docker exec``.
- Files are copied in with ``docker cp`` from a host temp staging file.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

BASE_IMAGE = "python:3.11-slim"
SANDBOX_IMAGE = "agentgym-sandbox:py311"


class SandboxError(RuntimeError):
    """Raised when the sandbox cannot be operated (docker missing, etc.)."""


@dataclass
class SandboxResult:
    """Result of running a command inside the sandbox."""

    exit_code: int
    stdout: str = ""
    stderr: str = ""
    duration_s: float = 0.0
    timed_out: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


def _run_host(cmd: list[str], timeout: float | None = None) -> subprocess.CompletedProcess:
    """Run a docker CLI command on the host."""
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def ensure_image() -> None:
    """Build the thin sandbox image (base + pytest) if it does not exist.

    Done once on the host, where network is available; episode containers then
    run fully offline.
    """
    if shutil.which("docker") is None:
        raise SandboxError("docker CLI not found on PATH")

    inspect = _run_host(["docker", "image", "inspect", SANDBOX_IMAGE], timeout=60)
    if inspect.returncode == 0:
        return

    with tempfile.TemporaryDirectory() as ctx:
        dockerfile = Path(ctx) / "Dockerfile"
        dockerfile.write_text(
            f"FROM {BASE_IMAGE}\n"
            "RUN pip install --no-cache-dir pytest==8.3.3\n"
            "WORKDIR /workspace\n",
            encoding="utf-8",
        )
        build = _run_host(
            ["docker", "build", "-t", SANDBOX_IMAGE, "-f", str(dockerfile), ctx],
            timeout=600,
        )
        if build.returncode != 0:
            raise SandboxError(
                "failed to build sandbox image:\n" + build.stdout + build.stderr
            )


class Sandbox:
    """An isolated Docker environment for executing code and tests.

    Lifecycle: ``start()`` -> ``write_file`` / ``exec`` / ``read_file`` (any
    number of times) -> ``stop()``. Reusing one container across steps keeps
    episode state (edited files) between actions.
    """

    def __init__(
        self,
        image: str = SANDBOX_IMAGE,
        workdir: str = "/workspace",
        timeout_s: int = 30,
    ) -> None:
        self.image = image
        self.workdir = PurePosixPath(workdir)
        self.timeout_s = timeout_s
        self.container_id: str | None = None

    # -- lifecycle ---------------------------------------------------------

    def start(self, files: dict[str, str] | None = None) -> None:
        """Create and start the episode container, then load ``files`` in.

        The container is started with no network, a read-only-ish footprint,
        and a long-lived ``sleep`` so steps can exec into it.
        """
        if self.container_id is not None:
            # Idempotent-ish: tear down a stale container first.
            self.stop()

        ensure_image()

        name = f"agentgym-{uuid.uuid4().hex[:10]}"
        run = _run_host(
            [
                "docker", "run", "-d",
                "--name", name,
                "--network", "none",
                "--memory", "512m",
                "--cpus", "0.5",
                "--pids-limit", "256",
                "-w", str(self.workdir),
                self.image,
                "sleep", "infinity",
            ],
            timeout=60,
        )
        if run.returncode != 0:
            raise SandboxError("failed to start container:\n" + run.stdout + run.stderr)
        self.container_id = run.stdout.strip()

        # Ensure workdir exists.
        self.exec(f"mkdir -p {self.workdir}")

        # Create an unprivileged 'agent' user. The agent's run_command runs as
        # this user, so it cannot read root-owned hidden-test files, while
        # run_tests (root) can. Best-effort: if useradd is missing the sandbox
        # still works, just without the read barrier.
        self.exec(
            "id agent >/dev/null 2>&1 || useradd -m -s /bin/sh agent 2>/dev/null || "
            "adduser -D agent 2>/dev/null || true"
        )

        if files:
            for path, content in files.items():
                self.write_file(path, content)

    def stop(self) -> None:
        """Tear down the container. Safe to call multiple times."""
        if self.container_id is None:
            return
        _run_host(["docker", "rm", "-f", self.container_id], timeout=60)
        self.container_id = None

    # Context-manager sugar.
    def __enter__(self) -> "Sandbox":
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop()

    # -- operations --------------------------------------------------------

    def _require_container(self) -> str:
        if self.container_id is None:
            raise SandboxError("sandbox not started")
        return self.container_id

    def _resolve(self, path: str) -> PurePosixPath:
        p = PurePosixPath(path)
        return p if p.is_absolute() else self.workdir / p

    def exec(self, command: str, user: str | None = None) -> SandboxResult:
        """Run a shell command inside the container with a wall-clock timeout.

        ``user`` optionally switches the exec UID (e.g. ``"agent"`` for the
        non-root sandbox user).
        """
        cid = self._require_container()
        docker_cmd = ["docker", "exec", "-w", str(self.workdir)]
        if user:
            docker_cmd += ["--user", user]
        docker_cmd += [cid, "sh", "-c", command]
        start = time.monotonic()
        try:
            proc = _run_host(docker_cmd, timeout=self.timeout_s)
        except subprocess.TimeoutExpired as exc:
            duration = time.monotonic() - start
            out = exc.stdout or b""
            err = exc.stderr or b""
            return SandboxResult(
                exit_code=124,
                stdout=out.decode() if isinstance(out, bytes) else (out or ""),
                stderr=(err.decode() if isinstance(err, bytes) else (err or ""))
                + f"\n[sandbox] command exceeded {self.timeout_s}s timeout",
                duration_s=duration,
                timed_out=True,
            )
        return SandboxResult(
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            duration_s=time.monotonic() - start,
        )

    def write_file(self, path: str, content: str) -> None:
        """Write a file into the sandbox workspace via ``docker cp``."""
        cid = self._require_container()
        dest = self._resolve(path)

        # Make parent dir inside the container.
        parent = dest.parent
        if str(parent) not in ("", "/"):
            mk = self.exec(f"mkdir -p {parent}")
            if not mk.ok:
                raise SandboxError(f"could not create dir {parent}: {mk.stderr}")

        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            cp = _run_host(["docker", "cp", tmp_path, f"{cid}:{dest}"], timeout=60)
            if cp.returncode != 0:
                raise SandboxError(f"docker cp failed for {path}: {cp.stderr}")
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def read_file(self, path: str) -> str:
        """Read a file from the sandbox workspace (as root)."""
        dest = self._resolve(path)
        res = self.exec(f"cat {dest}")
        if not res.ok:
            raise SandboxError(f"could not read {path}: {res.stderr}")
        return res.stdout

    def lock_path(self, path: str) -> None:
        """Make a path root-only (0700/0600) so the 'agent' user cannot read it."""
        dest = self._resolve(path)
        self.exec(f"chown -R root:root {dest} 2>/dev/null; chmod -R go-rwx {dest}")

    def grant_agent(self, path: str) -> None:
        """Give the 'agent' user ownership of a path (read/write)."""
        dest = self._resolve(path)
        self.exec(f"chown -R agent {dest} 2>/dev/null || true")

    def list_files(self) -> list[str]:
        """List workspace files (relative paths), excluding caches."""
        res = self.exec(
            f"find {self.workdir} -type f -not -path '*/__pycache__/*' "
            f"-not -name '*.pyc' | sed 's|{self.workdir}/||'"
        )
        if not res.ok:
            return []
        return [line for line in res.stdout.splitlines() if line.strip()]
