"""Offline evaluation: Top-1 / Top-3 / Top-5 / MRR with a time-based split (spec US5)."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

from .classify import EXPERTISE_KINDS
from .config import ConfigError, read_toml
from .rank import Ranker
from .team import TEAM_STATUSES


@dataclass(frozen=True)
class EvalCase:
    conv_id: str
    query: str
    root_ts: float
    root_author: str | None
    expected: str


@dataclass(frozen=True)
class Metrics:
    top1: float
    top3: float
    top5: float
    mrr: float


@dataclass(frozen=True)
class EvalReport:
    cases: int
    tool: Metrics
    overall_only: Metrics
    baseline: Metrics


def pseudo_label_cases(conn: sqlite3.Connection, limit: int) -> list[EvalCase]:
    """Most recent conversations whose resolver was derived automatically (specs/research.md §5)."""
    kinds = ",".join(f"'{k}'" for k in sorted(EXPERTISE_KINDS))
    rows = conn.execute(
        f"""
        SELECT c.id, c.root_ts, c.root_author, p.text, a.person
        FROM conversations c
        JOIN attributions a ON a.conv_id = c.id AND a.role = 'resolver'
        JOIN posts p ON p.id = c.id
        WHERE c.kind IN ({kinds})
        ORDER BY c.root_ts DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [EvalCase(r["id"], r["text"], r["root_ts"], r["root_author"], r["person"]) for r in rows]


def labelled_cases(conn: sqlite3.Connection, labels_path: Path) -> list[EvalCase]:
    labels = read_toml(labels_path).get("labels", {})
    if not isinstance(labels, dict):
        raise ConfigError(f"{labels_path}: [labels] must be a table of post_id = name")
    cases: list[EvalCase] = []
    for conv_id, expected in labels.items():
        row = conn.execute(
            "SELECT c.root_ts, c.root_author, p.text FROM conversations c "
            "JOIN posts p ON p.id = c.id WHERE c.id = ?",
            (conv_id,),
        ).fetchone()
        if row is not None and isinstance(expected, str):
            cases.append(
                EvalCase(conv_id, row["text"], row["root_ts"], row["root_author"], expected)
            )
    return cases


def evaluate(ranker: Ranker, cases: Sequence[EvalCase]) -> EvalReport:
    tool_ranks: list[int | None] = []
    overall_ranks: list[int | None] = []
    base_ranks: list[int | None] = []
    for case in cases:
        for sub_teams, ranks in ((True, tool_ranks), (False, overall_ranks)):
            result = ranker.rank(
                case.query,
                limit=1000,
                statuses=TEAM_STATUSES,
                before_ts=case.root_ts,
                exclude_people=[case.root_author] if case.root_author else [],
                sub_teams=sub_teams,
            )
            order = [m.name for m in result.results]
            ranks.append(_position(order, case.expected))
        totals = ranker.attribution_totals(case.root_ts)
        base_order = [
            p
            for p, _ in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
            if ranker.status.get(p) in TEAM_STATUSES and p != case.root_author
        ]
        base_ranks.append(_position(base_order, case.expected))
    return EvalReport(
        len(cases), _metrics(tool_ranks), _metrics(overall_ranks), _metrics(base_ranks)
    )


def _position(order: list[str], expected: str) -> int | None:
    return order.index(expected) + 1 if expected in order else None


def _metrics(ranks: list[int | None]) -> Metrics:
    if not ranks:
        return Metrics(0.0, 0.0, 0.0, 0.0)
    n = len(ranks)

    def frac(pred: Callable[[int], bool]) -> float:
        return sum(1 for r in ranks if r is not None and pred(r)) / n

    mrr = sum(1.0 / r for r in ranks if r is not None) / n
    return Metrics(
        top1=frac(lambda r: r == 1),
        top3=frac(lambda r: r <= 3),
        top5=frac(lambda r: r <= 5),
        mrr=mrr,
    )
