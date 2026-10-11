"""Structural smoke tests for the agent package."""

from agent import AgentRunner, Trajectory, Step, TrajectoryWriter, make_episode_id
from agent import MODEL_REGISTRY, DEFAULT_MODEL, resolve_model


def test_agent_exports_exist():
    assert AgentRunner is not None
    assert Trajectory is not None
    assert Step is not None
    assert TrajectoryWriter is not None
    assert hasattr(AgentRunner, "run_episode")


def test_model_registry():
    assert "nano" in MODEL_REGISTRY
    assert "super" in MODEL_REGISTRY
    assert "ultra" in MODEL_REGISTRY
    assert DEFAULT_MODEL == "nano"
    assert resolve_model("nano") == MODEL_REGISTRY["nano"]
    assert resolve_model("custom/id") == "custom/id"


def test_episode_id_format():
    eid = make_episode_id("med-02", "nano", when=0)
    assert eid.startswith("med-02_nano_")
