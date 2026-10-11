"""Tests for the Ultra code-quality judge (heuristic/offline path)."""

from agent import Judge
from agent.judge import _parse_json_score


def test_heuristic_minimal_change_scores_high():
    j = Judge(force_stub=True)
    orig = "def f(a, b):\n    return a / b\n"
    fixed = "def f(a, b):\n    if b == 0:\n        return 0\n    return a / b\n"
    r = j.score("safe divide", "guard zero", orig, fixed)
    assert 1 <= r.score <= 10
    assert r.score >= 6  # small, clean change
    assert r.backend == "stub"


def test_heuristic_no_change_scores_low():
    j = Judge(force_stub=True)
    code = "def f(x):\n    return x\n"
    r = j.score("noop", "unchanged", code, code)
    assert r.score <= 3


def test_parse_json_score_strict():
    assert _parse_json_score('{"score": 8, "reasoning": "clean"}') == (8, "clean")


def test_parse_json_score_clamps():
    score, _ = _parse_json_score('{"score": 42, "reasoning": "x"}')
    assert score == 10


def test_parse_json_score_fallback_integer():
    score, _ = _parse_json_score("I would rate this a 7 out of 10.")
    assert score == 7
