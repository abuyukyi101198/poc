"""Parser for the Markdown archive written by mattermost-archive (spec 001).

Format contract (one post per line, continuation lines belong to the previous post):

    # <channel> - YYYY-MM-DD
    **[2026-03-23T06:51:25Z] [<post_id>] Display Name** *(reply to <root_id>)*: text
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

POST_RE = re.compile(
    r"^\*\*\[(?P<ts>\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)\]"
    r"(?: \[(?P<id>[A-Za-z0-9]+)\])?"
    r" (?P<sender>.*?)\*\*"
    r"(?: \*\(reply to (?P<root>[A-Za-z0-9]+)\)\*)?"
    r": ?(?P<text>.*)$"
)
DAY_FILE_RE = re.compile(r"^\d{4}-\d\d-\d\d\.md$")


@dataclass(frozen=True)
class Post:
    id: str
    channel: str
    ts: float  # UTC epoch seconds
    sender: str
    root_id: str | None
    text: str


def parse_timestamp(value: str) -> float:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def parse_text(content: str, channel: str) -> list[Post]:
    posts: list[Post] = []
    current: dict[str, str | None] | None = None
    lines: list[str] = []

    def flush() -> None:
        if current is None:
            return
        text = "\n".join(lines).strip()
        ts_raw = current["ts"] or ""
        sender = current["sender"] or ""
        post_id = current["id"] or _synthetic_id(channel, ts_raw, sender, text)
        posts.append(
            Post(
                id=post_id,
                channel=channel,
                ts=parse_timestamp(ts_raw),
                sender=sender,
                root_id=current["root"],
                text=text,
            )
        )

    for line in content.splitlines():
        match = POST_RE.match(line)
        if match:
            flush()
            current = match.groupdict()
            lines = [match.group("text")]
        elif current is None:
            continue  # header or preamble
        else:
            lines.append(line)
    flush()
    return posts


def parse_file(path: Path, channel: str) -> list[Post]:
    return parse_text(path.read_text(encoding="utf-8", errors="replace"), channel)


def iter_day_files(archive_dir: Path, channel: str) -> Iterator[Path]:
    root = archive_dir / channel
    if not root.is_dir():
        return
    for path in sorted(root.rglob("*.md")):
        if DAY_FILE_RE.match(path.name):
            yield path


def _synthetic_id(channel: str, ts: str, sender: str, text: str) -> str:
    digest = hashlib.sha1(f"{channel}|{ts}|{sender}|{text[:200]}".encode()).hexdigest()
    return f"x{digest[:25]}"
