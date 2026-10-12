"""LLM client layer for AgentGym.

Two backends behind one interface:

- :class:`TokenFactoryClient` — real Nemotron models via the Nebius Token
  Factory OpenAI-compatible endpoint. Used when ``NEBIUS_API_KEY`` is set.
- :class:`CannedClient` — a deterministic, offline backend that fakes a model
  so episodes still run (and the leaderboard still gets variance) without a
  key. Used automatically when no key is present.

The agent loop talks to whichever backend ``get_client`` returns; it only needs
``chat(messages, tools)`` returning an :class:`LLMResponse`.

Nemotron models are reasoning models: reasoning tokens count against
``max_tokens``, so we request a generous budget or the model can hit the length
limit before emitting its tool call.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

# Friendly alias -> Token Factory model id.
# Friendly alias -> model id. IDs verified against
# https://integrate.api.nvidia.com/v1/models (2026-10-13).
MODEL_REGISTRY: dict[str, str] = {
    "nano": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "super": "nvidia/nemotron-3-super-120b-a12b",
    "ultra": "nvidia/nemotron-3-ultra-550b-a55b",
}
DEFAULT_MODEL = "nano"
DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1/"

# Reasoning models need headroom beyond the tool call itself.
MAX_TOKENS = 8192


def resolve_model(model: str) -> str:
    """Map a friendly alias (or a raw id) to a Token Factory model id."""
    if model in MODEL_REGISTRY:
        return MODEL_REGISTRY[model]
    # Allow passing a full model id directly.
    return model


@dataclass
class ToolCall:
    """One tool call requested by the model."""

    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResponse:
    """Normalized model response."""

    tool_call: ToolCall | None
    content: str = ""
    finish_reason: str = ""
    raw: Any = None


class LLMError(RuntimeError):
    """Raised on an unrecoverable LLM backend error."""


class TokenFactoryClient:
    """Real Nemotron client over the OpenAI-compatible Token Factory API."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        api_key: str | None = None,
        base_url: str | None = None,
        max_tokens: int = MAX_TOKENS,
        temperature: float = 0.3,
    ) -> None:
        from openai import OpenAI  # imported lazily so the stub path needs no SDK

        self.model_alias = model
        self.model_id = resolve_model(model)
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._client = OpenAI(
            api_key=api_key
            or os.environ.get("NEBIUS_API_KEY")
            or os.environ.get("NVIDIA_API_KEY"),
            base_url=base_url
            or os.environ.get("NEBIUS_BASE_URL")
            or os.environ.get("NVIDIA_BASE_URL", DEFAULT_BASE_URL),
        )

    @property
    def is_stub(self) -> bool:
        return False

    def chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> LLMResponse:
        try:
            resp = self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )
        except Exception as exc:  # network, auth, rate limit, etc.
            raise LLMError(f"Token Factory call failed: {exc}") from exc

        choice = resp.choices[0]
        msg = choice.message
        tool_call = None
        if msg.tool_calls:
            tc = msg.tool_calls[0]
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_call = ToolCall(name=tc.function.name, arguments=args)

        return LLMResponse(
            tool_call=tool_call,
            content=msg.content or "",
            finish_reason=choice.finish_reason or "",
            raw=resp,
        )


class CannedClient:
    """Deterministic offline backend used when no API key is available.

    It inspects the running conversation (the latest observation) and plays a
    scripted policy per task so trajectories are realistic: it inspects files,
    runs tests, applies a fix when it knows one, and sometimes fails. The
    policy is intentionally imperfect to give the leaderboard variance.

    The policy is injected by the runner via ``set_policy`` so this class stays
    task-agnostic.
    """

    def __init__(self, model: str = DEFAULT_MODEL) -> None:
        self.model_alias = model
        self.model_id = resolve_model(model)
        self._policy: list[ToolCall] = []
        self._cursor = 0

    @property
    def is_stub(self) -> bool:
        return True

    def set_policy(self, policy: list[ToolCall]) -> None:
        self._policy = policy
        self._cursor = 0

    def chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> LLMResponse:
        if self._cursor < len(self._policy):
            tc = self._policy[self._cursor]
            self._cursor += 1
            return LLMResponse(
                tool_call=tc,
                content=f"[stub] step {self._cursor}: {tc.name}",
                finish_reason="tool_calls",
            )
        # Policy exhausted: keep probing with run_tests (bounded by step cap).
        return LLMResponse(
            tool_call=ToolCall(name="run_tests", arguments={}),
            content="[stub] policy exhausted; running tests",
            finish_reason="tool_calls",
        )


def have_api_key() -> bool:
    return bool(
        os.environ.get("NEBIUS_API_KEY") or os.environ.get("NVIDIA_API_KEY")
    )


def get_client(model: str = DEFAULT_MODEL, force_stub: bool = False):
    """Return a live client when a key is present, else the canned stub."""
    if force_stub or not have_api_key():
        return CannedClient(model=model)
    return TokenFactoryClient(model=model)
