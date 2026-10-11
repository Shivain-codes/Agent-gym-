"""Structural smoke tests so `pytest --collect-only` finds the package."""

from gym import GymEnv, Reward, Sandbox, TaskLoader


def test_gym_exports_exist():
    assert TaskLoader is not None
    assert Sandbox is not None
    assert GymEnv is not None
    assert Reward is not None
