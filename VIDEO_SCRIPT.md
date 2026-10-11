# AgentGym Video Script (Target: < 3 min)

## Beat 1: The Problem (0:00 - 0:45)
**Visuals:** 
- Screen recording of a terminal showing a broken Python file (e.g., a simple logic error in a divide function).
- Running `pytest` and showing a wall of red FAILED markers.
- Quick cut to the AgentGym Task list on the dashboard.

**Audio/Voiceover:**
"Coding agents are powerful, but evaluating them is hard. How do we know if an agent actually understands the bug, or if it's just guessing? Meet AgentGym: an RL gym for coding agents. We provide a broken repo and a set of hidden tests. The goal: fix the code without breaking existing functionality."

## Beat 2: The Solution in Action (0:45 - 1:45)
**Visuals:**
- Open the Dashboard -> Episode Replay.
- Select a 'Nano' model episode.
- Step through the trajectory using the arrow keys.
- Highlight the 'Code Diff' panel showing the agent's first edit (correctly diffed against the original file).
- Show the 'Sandbox Output' showing the tests turning green.
- Fast-forward to the 'solved' badge in the header.

**Audio/Voiceover:**
"With our replay viewer, we can watch the agent's thought process live. Here, Nemotron Nano identifies the bug, applies a precise fix, and verifies it in a secure Docker sandbox. No more black-box evaluations—we see every edit, every command, and every test result in real-time."

## Beat 3: Scaling & Results (1:45 - 2:45)
**Visuals:**
- Switch to the Leaderboard view.
- Show the comparison between Nano, Super, and Ultra models.
- Point out the 'Avg Reward' and 'Pass Rate' metrics.
- Click the new 'Export Dataset' button.
- Show the resulting `.jsonl` bundle and the generated Datasheet.

**Audio/Voiceover:**
"AgentGym allows us to benchmark different model tiers—from Nano to Ultra—across a diverse task set. By exporting these trajectories as a standardized dataset, we create a reusable training loop for the next generation of coding LLMs."

## Closing: The Tech Stack (2:45 - 3:00)
**Visuals:**
- Quick montage: Nebius Token Factory logo, NVIDIA logo, and the AgentGym architecture diagram.
- Final screen: GitHub repo link and "Built with Nemotron".

**Audio/Voiceover:**
"Powered by Nebius Token Factory and Nemotron models, AgentGym turns coding evaluation into a measurable science. Check out the repo to start training your own agents."

---

## Devpost Feedback Paragraph (Token Factory)
"Integrating with the Nebius Token Factory was a seamless experience. The OpenAI-compatible API allowed us to rapidly switch between Nemotron Nano, Super, and Ultra models without changing a single line of our agent loop. The low latency and high throughput were critical for running hundreds of sandbox episodes during our benchmarking phase, making it the ideal infrastructure for an RL-style gym."
