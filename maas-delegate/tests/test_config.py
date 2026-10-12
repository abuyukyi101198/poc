from __future__ import annotations

from pathlib import Path

import pytest

from maas_delegate.config import ConfigError, load_config, load_overrides


def test_defaults_when_no_config_file(tmp_path: Path) -> None:
    config = load_config(None, base_dir=tmp_path)
    assert config.archive_dir == tmp_path / "mm-archive"
    assert config.db_path == tmp_path / ".maas-delegate" / "db.sqlite"
    assert config.permalink_base is None


def test_loads_values_and_resolves_relative_paths(tmp_path: Path) -> None:
    path = tmp_path / "conf" / "maas-delegate.toml"
    path.parent.mkdir()
    path.write_text('archive_dir = "../archive"\npermalink_base = "https://x/pl/"\n')
    config = load_config(path)
    assert config.archive_dir == path.parent / "../archive"
    assert config.data_dir == path.parent / ".maas-delegate"
    assert config.permalink_base == "https://x/pl/"


def test_default_config_file_is_picked_up(tmp_path: Path) -> None:
    (tmp_path / "maas-delegate.toml").write_text('data_dir = "idx"\n')
    assert load_config(None, base_dir=tmp_path).data_dir == tmp_path / "idx"


def test_channel_settings(tmp_path: Path) -> None:
    path = tmp_path / "c.toml"
    path.write_text(
        'eod_channel = "team"\nteam_channel = "team-private"\n'
        'sub_team_channels = ["team-ui", "team"]\nbots = ["teambot"]\n'
    )
    config = load_config(path)
    assert config.channels == ("team", "team-private", "team-ui")
    assert config.bots == {"System", "teambot"}
    config.require_channels()
    with pytest.raises(ConfigError, match="eod_channel and team_channel"):
        load_config(None, base_dir=tmp_path).require_channels()


def test_patterns(tmp_path: Path) -> None:
    path = tmp_path / "c.toml"
    path.write_text(
        "[patterns]\nchatter = ['\\bstandup notes\\b']\nbug_id = ['\\bgh-(\\d+)']\n"
        'command_words = ["kubectl"]\n'
    )
    patterns = load_config(path).patterns
    assert patterns.chatter == (r"\bstandup notes\b",)
    assert patterns.bug_id == (r"\bgh-(\d+)",)
    assert patterns.command_words == ("kubectl",) and patterns.bug == ()


@pytest.mark.parametrize(
    "content",
    [
        "top_k = 7\n",
        "archive_dir = 1\n",
        "archive_dir = true\n",
        "eod_channel = []\n",
        'bots = "maasbot"\n',
        "sub_team_channels = [1]\n",
        "not toml = = \n",
        'patterns = ["x"]\n',
        "[patterns]\nbogus = []\n",
        "[patterns]\nbug = ['(unclosed']\n",
        "[patterns]\nbug_id = ['no-group-\\d+']\n",
        "[patterns]\nbug_id = ['(a)(\\d+)']\n",
        '[patterns]\ncommand_words = "snap"\n',
    ],
)
def test_invalid_config(tmp_path: Path, content: str) -> None:
    path = tmp_path / "c.toml"
    path.write_text(content)
    with pytest.raises(ConfigError):
        load_config(path)


def test_missing_explicit_config(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        load_config(tmp_path / "nope.toml")


def test_overrides_file(tmp_path: Path) -> None:
    path = tmp_path / "o.toml"
    path.write_text(
        'include = ["A"]\nexclude = ["B"]\nformer = ["C"]\n[aliases]\n"A" = ["Al", "A. A."]\n'
    )
    overrides = load_overrides(path)
    assert overrides.status_for("A") == "current"
    assert overrides.status_for("B") == "external"
    assert overrides.status_for("C") == "former"
    assert overrides.status_for("D") is None
    assert overrides.aliases == {"A": ("Al", "A. A.")}
    assert load_overrides(tmp_path / "missing.toml").include == frozenset()


@pytest.mark.parametrize(
    "content", ['aliases = "x"\n', 'include = "A"\n', "bogus = []\n", "= broken\n"]
)
def test_invalid_overrides(tmp_path: Path, content: str) -> None:
    path = tmp_path / "o.toml"
    path.write_text(content)
    with pytest.raises(ConfigError):
        load_overrides(path)
