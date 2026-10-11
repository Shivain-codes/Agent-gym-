"""Agent loop for AgentGym.

``AgentRunner.run_episode(task, model)`` drives a Nemotron model (or the canned
offline stub) through a :class:`~gym.env.GymEnv` episode. Each turn the model
emits exactly ONE action as a tool call; the env executes it and the resulting
observation is fed back. The loop ends when the hidden tests pass, the step cap
is reached, or the model gives up. Everything is streamed to a JSONL
trajectory.

Actions exposed as tools: ``edit_file``, ``run_command``, ``run_tests``,
``give_up``.
"""

from __future__ import annotations

from typing import Any

from agent.llm import (
    DEFAULT_MODEL,
    CannedClient,
    LLMError,
    ToolCall,
    get_client,
)
from agent.judge import Judge
from agent.policies import canned_policy
from agent.trajectory import (
    Step,
    Trajectory,
    TrajectoryWriter,
    make_episode_id,
)
from gym.env import ActionError, GymEnv
from gym.sandbox import Sandbox
from gym.task_loader import Task

# Tool schemas advertised to the model (OpenAI function-calling format).
TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Overwrite a file in the workspace with new contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path."},
                    "new_content": {
                        "type": "string",
                        "description": "Full new contents of the file.",
                    },
                },
                "required": ["path", "new_content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command in the workspace (e.g. cat, ls).",
            "parameters": {
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "Shell command."}
                },
                "required": ["cmd"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_tests",
            "description": "Run the hidden test suite and see pass/fail results.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "give_up",
            "description": "Abandon the task when you cannot make progress.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why you are stopping."}
                },
                "required": [],
            },
        },
    },
]


def _system_prompt(task: Task) -> str:
    files = "\n".join(f"  - {p}" for p in task.files) or "  (none)"
    return (
        "You are an autonomous coding agent fixing a bug in a small Python repo.\n"
        "Exactly ONE file needs editing to make the hidden tests pass.\n\n"
        f"TASK: {task.title}\n{task.description}\n\n"
        f"EDITABLE FILES:\n{files}\n\n"
        "You interact ONLY through tool calls. Each turn, call exactly ONE tool:\n"
        "  - run_command (e.g. `cat <file>`) to inspect code,\n"
        "  - edit_file to rewrite a file with the full corrected contents,\n"
        "  - run_tests to check your work,\n"
        "  - give_up ONLY as a last resort after several real attempts.\n\n"
        "Follow this workflow and do not skip steps:\n"
        "  1. run_command `ls -la` to see the workspace.\n"
        "  2. run_command to `cat` the buggy file and read it carefully.\n"
        "  3. run_tests FIRST to reproduce the failure and read the error.\n"
        "  4. Think about the specific defect, then edit_file with the "
        "COMPLETE corrected file contents.\n"
        "  5. run_tests again to confirm your fix.\n"
        "  6. If any test still fails, inspect again, revise your edit, and "
        "re-run tests. Keep iterating — do NOT give up after one failed "
        "attempt.\n\n"
        "Never edit test files. Persistence matters: real debugging means "
        "reproducing the bug, fixing it, and verifying — several steps."
    )


class AgentRunner:
    """Runs a model through a single task episode and logs the trajectory."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        max_steps: int = 25,
        force_stub: bool = False,
        require_reproduce: bool = False,
        judge: bool = True,
    ) -> None:
        self.model = model
        self.max_steps = max_steps
        self.force_stub = force_stub
        # Whether to run the Ultra code-quality judge after the episode.
        self.judge = judge
        # When True, the episode's first action is a forced run_tests to
        # reproduce the failure before the model acts. This encodes the
        # "reproduce before fixing" discipline and makes short step budgets a
        # genuine constraint (the model cannot one-shot a fix in <2 moves).
        self.require_reproduce = require_reproduce

    def run_episode(
        self,
        task: Task,
        model: str | None = None,
        episode_id: str | None = None,
        sandbox: Sandbox | None = None,
    ) -> dict[str, Any]:
        """Run one episode against ``task`` and return a trajectory dict."""
        model = model or self.model
        episode_id = episode_id or make_episode_id(task.id, model)

        client = get_client(model=model, force_stub=self.force_stub)
        if isinstance(client, CannedClient):
            client.set_policy(canned_policy(task))

        writer = TrajectoryWriter(episode_id)
        writer.write_meta(
            task_id=task.id,
            model=model,
            model_id=client.model_id,
            backend="stub" if client.is_stub else "token_factory",
            max_steps=self.max_steps,
        )

        env = GymEnv(task, sandbox=sandbox or Sandbox(), max_steps=self.max_steps)
        trajectory = Trajectory(
            episode_id=episode_id,
            task_id=task.id,
            model=model,
            metadata={
                "backend": "stub" if client.is_stub else "token_factory",
                "model_id": client.model_id,
            },
        )

        reward_so_far = 0.0
        passed = False
        # Track the latest edited content per path so the judge can grade the
        # agent's final code against the original buggy source.
        latest_edits: dict[str, str] = {}
        try:
            obs = env.reset()
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": _system_prompt(task)},
                {"role": "user", "content": _format_observation(obs.last_output, obs)},
            ]

            # Optional forced reproduce-first step (counts as a real step).
            if self.require_reproduce:
                forced = ToolCall(name="run_tests", arguments={})
                messages.append(_assistant_tool_message(forced, "[forced] reproduce first"))
                sr = env.step({"type": "run_tests"})
                reward_so_far += sr.reward
                fstep = Step(
                    index=sr.observation.step_index,
                    thought="[forced] reproduce the failure before fixing",
                    action={"type": "run_tests"},
                    observation=sr.observation.last_output,
                    reward=sr.reward,
                    reward_so_far=round(reward_so_far, 6),
                )
                trajectory.steps.append(fstep)
                writer.write_step(fstep)
                messages.append(_tool_result_message(forced, sr.observation.last_output))

            no_tool_retries = 0
            # Hard cap on total model turns (incl. retries / invalid tools) so a
            # misbehaving model cannot spin forever without advancing the env.
            turn_budget = self.max_steps + 10
            while env.step_index < self.max_steps and turn_budget > 0:
                turn_budget -= 1
                resp = self._safe_chat(client, messages)

                # No tool call (e.g. reasoning hit the token cap). Nudge and
                # retry a couple of times before counting it as a give-up.
                if resp.tool_call is None:
                    if no_tool_retries < 2:
                        no_tool_retries += 1
                        messages.append(
                            {
                                "role": "user",
                                "content": "You did not call a tool. Respond with "
                                "exactly ONE tool call now (edit_file, run_command, "
                                "run_tests, or give_up).",
                            }
                        )
                        continue
                    tool_call = ToolCall(
                        name="give_up", arguments={"reason": "no tool call produced"}
                    )
                else:
                    no_tool_retries = 0
                    tool_call = resp.tool_call

                # Record the assistant turn so the model keeps context.
                messages.append(_assistant_tool_message(tool_call, resp.content))

                action, gave_up = _tool_to_action(tool_call)

                # Unknown tool name: tell the model the valid tools and retry.
                if action.get("type") == "__unknown__":
                    obs_text = (
                        f"[unknown tool {action['name']!r}] Use ONLY these tools: "
                        "edit_file(path, new_content), run_command(cmd), "
                        "run_tests(), give_up(reason)."
                    )
                    messages.append(_tool_result_message(tool_call, obs_text))
                    step = Step(
                        index=env.step_index + 1,
                        thought=resp.content,
                        action={"type": "invalid_tool", "name": action["name"]},
                        observation=obs_text,
                        reward=0.0,
                        reward_so_far=reward_so_far,
                    )
                    trajectory.steps.append(step)
                    writer.write_step(step)
                    continue

                if gave_up:
                    step = Step(
                        index=env.step_index + 1,
                        thought=resp.content,
                        action={"type": "give_up", **tool_call.arguments},
                        observation="agent gave up",
                        reward=0.0,
                        reward_so_far=reward_so_far,
                    )
                    trajectory.steps.append(step)
                    writer.write_step(step)
                    # Score the (unsolved) episode as it stands.
                    result = env.close()
                    reward_so_far = result.score
                    break

                try:
                    sr = env.step(action)
                except ActionError as exc:
                    # Feed the error back so the model can recover.
                    obs_text = f"[action rejected] {exc}"
                    messages.append(
                        _tool_result_message(tool_call, obs_text)
                    )
                    step = Step(
                        index=env.step_index + 1,
                        thought=resp.content,
                        action=action,
                        observation=obs_text,
                        reward=0.0,
                        reward_so_far=reward_so_far,
                    )
                    trajectory.steps.append(step)
                    writer.write_step(step)
                    continue

                reward_so_far += sr.reward
                obs_text = sr.observation.last_output
                # Remember successful edits for the quality judge.
                if action.get("type") == "edit_file" and action.get("path"):
                    latest_edits[action["path"]] = action.get("new_content", "")
                step = Step(
                    index=sr.observation.step_index,
                    thought=resp.content,
                    action=action,
                    observation=obs_text,
                    reward=sr.reward,
                    reward_so_far=round(reward_so_far, 6),
                )
                trajectory.steps.append(step)
                writer.write_step(step)

                messages.append(_tool_result_message(tool_call, obs_text))

                if sr.done:
                    breakdown = sr.info.get("reward_breakdown", {})
                    passed = bool(breakdown.get("test_score", 0.0) >= 1.0)
                    reward_so_far = breakdown.get("score", reward_so_far)
                    break
            else:
                # Loop exhausted without env terminating (shouldn't happen since
                # max_steps aligns): finalize defensively.
                result = env.close()
                reward_so_far = result.score
                passed = result.test_score >= 1.0
        finally:
            env.sandbox.stop()

        trajectory.final_reward = round(float(reward_so_far), 6)
        trajectory.passed = passed

        # Ultra code-quality judge on the agent's final code.
        if self.judge:
            fix_path = task.fix_file or next(iter(task.files), None)
            original = task.files.get(fix_path, "") if fix_path else ""
            final_code = latest_edits.get(
                fix_path, original
            ) if fix_path else ""
            try:
                judge = Judge(force_stub=self.force_stub)
                jr = judge.score(task.title, task.description, original, final_code)
                trajectory.judge_score = jr.score
                trajectory.judge_reasoning = jr.reasoning
                trajectory.metadata["judge"] = jr.to_dict()
            except Exception as exc:  # judge must never sink the episode
                trajectory.judge_reasoning = f"judge error: {exc}"

        writer.write_result(
            final_reward=trajectory.final_reward,
            passed=passed,
            steps=len(trajectory.steps),
            judge_score=trajectory.judge_score,
            judge_reasoning=trajectory.judge_reasoning,
        )
        return trajectory.to_dict()

    def _safe_chat(self, client, messages):
        try:
            return client.chat(messages, TOOLS)
        except LLMError:
            # On a backend error, treat it as a give-up signal rather than crash.
            from agent.llm import LLMResponse

            return LLMResponse(
                tool_call=ToolCall(
                    name="give_up", arguments={"reason": "backend error"}
                ),
                content="[error] backend call failed",
                finish_reason="error",
            )


# -- message / action helpers ---------------------------------------------


def _format_observation(last_output: str, obs) -> str:
    header = (
        f"step={obs.step_index} tests={obs.tests_passed}/{obs.tests_total}\n"
    )
    return header + (last_output or "(no output)")


def _assistant_tool_message(tool_call: ToolCall, content: str) -> dict[str, Any]:
    import json

    return {
        "role": "assistant",
        "content": content or None,
        "tool_calls": [
            {
                "id": f"call_{tool_call.name}",
                "type": "function",
                "function": {
                    "name": tool_call.name,
                    "arguments": json.dumps(tool_call.arguments),
                },
            }
        ],
    }


def _tool_result_message(tool_call: ToolCall, output: str) -> dict[str, Any]:
    return {
        "role": "tool",
        "tool_call_id": f"call_{tool_call.name}",
        "content": output[:4000],
    }


def _tool_to_action(tool_call: ToolCall) -> tuple[dict[str, Any], bool]:
    """Map a tool call to a GymEnv action. Returns (action, gave_up).

    Nemotron models sometimes emit their pre-trained tool names (e.g.
    ``str_replace_editor``, ``bash``) instead of our advertised schema. We map
    known aliases; genuinely unknown names are reported as an error so the model
    can retry — they are NOT treated as give_up.
    """
    name = tool_call.name
    args = tool_call.arguments or {}

    # Canonical action dispatch.
    if name == "give_up":
        return {}, True
    if name == "edit_file":
        return {"type": "edit_file", "path": args.get("path"),
                "new_content": args.get("new_content")}, False
    if name == "run_command":
        return {"type": "run_command", "cmd": args.get("cmd", "")}, False
    if name == "run_tests":
        return {"type": "run_tests"}, False

    # Alias mapping for known pre-trained tool names.
    if name in ("str_replace_editor", "str_replace"):
        # str_replace_editor typically sends {file_text, path} or
        # {old_str, new_str, path}. If it has file_text or new_str that looks
        # like full-file content, treat as edit_file.
        content = args.get("file_text") or args.get("new_str") or args.get("new_content") or ""
        path = args.get("path", "")
        if content:
            return {"type": "edit_file", "path": path, "new_content": content}, False
        # Partial edit with old_str/new_str — try to do a run_command cat to
        # guide the model back.
        return {"type": "run_command", "cmd": f"cat {path}"}, False

    if name in ("bash", "bash_command", "run_terminal_cmd", "execute_command"):
        cmd = args.get("cmd") or args.get("command") or args.get("code") or ""
        return {"type": "run_command", "cmd": cmd}, False

    # Unknown tool: signal error to the model so it can retry.
    return {"type": "__unknown__", "name": name}, False
