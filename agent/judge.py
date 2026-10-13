"""Ultra code-quality judge for AgentGym.

After an episode ends, Nemotron 3 Ultra scores the agent's final code 1-10 on
quality: readability, minimal diff, and absence of hacks. The score is stored
in the trajectory alongside the test-based reward so the dashboard can show
both ("did it pass?" vs "is the fix any good?").

When no API key is present (offline), a deterministic heuristic judge is used
so the pipeline still produces a score and the dashboard still renders.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

from agent.llm import DEFAULT_BASE_URL, MAX_TOKENS, resolve_base_url, resolve_model

JUDGE_MODEL = "ultra"

_GRADING_SYSTEM = (
    "You are a senior staff engineer grading a bug fix. You score the FINAL "
    "code on quality from 1 to 10, where:\n"
    "  1-3  = broken, hacky, or hard-coded to the tests;\n"
    "  4-6  = works but clumsy, over-complicated, or stylistically poor;\n"
    "  7-8  = clean, idiomatic, minimal change that addresses the real defect;\n"
    "  9-10 = exemplary: minimal diff, readable, no hacks, handles edge cases.\n\n"
    "Judge ONLY code quality, not whether tests passed (that is scored "
    "separately). Penalize: special-casing test inputs, dead code, needless "
    "rewrites, and changes unrelated to the bug. Reward a small, correct, "
    "readable diff.\n\n"
    "Respond with STRICT JSON only: "
    '{"score": <int 1-10>, "reasoning": "<one or two sentences>"}'
)


@dataclass
class JudgeResult:
    score: int
    reasoning: str
    model: str
    backend: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "reasoning": self.reasoning,
            "model": self.model,
            "backend": self.backend,
        }


def _grading_prompt(task_title: str, task_description: str,
                    original: str, final: str) -> str:
    return (
        f"TASK: {task_title}\n{task_description}\n\n"
        f"ORIGINAL (buggy) CODE:\n```python\n{original}\n```\n\n"
        f"AGENT'S FINAL CODE:\n```python\n{final}\n```\n\n"
        "Grade the final code's quality. Return STRICT JSON only."
    )


def _parse_json_score(text: str) -> tuple[int, str]:
    """Extract {score, reasoning} from model output, tolerating extra prose."""
    # Prefer a fenced or inline JSON object.
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            score = int(obj.get("score"))
            reasoning = str(obj.get("reasoning", "")).strip()
            return max(1, min(10, score)), reasoning
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    # Fallback: find the first integer 1-10 in the text.
    num = re.search(r"\b([1-9]|10)\b", text)
    if num:
        return int(num.group(1)), text.strip()[:200]
    raise ValueError("could not parse a score from judge output")


def _heuristic_score(original: str, final: str) -> JudgeResult:
    """Offline fallback: a crude but deterministic quality proxy.

    Rewards small diffs and penalizes obvious test-hardcoding / bloat.
    """
    orig_lines = original.splitlines()
    final_lines = final.splitlines()
    added = max(0, len(final_lines) - len(orig_lines))

    score = 8
    reasons = []
    if added <= 2:
        reasons.append("minimal change")
    elif added <= 6:
        score -= 1
        reasons.append("moderate added lines")
    else:
        score -= 3
        reasons.append("large rewrite")

    lowered = final.lower()
    if "assert" in lowered or "# test" in lowered:
        score -= 2
        reasons.append("suspicious test references in code")
    if final.strip() == original.strip():
        score = 3
        reasons = ["no change from original"]

    score = max(1, min(10, score))
    return JudgeResult(
        score=score,
        reasoning="Heuristic (offline): " + ", ".join(reasons) + ".",
        model="heuristic",
        backend="stub",
    )


class Judge:
    """Scores final code quality 1-10 using Nemotron Ultra (or a heuristic)."""

    def __init__(self, model: str = JUDGE_MODEL, force_stub: bool = False) -> None:
        self.model = model
        self.model_id = resolve_model(model)
        self.force_stub = force_stub

    def _has_key(self) -> bool:
        return bool(
            os.environ.get("NEBIUS_API_KEY") or os.environ.get("NVIDIA_API_KEY")
        )

    def score(
        self,
        task_title: str,
        task_description: str,
        original_code: str,
        final_code: str,
    ) -> JudgeResult:
        if self.force_stub or not self._has_key():
            return _heuristic_score(original_code, final_code)

        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=os.environ.get("NEBIUS_API_KEY")
                or os.environ.get("NVIDIA_API_KEY"),
                base_url=resolve_base_url(),
            )
            resp = client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": _GRADING_SYSTEM},
                    {
                        "role": "user",
                        "content": _grading_prompt(
                            task_title, task_description, original_code, final_code
                        ),
                    },
                ],
                max_tokens=MAX_TOKENS,
                temperature=0.0,
            )
            content = resp.choices[0].message.content or ""
            score, reasoning = _parse_json_score(content)
            return JudgeResult(
                score=score,
                reasoning=reasoning or "(no reasoning returned)",
                model=self.model,
                backend="token_factory",
            )
        except Exception as exc:
            # Never let a judge failure sink the episode; fall back.
            fallback = _heuristic_score(original_code, final_code)
            fallback.reasoning = f"Judge call failed ({exc}); " + fallback.reasoning
            return fallback
