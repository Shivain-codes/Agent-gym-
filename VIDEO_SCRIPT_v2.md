# AgentGym Demo Video Script v2 — record-ready (target: ~2:15)

Word-timed at a calm ~135 wpm. Beats are marked with cue times so you can
re-record a single beat if you flub it. The numbers below are the locked
demo story: all three tiers pass everything; the spread is efficiency
(avg steps 5.9 → 5.2 across tiers) and judge quality (9.88 → 9.6).

## Beat 1 — The problem (0:00–0:25) ~78 words

**Visuals:** terminal or hero shot → cut to the replay viewer on the live site.

> "Coding agents are everywhere now — writing code, fixing bugs, shipping
> PRs. But here's the uncomfortable question nobody answers well: how do
> you know an agent is actually good? Pass or fail on a hidden test tells
> you nothing about *how* it got there — how many steps it wasted, whether
> the fix was clean, whether it just got lucky. So I built AgentGym: a
> reinforcement-learning gym for coding agents. Broken repos in, measured
> behavior out."

## Beat 2 — The product, live (0:25–1:35) ~84 words

**Visuals:** live site at agentgym.onrender.com. Click "Explore the gym"
— it scrolls straight into the replay viewer. Open one episode; step
through the numbered steps (01 / 02 / 03), point at the trajectory bar,
the code diff, the sandbox output, the judge score.

> "This is the live site. Every episode is a real Docker sandbox with a
> broken repo and hidden tests. Hit 'Explore the gym' and you drop straight
> into the replay viewer. Pick any episode — you see the full trajectory:
> each step numbered, the code diff, the sandbox output, and the judge
> score. Watch the agent find the bug, apply a fix, and re-run tests until
> they're green. No black boxes — every edit, every command, every test
> result, reviewable."

## Beat 3 — The results, the headline (1:35–2:10) ~105 words

**Visuals:** Leaderboard page — the three model tiers side by side.
Then click Export dataset → show the JSONL + datasheet download.

> "Here's the part I'm proudest of. I benchmarked three Nemotron tiers —
> Nano, Super, Ultra. All three pass everything. So the real story isn't
> pass rate — it's the spread. Average solve steps run from 5.9 down to 5.2
> across tiers, and judge quality scores run from 9.88 to 9.6. Efficiency
> and quality don't move in lockstep — and AgentGym is the tool that makes
> that tradeoff measurable. Every trajectory exports as a JSONL dataset
> with a datasheet, so the results feed straight back into training the
> next generation of agents."

## Beat 4 — Close (2:10–2:30) ~35 words

**Visuals:** quick montage — Nebius Token Factory logo, NVIDIA, final
screen with the GitHub repo link.

> "AgentGym runs on Nebius Token Factory and Nemotron models — the
> OpenAI-compatible API let me swap tiers without touching the agent loop.
> The repo is public with an MIT license. Go break some agents."

**Total: ~300 words ≈ 2:12–2:20 at a calm 135 wpm.** Well inside the 3-min cap.

## Recording checklist

1. Hard-refresh agentgym.onrender.com first — confirm today's QA fixes
   (nav spacing, ticker, button, card texture) are live in the recording.
2. Pre-load: hero scrolled to top, one episode replay open, leaderboard
   tab ready. Record at 1080p, browser at 100% zoom.
3. One take is realistic — there's no backend spin-up wait on this site.
   Flub a beat? Pause 2 seconds, redo just that beat, cut in edit.
4. Upload to YouTube, verify it plays in incognito before linking anywhere.

## Devpost Token Factory feedback paragraph (from v1, reuse as-is)

"Integrating with the Nebius Token Factory was a seamless experience. The
OpenAI-compatible API allowed us to rapidly switch between Nemotron Nano,
Super, and Ultra models without changing a single line of our agent loop.
The low latency and high throughput were critical for running hundreds of
sandbox episodes during our benchmarking phase, making it the ideal
infrastructure for an RL-style gym."
