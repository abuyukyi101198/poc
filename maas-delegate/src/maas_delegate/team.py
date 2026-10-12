"""Team detection: EOD senders in the EOD channel x activity in the team-only channel."""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from .config import Config, Overrides
from .parse import Post

DAY = 86400.0
INACTIVE_DAYS = 30
EOD_LOOKBACK_DAYS = 180
MIN_EOD_COUNT = 3

EOD_STRICT_RE = re.compile(r"^[\s*_#>\-]*(?:early\s+)?(?:eod|eow)\b", re.I)
EOD_LOOSE_RE = re.compile(r"\b(?:early|last)\s+eod\b|\beod\b.*:wave", re.I)

STATUSES = ("current", "candidate", "former", "external")
TEAM_STATUSES = frozenset({"current", "candidate", "former"})


@dataclass(frozen=True)
class PersonStatus:
    name: str
    status: str
    override: str | None
    eod_recent: int
    eod_last: float | None
    priv_total: int
    last_active: float | None


def is_eod(text: str) -> bool:
    return bool(EOD_STRICT_RE.match(text) or EOD_LOOSE_RE.search(text))


def compute_team(
    posts: Iterable[Post], overrides: Overrides, reference_ts: float, config: Config
) -> list[PersonStatus]:
    """Derive each person's team status from activity within time windows (specs/research.md §3.4).

    Posts must already use canonical sender names.
    """
    eod_ts: dict[str, list[float]] = {}
    priv_ts: dict[str, list[float]] = {}
    for post in posts:
        if post.sender in config.bots:
            continue
        if post.channel == config.eod_channel and post.root_id is None and is_eod(post.text):
            eod_ts.setdefault(post.sender, []).append(post.ts)
        if post.channel == config.team_channel:
            priv_ts.setdefault(post.sender, []).append(post.ts)

    lookback_start = reference_ts - EOD_LOOKBACK_DAYS * DAY
    inactive_after = reference_ts - INACTIVE_DAYS * DAY
    names = set(eod_ts) | set(priv_ts) | overrides.include | overrides.former | overrides.exclude

    people: list[PersonStatus] = []
    for name in sorted(names):
        eods = sorted(eod_ts.get(name, []))
        privs = sorted(priv_ts.get(name, []))
        eod_recent = sum(1 for t in eods if t >= lookback_start)
        last_active = max([*eods[-1:], *privs[-1:]], default=None)
        active = last_active is not None and last_active >= inactive_after
        ever_team = len(eods) >= MIN_EOD_COUNT or bool(privs)

        if eod_recent >= MIN_EOD_COUNT and active:
            status = "current"
        elif ever_team and active:
            status = "candidate"
        elif ever_team:
            status = "former"
        else:
            status = "external"

        override = overrides.status_for(name)
        people.append(
            PersonStatus(
                name=name,
                status=override or status,
                override=override,
                eod_recent=eod_recent,
                eod_last=eods[-1] if eods else None,
                priv_total=len(privs),
                last_active=last_active,
            )
        )
    return people
