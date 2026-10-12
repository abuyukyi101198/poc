from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest

from maas_delegate import store
from maas_delegate.cli import main
from maas_delegate.config import Config, ConfigError, Overrides
from maas_delegate.evaluate import evaluate, labelled_cases, pseudo_label_cases
from maas_delegate.index import build_index
from maas_delegate.rank import Ranker

from .conftest import CHANNEL_SETTINGS_TOML

_open_conns: list[sqlite3.Connection] = []


@pytest.fixture(autouse=True)
def _close_connections() -> Iterator[None]:
    yield
    while _open_conns:
        _open_conns.pop().close()


def _ranker(config: Config) -> Ranker:
    conn = store.open_existing(config.db_path)
    _open_conns.append(conn)
    return Ranker(conn)


def test_index_builds_team_and_conversations(config: Config, overrides: Overrides) -> None:
    stats = build_index(config, overrides)
    assert stats.files > 0
    assert stats.team_counts == {"current": 2, "former": 1, "candidate": 1}
    assert stats.indexed == 5  # five expertise threads; the greeting thread is "other"
    conn = store.open_existing(config.db_path)
    kinds = dict(conn.execute("SELECT kind, COUNT(*) FROM conversations GROUP BY kind").fetchall())
    assert kinds["other"] == 1
    conn.close()


def test_index_rebuilds_from_scratch(config: Config, overrides: Overrides) -> None:
    build_index(config, overrides)
    day = next(config.archive_dir.rglob("2026-09-20.md"))
    day.write_text(day.read_text() + "\n**[2026-09-20T10:00:00Z] [newpost] Bob Brown**: +1\n")
    next(config.archive_dir.rglob("2026-10-03.md")).unlink()
    again = build_index(config, overrides)
    assert again.indexed == 5
    conn = store.open_existing(config.db_path)
    assert conn.execute("SELECT 1 FROM posts WHERE id = 'newpost'").fetchone() is not None
    other = conn.execute("SELECT COUNT(*) FROM conversations WHERE kind = 'other'").fetchone()
    assert other[0] == 0  # the deleted day's greeting thread is gone
    conn.close()


def test_index_requires_archive_and_channels(config: Config, tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        build_index(replace(config, archive_dir=tmp_path / "nope"), Overrides())
    with pytest.raises(ConfigError, match="eod_channel and team_channel"):
        build_index(Config(archive_dir=config.archive_dir, data_dir=tmp_path), Overrides())


def test_rank_prefers_resolver_with_evidence(config: Config, overrides: Overrides) -> None:
    build_index(config, overrides)
    result = _ranker(config).rank("DHCP relay timeout during PXE boot on rack controller")
    assert not result.low_confidence
    assert result.results[0].name == "Bob Brown"
    top = result.results[0]
    assert top.evidence[0].role == "resolver"
    assert 0 < top.score <= 1
    assert sum(m.score for m in result.results) <= 1.0 + 1e-9


def test_rank_excludes_former_by_default(config: Config, overrides: Overrides) -> None:
    build_index(config, overrides)
    ranker = _ranker(config)
    default = ranker.rank("dhcp snippets not applied after upgrade")
    assert "Carol Chen" not in [m.name for m in default.results]
    with_former = ranker.rank(
        "dhcp snippets not applied after upgrade", statuses={"current", "former"}
    )
    assert with_former.results[0].name == "Carol Chen"
    assert with_former.results[0].status == "former"


def test_rank_low_confidence(config: Config, overrides: Overrides) -> None:
    build_index(config, overrides)
    ranker = _ranker(config)
    assert ranker.rank("zzqq xxyy").low_confidence
    assert ranker.rank("the and of").reasons == ["the query has no searchable terms"]
    weak = ranker.rank("machine list table slow kernel firmware nvme raid bonding lacp")
    assert weak.low_confidence and "covers only" in weak.reasons[0]


def test_rank_adds_sub_team_picks_after_overall(
    config: Config, overrides: Overrides, monkeypatch: pytest.MonkeyPatch
) -> None:
    build_index(config, overrides)
    ranker = _ranker(config)
    monkeypatch.setattr("maas_delegate.rank.OVERALL_PICKS", 1)
    query = "pxe boot dhcp relay timeout on the rack controller, rackd logs; table render"
    result = ranker.rank(query)
    assert [(m.name, m.sub_team) for m in result.results] == [
        ("Bob Brown", None),
        ("Alice Anders", "maas-ui"),
    ]
    assert result.results[1].score == 1.0  # her share of the ui channel's evidence
    assert result.results[1].vs_usual == pytest.approx(1.0)  # ...and of its usual activity
    assert result.results[0].vs_usual > 1.0  # Bob is more involved in DHCP than usual
    plain = ranker.rank(query, sub_teams=False)
    assert [m.sub_team for m in plain.results] == [None, None]
    assert ranker.rank(query, team="terrachatters").results == plain.results
    assert ranker.rank(query, exclude_people=["Alice Anders"]).results[1:] == []


def test_evaluate_with_pseudo_and_explicit_labels(
    config: Config, overrides: Overrides, tmp_path: Path
) -> None:
    build_index(config, overrides)
    conn = store.open_existing(config.db_path)
    ranker = Ranker(conn)
    cases = pseudo_label_cases(conn, limit=10)
    assert {c.expected for c in cases} >= {"Bob Brown", "Carol Chen"}
    report = evaluate(ranker, cases)
    assert report.cases == len(cases)
    assert 0 <= report.tool.mrr <= 1
    labels = tmp_path / "labels.toml"
    labels.write_text(f'[labels]\n"{cases[0].conv_id}" = "{cases[0].expected}"\n"zz" = "X"\n')
    assert len(labelled_cases(conn, labels)) == 1
    conn.close()


# ---------------------------------------------------------------------- CLI
def _cli(config: Config, *args: str) -> int:
    conf = config.data_dir.parent / "maas-delegate.toml"
    if not conf.exists():
        conf.write_text(CHANNEL_SETTINGS_TOML)
    return main(
        [
            *("--config", str(conf)),
            *("--archive", str(config.archive_dir)),
            *("--data-dir", str(config.data_dir)),
            *args,
        ]
    )


def test_cli_end_to_end(
    config: Config, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(config.data_dir.parent)
    assert _cli(config, "index") == 0
    assert "Team: 2 current, 1 candidate, 1 former" in capsys.readouterr().out

    assert _cli(config, "ask", "--explain", "pxe", "dhcp", "timeout") == 0
    out = capsys.readouterr().out
    assert re.search(r"^1\.\s+Bob Brown", out, re.M) and "resolver" in out
    assert "\x1b[" not in out and "\nConfidence: high\n" in out

    assert _cli(config, "ask", "--explain", "--include-former", "dhcp snippets upgrade") == 0
    out = capsys.readouterr().out
    assert "Carol Chen [former]" in out and "resolver" in out

    assert _cli(config, "ask", "--exclude", "bob", "pxe dhcp timeout") == 0
    assert "Bob Brown" not in capsys.readouterr().out

    monkeypatch.setattr("sys.stdin", __import__("io").StringIO("UI table slow to render"))
    assert _cli(config, "ask", "-") == 0
    out = capsys.readouterr().out
    assert "Alice Anders" in out and "Channel" in out and "#maas-ui" not in out

    monkeypatch.setattr("maas_delegate.rank.OVERALL_PICKS", 1)
    query = "pxe boot dhcp relay timeout on the rack controller, rackd logs; table render"
    assert _cli(config, "ask", query) == 0
    out = capsys.readouterr().out
    assert re.search(r"^2\.\s+Alice Anders\s+\S+%\s+\S+\s+\d+\.\dx\s.*\s#maas-ui\s*$", out, re.M)
    assert "vs usual" not in out and "relative to that channel" not in out

    assert _cli(config, "ask", "--team", "terrachatters", query) == 0
    assert "#maas-ui" not in capsys.readouterr().out
    monkeypatch.setattr("maas_delegate.rank.OVERALL_PICKS", 3)

    assert _cli(config, "ask", "zzqq") == 0
    assert "Confidence: low (" in capsys.readouterr().out

    assert _cli(config, "team") == 0
    out = capsys.readouterr().out
    assert re.search(r"^candidate\s+Dave Diaz", out, re.M) and "Erin" not in out

    assert _cli(config, "team", "--all") == 0
    assert re.search(r"^former\s+Carol Chen", capsys.readouterr().out, re.M)

    assert _cli(config, "who", "Bob") == 0
    assert "distinctive terms:" in capsys.readouterr().out

    assert _cli(config, "eval") == 0
    out = capsys.readouterr().out
    assert "most-active baseline" in out and "without sub-team #4-5" in out and "Top-5" in out


def test_cli_overrides_and_permalinks(
    config: Config, capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    conf = tmp_path / "maas-delegate.toml"
    conf.write_text(
        f'archive_dir = "{config.archive_dir}"\ndata_dir = "{config.data_dir}"\n'
        'permalink_base = "https://chat.example/pl/"\n' + CHANNEL_SETTINGS_TOML
    )
    (tmp_path / "team-overrides.toml").write_text('include = ["Dave Diaz"]\n')
    assert main(["--config", str(conf), "index"]) == 0
    assert "Team: 3 current, 0 candidate, 1 former" in capsys.readouterr().out
    assert main(["--config", str(conf), "ask", "--explain", "openfga cache"]) == 0
    out = capsys.readouterr().out
    assert "https://chat.example/pl/" in out and "Alice Anders" in out


def test_cli_errors(config: Config, capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    assert _cli(config, "ask", "anything") == 2
    assert "run `maas-delegate index` first" in capsys.readouterr().err
    assert _cli(config, "index") == 0
    assert _cli(config, "who", "nobody-here") == 2
    assert "no person matches" in capsys.readouterr().err
    assert _cli(config, "who", "a") == 2
    assert "ambiguous" in capsys.readouterr().err
    assert _cli(config, "ask", "--team", "maas", "anything") == 2
    assert "not a sub-team channel (maas-ui, " in capsys.readouterr().err
    assert _cli(config, "ask", "--team", "#maas-ui", "table render") == 0
    bad = tmp_path / "bad.toml"
    bad.write_text("nope = 1\n")
    assert main(["--config", str(bad), "index"]) == 2
