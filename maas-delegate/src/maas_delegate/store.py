"""SQLite storage for the index. Each `index` run builds a fresh database."""

from __future__ import annotations

import sqlite3
from pathlib import Path

_SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE posts (
    id TEXT PRIMARY KEY, channel TEXT NOT NULL, ts REAL NOT NULL, sender TEXT NOT NULL,
    root_id TEXT, text TEXT NOT NULL
);
CREATE TABLE people (
    name TEXT PRIMARY KEY, status TEXT NOT NULL, override TEXT, eod_recent INTEGER NOT NULL,
    eod_last REAL, priv_total INTEGER NOT NULL, last_active REAL
);
CREATE TABLE conversations (
    id TEXT PRIMARY KEY, channel TEXT NOT NULL, root_author TEXT, root_ts REAL NOT NULL,
    kind TEXT NOT NULL, snippet TEXT NOT NULL
);
CREATE TABLE attributions (
    conv_id TEXT NOT NULL, person TEXT NOT NULL, role TEXT NOT NULL, weight REAL NOT NULL,
    PRIMARY KEY (conv_id, person)
);
CREATE INDEX attributions_person ON attributions(person);
CREATE TABLE docs (conv_id TEXT PRIMARY KEY, length INTEGER NOT NULL);
CREATE TABLE doc_terms (
    conv_id TEXT NOT NULL, term TEXT NOT NULL, tf INTEGER NOT NULL, PRIMARY KEY (term, conv_id)
) WITHOUT ROWID;
"""


def create(db_path: Path) -> sqlite3.Connection:
    """Create an empty index at `db_path`, replacing any existing file."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


def open_existing(db_path: Path) -> sqlite3.Connection:
    """Open an index for reading; raises FileNotFoundError if `index` was never run."""
    if not db_path.exists():
        raise FileNotFoundError(f"no index at {db_path}; run `maas-delegate index` first")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return None if row is None else str(row["value"])


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO meta(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
