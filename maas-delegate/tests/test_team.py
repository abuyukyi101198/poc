from __future__ import annotations

import pytest

from maas_delegate.config import Overrides
from maas_delegate.parse import parse_timestamp
from maas_delegate.team import compute_team, is_eod

from .conftest import CHANNEL_SETTINGS, make_post


@pytest.mark.parametrize(
    "text",
    [
        "EOD",
        "eod",
        "*EOD :wave:*",
        "EOD, EOW :wave:",
        "*early EOD for appointments, see you tomorrow*",
        "*-> EOD*",
        "Last EOD, EOW at the company :wave:",
        "(Also forgot to say EOD :wave: )",
    ],
)
def test_eod_variants(text: str) -> None:
    assert is_eod(text)


@pytest.mark.parametrize(
    "text", ["the fix should land by EOD tomorrow", "Morning", "periodic task"]
)
def test_not_eod(text: str) -> None:
    assert not is_eod(text)


def _eods(name: str, days: list[str]) -> list[object]:
    return [make_post(name, "EOD", ts=f"{d}T16:00:00Z") for d in days]


REF = parse_timestamp("2026-10-08T17:00:00Z")
RECENT = ["2026-10-06", "2026-10-07", "2026-10-08"]


def _statuses(posts: list[object], overrides: Overrides | None = None) -> dict[str, str]:
    people = compute_team(posts, overrides or Overrides(), REF, CHANNEL_SETTINGS)  # type: ignore[arg-type]
    return {p.name: p.status for p in people}


def test_status_rules() -> None:
    posts = [
        *_eods("Current Person", RECENT),
        *_eods("Former Person", ["2026-06-01", "2026-06-02", "2026-06-03"]),
        *_eods("Few Eods", ["2026-10-07"]),
        make_post("Candidate Person", "hi", ts="2026-10-07T10:00:00Z", channel="maas-private"),
        make_post("Old Private", "hi", ts="2025-03-01T10:00:00Z", channel="maas-private"),
        make_post("maasbot", "EOD", ts="2026-10-07T10:00:00Z"),
        make_post("Replier", "EOD", ts="2026-10-07T10:00:00Z", root="r"),
    ]
    statuses = _statuses(posts)
    assert statuses == {
        "Current Person": "current",
        "Former Person": "former",
        "Few Eods": "external",
        "Candidate Person": "candidate",
        "Old Private": "former",
    }


def test_farewell_wording_is_ignored() -> None:
    posts = [make_post("Leaver", "Last EOD at the company", ts=f"{d}T16:00:00Z") for d in RECENT]
    assert _statuses(posts)["Leaver"] == "current"  # type: ignore[arg-type]


def test_overrides() -> None:
    overrides = Overrides(
        include=frozenset({"Manager"}),
        exclude=frozenset({"Current Person"}),
        aliases={"Current Person": ("Old Name", "Older Name")},
    )
    statuses = _statuses(_eods("Current Person", RECENT), overrides)
    assert statuses == {"Current Person": "external", "Manager": "current"}
    assert overrides.alias_map() == {"Old Name": "Current Person", "Older Name": "Current Person"}
