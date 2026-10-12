"""Query-time retrieval (BM25) and member scoring (specs/research.md §6)."""

from __future__ import annotations

import json
import math
import sqlite3
from collections import defaultdict
from collections.abc import Collection
from dataclasses import dataclass, field, replace

from . import store
from .text import tokenize

DAY = 86400.0
K1 = 1.2
B = 0.75
TOP_K = 30
EVIDENCE_PER_MEMBER = 3
HALF_LIFE_DAYS = 180.0
MIN_COVERAGE = 0.35
OVERALL_PICKS = 3
SUB_TEAM_PICKS = 2


@dataclass(frozen=True)
class Evidence:
    conv_id: str
    channel: str
    root_ts: float
    role: str
    similarity: float
    snippet: str


@dataclass(frozen=True)
class MemberScore:
    name: str
    status: str
    score: float
    raw: float
    latest_ts: float
    evidence: tuple[Evidence, ...]
    # Share for this query divided by the member's usual (recency-weighted) share of activity.
    vs_usual: float = 0.0
    # Set for sub-team picks to the sub-team's channel; `score` and `vs_usual` are then relative
    # to that channel.
    sub_team: str | None = None


@dataclass
class RankResult:
    matched: int
    coverage: float
    results: list[MemberScore]
    low_confidence: bool = False
    reasons: list[str] = field(default_factory=list[str])


@dataclass(frozen=True)
class _ConvMeta:
    channel: str
    root_ts: float
    snippet: str


class Ranker:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self.reference_ts = float(store.get_meta(conn, "reference_ts") or 0.0)
        self._name_stopwords = frozenset((store.get_meta(conn, "name_stopwords") or "").split())
        self.sub_team_channels = tuple((store.get_meta(conn, "sub_team_channels") or "").split())
        self._bug_ids = tuple[str, ...](json.loads(store.get_meta(conn, "bug_id_patterns") or "[]"))
        self._lengths = {r["conv_id"]: r["length"] for r in conn.execute("SELECT * FROM docs")}
        self._n_docs = len(self._lengths)
        self._avgdl = (sum(self._lengths.values()) / self._n_docs) if self._n_docs else 0.0
        self._meta = {
            r["id"]: _ConvMeta(r["channel"], r["root_ts"], r["snippet"])
            for r in conn.execute("SELECT id, channel, root_ts, snippet FROM conversations")
        }
        self._attrs: dict[str, list[tuple[str, str, float]]] = defaultdict(list)
        for r in conn.execute("SELECT conv_id, person, role, weight FROM attributions"):
            self._attrs[r["conv_id"]].append((r["person"], r["role"], r["weight"]))
        self.status = {
            r["name"]: r["status"] for r in conn.execute("SELECT name, status FROM people")
        }

    # ---------------------------------------------------------------- retrieval
    def search(
        self, terms: list[str], *, before_ts: float | None = None
    ) -> list[tuple[str, float, float]]:
        """Return (conv_id, bm25, coverage) sorted by score, best first."""
        unique = list(dict.fromkeys(terms))
        if not unique or not self._n_docs:
            return []
        scores: dict[str, float] = defaultdict(float)
        matched_idf: dict[str, float] = defaultdict(float)
        total_idf = 0.0
        for term in unique:
            rows = self._conn.execute(
                "SELECT conv_id, tf FROM doc_terms WHERE term = ?", (term,)
            ).fetchall()
            df = len(rows)
            idf = math.log(1 + (self._n_docs - df + 0.5) / (df + 0.5))
            total_idf += idf
            for row in rows:
                conv_id = row["conv_id"]
                if not self._before(conv_id, before_ts):
                    continue
                tf = row["tf"]
                norm = K1 * (1 - B + B * self._lengths[conv_id] / self._avgdl)
                scores[conv_id] += idf * tf * (K1 + 1) / (tf + norm)
                matched_idf[conv_id] += idf
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        return [(cid, s, matched_idf[cid] / total_idf if total_idf else 0.0) for cid, s in ranked]

    def _before(self, conv_id: str, before_ts: float | None) -> bool:
        meta = self._meta.get(conv_id)
        return meta is not None and (before_ts is None or meta.root_ts < before_ts)

    # ------------------------------------------------------------------ ranking
    def attribution_totals(self, before_ts: float | None = None) -> dict[str, float]:
        totals: dict[str, float] = defaultdict(float)
        for conv_id, attrs in self._attrs.items():
            if not self._before(conv_id, before_ts):
                continue
            for person, _, weight in attrs:
                totals[person] += weight
        return totals

    def rank(
        self,
        text: str,
        *,
        limit: int = 5,
        statuses: Collection[str] = ("current",),
        before_ts: float | None = None,
        exclude_people: Collection[str] = (),
        team: str | None = None,
        sub_teams: bool = True,
    ) -> RankResult:
        """Rank members for `text`.

        The first OVERALL_PICKS entries are the overall ranking. With `sub_teams`, the next
        SUB_TEAM_PICKS are the strongest members of the sub-team channel rankings (only channel
        `team`, if given) who are not already listed; the overall ranking continues after them.
        With `before_ts`, only conversations that started strictly earlier are used.
        """
        terms = tokenize(text, self._name_stopwords, self._bug_ids)
        all_hits = self.search(terms, before_ts=before_ts)
        hits = all_hits[:TOP_K]
        result = RankResult(matched=len(hits), coverage=hits[0][2] if hits else 0.0, results=[])
        if not terms:
            result.low_confidence = True
            result.reasons.append("the query has no searchable terms")
            return result
        if not hits:
            result.low_confidence = True
            result.reasons.append("no past conversation matches the query")
            return result
        if result.coverage < MIN_COVERAGE:
            result.low_confidence = True
            result.reasons.append(
                f"the best match covers only {result.coverage:.0%} of the query's weighted terms"
            )

        now = before_ts if before_ts is not None else self.reference_ts
        top_score = hits[0][1]
        raw, evidence = self._accumulate(hits, top_score, now)
        usual = self._usual(before_ts, now)
        everywhere: dict[str, float] = defaultdict(float)
        for per_channel in usual.values():
            for person, value in per_channel.items():
                everywhere[person] += value

        allowed = set(statuses)
        members = self._members(
            raw, evidence, everywhere, allowed, exclude_people, limit + SUB_TEAM_PICKS
        )
        result.results = members[:limit]
        if not members:
            result.low_confidence = True
            result.reasons.append("no team member with the requested status took part in matches")
            return result

        if sub_teams:
            head = members[:OVERALL_PICKS]
            listed = {m.name for m in head}
            candidates: dict[str, MemberScore] = {}
            for channel in self.sub_team_channels:
                if team is not None and channel != team:
                    continue
                channel_hits = [h for h in all_hits if self._meta[h[0]].channel == channel]
                sub_raw, sub_evidence = self._accumulate(channel_hits[:TOP_K], top_score, now)
                ranked = self._members(
                    sub_raw, sub_evidence, usual.get(channel, {}), allowed, exclude_people, None
                )
                for m in ranked:
                    best = candidates.get(m.name)
                    if m.name not in listed and (best is None or m.raw > best.raw):
                        candidates[m.name] = replace(m, sub_team=channel)
            # Raw evidence is on the same scale in every channel (similarity is relative to the
            # overall best match), so it, not the per-channel share, decides between sub-teams.
            picks = sorted(candidates.values(), key=lambda m: m.raw, reverse=True)
            picks = picks[:SUB_TEAM_PICKS]
            listed |= {m.name for m in picks}
            rest = [m for m in members[OVERALL_PICKS:] if m.name not in listed]
            result.results = (head + picks + rest)[:limit]
        return result

    def _accumulate(
        self, hits: list[tuple[str, float, float]], top_score: float, now: float
    ) -> tuple[dict[str, float], dict[str, list[tuple[float, Evidence]]]]:
        raw: dict[str, float] = defaultdict(float)
        evidence: dict[str, list[tuple[float, Evidence]]] = defaultdict(list)
        for conv_id, score, _ in hits:
            meta = self._meta[conv_id]
            sim = score / top_score
            age_days = max(0.0, (now - meta.root_ts) / DAY)
            decay = 0.5 ** (age_days / HALF_LIFE_DAYS)
            for person, role, weight in self._attrs.get(conv_id, []):
                contribution = sim * weight * decay
                raw[person] += contribution
                evidence[person].append(
                    (
                        contribution,
                        Evidence(conv_id, meta.channel, meta.root_ts, role, sim, meta.snippet),
                    )
                )
        return raw, evidence

    def _usual(self, before_ts: float | None, now: float) -> dict[str, dict[str, float]]:
        """Recency-weighted attribution per channel and person over all earlier conversations.

        This is what an "empty" query would match: every conversation equally similar.
        """
        usual: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for conv_id in self._lengths:
            if not self._before(conv_id, before_ts):
                continue
            meta = self._meta[conv_id]
            decay = 0.5 ** (max(0.0, (now - meta.root_ts) / DAY) / HALF_LIFE_DAYS)
            for person, _, weight in self._attrs.get(conv_id, []):
                usual[meta.channel][person] += weight * decay
        return usual

    def _members(
        self,
        raw: dict[str, float],
        evidence: dict[str, list[tuple[float, Evidence]]],
        usual: dict[str, float],
        allowed: set[str],
        excluded: Collection[str],
        limit: int | None,
    ) -> list[MemberScore]:
        def eligible(person: str) -> bool:
            return self.status.get(person) in allowed and person not in excluded

        scores = {p: v for p, v in raw.items() if v > 0 and eligible(p)}
        norm = sum(scores.values())
        usual_norm = sum(v for p, v in usual.items() if eligible(p))
        members: list[MemberScore] = []
        for person, value in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:limit]:
            items = sorted(evidence[person], key=lambda e: e[0], reverse=True)
            usual_share = usual.get(person, 0.0) / usual_norm if usual_norm else 0.0
            members.append(
                MemberScore(
                    name=person,
                    status=self.status.get(person, "external"),
                    score=value / norm,
                    raw=raw[person],
                    latest_ts=max(e.root_ts for _, e in items),
                    evidence=tuple(e for _, e in items[:EVIDENCE_PER_MEMBER]),
                    vs_usual=value / norm / usual_share if usual_share else 0.0,
                )
            )
        return members
