"""Shared fixtures: a small synthetic archive in the mattermost-archive Markdown format."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path

import pytest

from maas_delegate.config import Config, Overrides, Patterns
from maas_delegate.parse import Post, parse_timestamp


def line(ts: str, post_id: str, sender: str, text: str, root: str | None = None) -> str:
    marker = f" *(reply to {root})*" if root else ""
    return f"**[{ts}] [{post_id}] {sender}**{marker}: {text}"


class ArchiveBuilder:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._days: dict[tuple[str, str], list[str]] = {}
        self._counter = 0

    def add(
        self,
        channel: str,
        ts: str,
        sender: str,
        text: str,
        root: str | None = None,
        post_id: str | None = None,
    ) -> str:
        self._counter += 1
        pid = post_id or f"p{self._counter:025d}"
        self._days.setdefault((channel, ts[:10]), []).append(line(ts, pid, sender, text, root))
        return pid

    def write(self) -> Path:
        for (channel, day), lines in self._days.items():
            path = self.root / channel / day[:4] / day[5:7] / f"{day}.md"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"# {channel} - {day}\n\n" + "\n\n".join(lines) + "\n")
        return self.root


def make_post(
    sender: str,
    text: str,
    ts: str = "2026-10-01T10:00:00Z",
    channel: str = "maas",
    root: str | None = None,
    post_id: str = "x",
) -> Post:
    return Post(post_id, channel, parse_timestamp(ts), sender, root, text)


def build_sample_archive(root: Path) -> Path:
    """Team: Alice, Bob (current), Carol (former), Dave (candidate). Erin is an external asker."""
    a = ArchiveBuilder(root)
    start = date(2026, 10, 1)
    for i in range(8):
        day = (start + timedelta(days=i)).isoformat()
        a.add("maas", f"{day}T16:00:00Z", "Alice Anders", "*EOD :wave:*")
        a.add("maas", f"{day}T16:30:00Z", "Bob Brown", "EOD")
    for i in range(5):
        day = (date(2026, 6, 1) + timedelta(days=i)).isoformat()
        a.add("maas", f"{day}T16:00:00Z", "Carol Chen", "Last EOD, EOW :wave:")
    a.add("maas", "2026-10-02T08:00:00Z", "Bob Brown", "Morning")

    a.add("maas-private", "2026-06-02T09:00:00Z", "Carol Chen", "back in 30m")
    a.add("maas-private", "2026-09-01T09:00:00Z", "System", "dave added to the channel by alice.")
    a.add("maas-private", "2026-10-05T09:00:00Z", "Dave Diaz", "Roadmap sync moved to Thursday")
    a.add("maas-private", "2026-10-06T09:00:00Z", "Alice Anders", "lunch")

    r1 = a.add(
        "maas",
        "2026-09-10T09:00:00Z",
        "Erin External",
        "PXE boot fails with a DHCP timeout on the rack controller, any idea?",
    )
    a.add(
        "maas",
        "2026-09-10T09:10:00Z",
        "Bob Brown",
        "Check rackd logs in /var/snap/maas/common/log/rackd.log, the dhcp relay is misconfigured",
        root=r1,
    )
    a.add("maas", "2026-09-10T09:20:00Z", "Erin External", "thanks, that worked!", root=r1)
    a.add("maas", "2026-09-10T09:25:00Z", "Alice Anders", "nice", root=r1)

    for n, day in enumerate(("2026-06-10", "2026-06-12")):
        r = a.add(
            "maas",
            f"{day}T09:00:00Z",
            "Erin External",
            f"DHCP snippets are not applied after the upgrade to 3.6 (case {n})",
        )
        a.add(
            "maas",
            f"{day}T09:30:00Z",
            "Carol Chen",
            "Snippets moved to the new config renderer in 3.6, you need to re-save each snippet",
            root=r,
        )

    r3 = a.add(
        "maas-ui",
        "2026-09-20T09:00:00Z",
        "Erin External",
        "The UI machine list table is slow to render with 2000 machines, is that known?",
    )
    a.add(
        "maas-ui",
        "2026-09-20T09:30:00Z",
        "Alice Anders",
        "Yes, the table re-renders on every websocket update; a fix for the list is in review",
        root=r3,
    )

    r4 = a.add(
        "maas-private",
        "2026-09-25T09:00:00Z",
        "Alice Anders",
        "I refactored the openfga permission checks in maasserver to use the request cache",
    )
    a.add(
        "maas-private",
        "2026-09-25T09:30:00Z",
        "Bob Brown",
        "Looks good, but the openfga cache invalidation needs a test. Maybe Dave can help",
        root=r4,
    )

    r5 = a.add("maas", "2026-10-03T08:00:00Z", "Bob Brown", "Morning all")
    a.add("maas", "2026-10-03T08:01:00Z", "Alice Anders", "Hi!", root=r5)
    return a.write()


@pytest.fixture
def archive(tmp_path: Path) -> Path:
    return build_sample_archive(tmp_path / "mm-archive")


# Channel settings for the synthetic archives (normally in the gitignored maas-delegate.toml).
TEST_PATTERNS = Patterns(
    chatter=(r"\bc&d\b",),
    bug=("jenkins_fire",),
    review=(r"\+merge/",),
    bug_id=(r"\blp[:#]\s?#?(\d+)",),
    command_words=("snap",),
)
CHANNEL_SETTINGS = Config(
    eod_channel="maas",
    team_channel="maas-private",
    sub_team_channels=("maas-ui", "maas-americas", "maas-emea-bc", "terrachatters"),
    bots=frozenset({"System", "maasbot", "Matterpoll"}),
    patterns=TEST_PATTERNS,
)
CHANNEL_SETTINGS_TOML = (
    'eod_channel = "maas"\nteam_channel = "maas-private"\n'
    'sub_team_channels = ["maas-ui", "maas-americas", "maas-emea-bc", "terrachatters"]\n'
    'bots = ["maasbot", "Matterpoll"]\n'
)


def with_channels(archive_dir: Path, data_dir: Path, overrides_file: Path) -> Config:
    return replace(
        CHANNEL_SETTINGS, archive_dir=archive_dir, data_dir=data_dir, overrides_file=overrides_file
    )


@pytest.fixture
def config(tmp_path: Path, archive: Path) -> Config:
    return with_channels(archive, tmp_path / "data", tmp_path / "team-overrides.toml")


@pytest.fixture
def overrides() -> Overrides:
    return Overrides()
