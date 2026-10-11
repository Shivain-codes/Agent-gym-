"""Record golden demo fixtures.

Copies three nicely-passing episodes into trajectories/fixtures/ under stable
``golden-*`` episode ids. The replay viewer reads fixtures exactly like live
episodes, so the demo is deterministic even if the live API/Docker is flaky.

Pass source episode ids (filename stems) as args, or let it auto-pick three
passing Nano episodes (one easy, one hard, one expert) from trajectories/.
"""

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / "trajectories"
FIXTURES = LIVE / "fixtures"

# Preferred source episodes (task prefix -> golden name) if present.
PREFERRED = [
    ("easy-03_nano", "golden-easy-03-nano"),
    ("hard-01_nano", "golden-hard-01-nano"),
    ("expert-03_nano", "golden-expert-03-nano"),
]


def _find_latest(prefix: str) -> Path | None:
    matches = sorted(LIVE.glob(f"{prefix}_*.jsonl"))
    return matches[-1] if matches else None


def _retag(src: Path, golden_id: str) -> list[str]:
    """Read a trajectory, rewrite its episode_id to golden_id, return lines."""
    out_lines = []
    for line in src.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        if "episode_id" in obj:
            obj["episode_id"] = golden_id
        out_lines.append(json.dumps(obj))
    return out_lines


def main() -> int:
    FIXTURES.mkdir(parents=True, exist_ok=True)

    pairs: list[tuple[Path, str]] = []
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            src = LIVE / f"{arg}.jsonl"
            if not src.exists():
                print(f"skip: {arg} not found")
                continue
            golden = "golden-" + re.sub(r"_\d+T\d+$", "", arg)
            pairs.append((src, golden))
    else:
        for prefix, golden in PREFERRED:
            src = _find_latest(prefix)
            if src:
                pairs.append((src, golden))

    if not pairs:
        print("No source episodes found to record as fixtures.")
        return 1

    for src, golden in pairs:
        lines = _retag(src, golden)
        dest = FIXTURES / f"{golden}.jsonl"
        dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"recorded {golden}  <- {src.name}  ({len(lines)} events)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
