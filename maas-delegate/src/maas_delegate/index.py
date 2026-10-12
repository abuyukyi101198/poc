"""Index builder: parses the whole archive and rebuilds the SQLite index from scratch."""

from __future__ import annotations

import json
import re
import sqlite3
import time
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, replace

from . import store
from .attribute import attribute
from .classify import EXPERTISE_KINDS, classify
from .config import Config, Overrides
from .parse import Post, iter_day_files, parse_file
from .team import TEAM_STATUSES, compute_team
from .text import tokenize
from .threads import Conversation, build_conversations

ROOT_WEIGHT = 2
SNIPPET_CHARS = 160


@dataclass(frozen=True)
class IndexStats:
    files: int
    posts: int
    conversations: int
    indexed: int
    team_counts: dict[str, int]
    seconds: float


def build_index(config: Config, overrides: Overrides) -> IndexStats:
    config.require_channels()
    if not config.archive_dir.is_dir():
        raise FileNotFoundError(f"archive directory not found: {config.archive_dir}")
    started = time.monotonic()
    files = [
        (path, ch) for ch in config.channels for path in iter_day_files(config.archive_dir, ch)
    ]
    aliases = overrides.alias_map()
    by_id = {
        p.id: replace(p, sender=aliases.get(p.sender, p.sender))
        for path, channel in files
        for p in parse_file(path, channel)
    }
    posts = sorted(by_id.values(), key=lambda p: p.ts)

    # Build next to the live index and swap it in, so a failed run leaves the old one intact.
    tmp = config.db_path.with_name(config.db_path.name + ".tmp")
    conn = store.create(tmp)
    try:
        with conn:
            conn.executemany(
                "INSERT INTO posts(id, channel, ts, sender, root_id, text) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [(p.id, p.channel, p.ts, p.sender, p.root_id, p.text) for p in posts],
            )
            n_convs, n_indexed, team_counts = _derive(conn, posts, overrides, config)
    finally:
        conn.close()
    tmp.replace(config.db_path)
    return IndexStats(
        files=len(files),
        posts=len(posts),
        conversations=n_convs,
        indexed=n_indexed,
        team_counts=team_counts,
        seconds=time.monotonic() - started,
    )


def _derive(
    conn: sqlite3.Connection, posts: Sequence[Post], overrides: Overrides, config: Config
) -> tuple[int, int, dict[str, int]]:
    reference_ts = max((p.ts for p in posts), default=0.0)
    people = compute_team(posts, overrides, reference_ts, config)
    conn.executemany(
        "INSERT INTO people(name, status, override, eod_recent, eod_last, priv_total, "
        "last_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (p.name, p.status, p.override, p.eod_recent, p.eod_last, p.priv_total, p.last_active)
            for p in people
        ],
    )

    bots = config.bots
    team = {p.name for p in people if p.status in TEAM_STATUSES}
    name_stopwords = _name_tokens({p.sender for p in posts if p.sender not in bots})
    indexed = 0
    kept = 0
    for conv in build_conversations(posts, standalone_authors=team):
        kind = classify(conv, config)
        if conv.standalone and kind not in EXPERTISE_KINDS:
            continue
        kept += 1
        conn.execute(
            "INSERT INTO conversations(id, channel, root_author, root_ts, kind, snippet) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                conv.id,
                conv.channel,
                conv.root_author,
                conv.root_ts,
                kind,
                _snippet(conv.root_text),
            ),
        )
        if kind not in EXPERTISE_KINDS:
            continue
        conn.executemany(
            "INSERT INTO attributions(conv_id, person, role, weight) VALUES (?, ?, ?, ?)",
            [(conv.id, a.person, a.role, a.weight) for a in attribute(conv, team, config.patterns)],
        )
        terms = document_terms(conv, bots, name_stopwords, config.patterns.bug_id)
        if terms:
            indexed += 1
            conn.execute(
                "INSERT INTO docs(conv_id, length) VALUES (?, ?)", (conv.id, sum(terms.values()))
            )
            conn.executemany(
                "INSERT INTO doc_terms(conv_id, term, tf) VALUES (?, ?, ?)",
                [(conv.id, term, tf) for term, tf in terms.items()],
            )

    store.set_meta(conn, "reference_ts", str(reference_ts))
    store.set_meta(conn, "indexed_at", str(time.time()))
    store.set_meta(conn, "name_stopwords", "\n".join(sorted(name_stopwords)))
    store.set_meta(conn, "sub_team_channels", "\n".join(config.sub_team_channels))
    # Queries must be tokenised like the documents.
    store.set_meta(conn, "bug_id_patterns", json.dumps(config.patterns.bug_id))
    return kept, indexed, dict(Counter(p.status for p in people))


def document_terms(
    conv: Conversation,
    bots: frozenset[str],
    name_stopwords: frozenset[str] | set[str],
    bug_ids: tuple[str, ...] = (),
) -> Counter[str]:
    terms: Counter[str] = Counter()
    for post in conv.posts:
        if post.sender in bots:
            continue
        tokens = tokenize(post.text, name_stopwords, bug_ids)
        weight = ROOT_WEIGHT if conv.root is not None and post is conv.root else 1
        for tok in tokens:
            terms[tok] += weight
    return terms


def _name_tokens(names: set[str]) -> set[str]:
    tokens: set[str] = set()
    for name in names:
        for part in re.split(r"[\s\-_.]+", name.lower()):
            if len(part) >= 3:
                tokens.add(part)
    return tokens


def _snippet(text: str) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= SNIPPET_CHARS else flat[: SNIPPET_CHARS - 1] + "…"
