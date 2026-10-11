# AgentGym

AgentGym is a high-fidelity training and evaluation gym for coding agents. It provides a controlled environment where agents are given broken repositories, must apply fixes in a secure Docker sandbox, and are scored based on hidden test suites and code quality.

## 🏗 Architecture

The system follows a closed-loop execution pipeline:

`Task` $\rightarrow$ `Agent` $\rightarrow$ `Sandbox` $\rightarrow$ `Reward` $\rightarrow$ `Leaderboard`

1. **Task**: A JSON-defined problem containing a buggy codebase and a set of hidden pytest suites.
2. **Agent**: An LLM (Nemotron Nano/Super/Ultra) that observes the environment and emits actions (`edit_file`, `run_command`, `run_tests`).
3. **Sandbox**: A lightweight Docker container that isolates the agent's execution, protecting the host system while providing a real Linux environment.
4. **Reward**: A multi-factor scoring system:
   - **Test Reward**: Fraction of hidden tests passing.
   - **Step Penalty**: -0.02 for every step beyond a free budget of 15.
   - **Regression Penalty**: -0.05 for every previously passing test that is broken.
5. **Leaderboard**: Aggregates trajectories to compare model performance across pass rates, average steps, and judge scores.

## 🚀 Tech Stack

- **Models**: Nemotron Nano, Super, and Ultra.
- **Inference**: [Nebius Token Factory](https://api.tokenfactory.nebius.com/v1/) (OpenAI-compatible API).
- **Backend**: FastAPI + Python 3.11.
- **Frontend**: React + Vite + Tailwind CSS.
- **Isolation**: Docker.

## 🛠 Setup

### Prerequisites
- Python 3.11+
- Node 18+
- Docker installed and running (`docker run hello-world` should work)

### Backend
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your NEBIUS_API_KEY to .env

# Start the API
uvicorn api.main:app --reload
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```
The dashboard will be available at `http://localhost:5173`.

## 📝 Adding a Task

Tasks are stored as JSON files in the `tasks/` directory. To add a new task:

1. Create a file `tasks/your-task-id.json`.
2. Follow the schema in `tasks/validate.py`:
   - `id`: Unique identifier.
   - `title`: Short name of the problem.
   - `description`: The prompt given to the agent.
   - `files`: A map of relative paths to the buggy source code.
   - `hidden_tests`: A map of relative paths to the pytest files used for scoring.
   - `difficulty`: Integer (1: Easy, 2: Medium, 3: Hard, 4: Expert).

Example:
```json
{
  "id": "divide-by-zero",
  "title": "Fix Division by Zero",
  "description": "The divide function fails when the divisor is 0.",
  "files": { "math_utils.py": "def divide(a, b):\n    return a / b" },
  "hidden_tests": { "test_div.py": "import pytest\nfrom math_utils import divide\n\ndef test_zero():\n    with pytest.raises(ZeroDivisionError):\n        divide(10, 0)" },
  "difficulty": 1
}
```

## ⚖️ License
MIT License. See `LICENSE` for details.
