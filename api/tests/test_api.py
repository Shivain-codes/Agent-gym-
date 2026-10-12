"""Smoke tests for the AgentGym API routes (no Docker / no LLM required)."""

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_tasks_lists_real_tasks():
    r = client.get("/api/tasks")
    assert r.status_code == 200
    tasks = r.json()
    assert len(tasks) >= 25
    ids = {t["id"] for t in tasks}
    assert "easy-01" in ids
    assert "hard-02" in ids
    assert "expert-01" in ids
    # Difficulty badges include the expert tier.
    difficulties = {t["difficulty"] for t in tasks}
    assert "expert" in difficulties


def test_run_unknown_task_404():
    r = client.post("/api/episodes/run", json={"task_id": "does-not-exist", "model": "nano"})
    assert r.status_code == 404


def test_get_unknown_episode_404():
    r = client.get("/api/episodes/nope_nano_123")
    assert r.status_code == 404


def test_leaderboard_shape():
    r = client.get("/api/leaderboard")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    # When episodes exist, rows carry the new judge/steps fields.
    for row in rows:
        assert "avg_steps" in row
        assert "avg_judge_score" in row


def test_leaderboard_matrix_shape():
    r = client.get("/api/leaderboard/matrix")
    assert r.status_code == 200
    cells = r.json()
    assert isinstance(cells, list)
    for c in cells:
        assert {"model", "task_id", "pass_rate", "avg_steps"} <= set(c)


def test_fixtures_endpoint():
    r = client.get("/api/fixtures")
    assert r.status_code == 200
    fixtures = r.json()
    assert isinstance(fixtures, list)
    # Golden fixtures are recorded under golden-* ids and flagged is_fixture.
    for f in fixtures:
        assert f["is_fixture"] is True


def test_episodes_list_shape():
    r = client.get("/api/episodes")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
