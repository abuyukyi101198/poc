"""Command-line interface: index | ask | team | who | eval."""

from __future__ import annotations

import argparse
import math
import sqlite3
import sys
from collections.abc import Sequence
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

from rich import box
from rich.console import Console
from rich.table import Table
from rich.text import Text

from . import store
from .config import Config, ConfigError, load_config, load_overrides
from .evaluate import evaluate, labelled_cases, pseudo_label_cases
from .index import build_index
from .rank import MemberScore, Ranker, RankResult
from .team import EOD_LOOKBACK_DAYS, STATUSES

EXIT_OK = 0
EXIT_USAGE = 2
PIPED_WIDTH = 160
BAR_WIDTH = 10
STATUS_STYLE = {"current": "green", "candidate": "yellow", "former": "dim", "external": "dim"}


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        config = replace(
            load_config(args.config),
            **{
                key: value.resolve()
                for key, value in (("archive_dir", args.archive), ("data_dir", args.data_dir))
                if value
            },
        )
        return int(args.handler(args, config))
    except (ConfigError, FileNotFoundError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return EXIT_USAGE


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="maas-delegate",
        description="Find the MAAS team member most likely to know about an issue.",
    )
    parser.add_argument("--config", type=Path, help="config file (default: ./maas-delegate.toml)")
    parser.add_argument("--archive", type=Path, help="archive directory (overrides config)")
    parser.add_argument("--data-dir", type=Path, help="index directory (overrides config)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_index = sub.add_parser("index", help="build or refresh the index from the archive")
    p_index.set_defaults(handler=cmd_index)

    p_ask = sub.add_parser("ask", help="rank team members for an issue description")
    p_ask.add_argument("text", nargs="+", help="issue text, or '-' to read from stdin")
    p_ask.add_argument("-n", "--limit", type=int, default=5, help="number of members to show")
    p_ask.add_argument("--explain", action="store_true", help="show supporting conversations")
    p_ask.add_argument("--include-former", action="store_true", help="also rank former members")
    p_ask.add_argument(
        "--include-candidates", action="store_true", help="also rank unconfirmed candidates"
    )
    p_ask.add_argument("--exclude", action="append", default=[], help="exclude a member (e.g. you)")
    p_ask.add_argument(
        "--team",
        metavar="CHANNEL",
        help="take the sub-team picks (#4-5) from this sub-team channel only",
    )
    p_ask.set_defaults(handler=cmd_ask)

    p_team = sub.add_parser("team", help="list detected team members with their status")
    p_team.add_argument("--all", action="store_true", help="include 'external' people")
    p_team.set_defaults(handler=cmd_team)

    p_eval = sub.add_parser("eval", help="measure ranking quality (time-split)")
    p_eval.add_argument("--labels", type=Path, help="TOML file with [labels] post_id = name")
    p_eval.add_argument("--limit", type=int, default=300, help="pseudo-label cases to use")
    p_eval.set_defaults(handler=cmd_eval)

    p_who = sub.add_parser("who", help="show the topics a member most often handles")
    p_who.add_argument("name", nargs="+")
    p_who.add_argument("--terms", type=int, default=20, help="number of terms to show")
    p_who.set_defaults(handler=cmd_who)
    return parser


# ------------------------------------------------------------------- commands
def cmd_index(args: argparse.Namespace, config: Config) -> int:
    overrides = load_overrides(config.overrides_file)
    stats = build_index(config, overrides)
    team = Text("Team: ", style="bold")
    for i, status in enumerate(STATUSES):
        team.append(", " if i else "")
        team.append(f"{stats.team_counts.get(status, 0)} {status}", STATUS_STYLE.get(status, ""))
    console = _console()
    console.print(
        f"Indexed {stats.files} files, {stats.posts} posts, {stats.conversations} threads "
        f"({stats.indexed} searchable) in {stats.seconds:.1f}s."
    )
    console.print(team + ".")
    return EXIT_OK


def cmd_ask(args: argparse.Namespace, config: Config) -> int:
    text = sys.stdin.read() if args.text == ["-"] else " ".join(args.text)
    with _open_index(config) as conn:
        _warn_stale_overrides(conn, config)
        statuses = {"current"}
        if args.include_former:
            statuses.add("former")
        if args.include_candidates:
            statuses.add("candidate")
        excluded = {_resolve_name(conn, n) for n in args.exclude}
        ranker = Ranker(conn)
        team = args.team.lstrip("#") if args.team else None
        if team is not None and team not in ranker.sub_team_channels:
            known = ", ".join(ranker.sub_team_channels) or "none configured"
            raise ConfigError(f"'{args.team}' is not a sub-team channel ({known})")
        result = ranker.rank(
            text, limit=args.limit, statuses=statuses, exclude_people=excluded, team=team
        )
    _print_result(text, result, config, explain=args.explain)
    return EXIT_OK


def cmd_team(args: argparse.Namespace, config: Config) -> int:
    with _open_index(config) as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM people")]
        reference_ts = float(store.get_meta(conn, "reference_ts") or 0)
    order = {s: i for i, s in enumerate(STATUSES)}
    rows = [r for r in rows if args.all or r["status"] != "external"]
    rows.sort(key=lambda r: (order.get(r["status"], 9), r["name"]))
    console = _console()
    console.print(
        Text(f"Team as of {_date(reference_ts)}", style="bold"),
        Text(f"(EODs counted over {EOD_LOOKBACK_DAYS} days)", style="dim"),
    )
    table = _table()
    for title in ("Status", "Name", "EODs", "Last EOD", "Private", "Last active", "Override"):
        table.add_column(title, justify="right" if title in ("EODs", "Private") else "left")
    for r in rows:
        table.add_row(
            Text(r["status"], style=STATUS_STYLE.get(r["status"], "")),
            Text(r["name"]),
            str(r["eod_recent"]),
            _date(r["eod_last"]),
            str(r["priv_total"]),
            _date(r["last_active"]),
            Text(r["override"] or "", style="yellow"),
        )
    console.print(table)
    return EXIT_OK


def cmd_eval(args: argparse.Namespace, config: Config) -> int:
    with _open_index(config) as conn:
        if args.labels:
            cases = labelled_cases(conn, args.labels)
        else:
            cases = pseudo_label_cases(conn, args.limit)
        report = evaluate(Ranker(conn), cases)
    source = f"labels from {args.labels}" if args.labels else "pseudo-labels (derived resolver)"
    console = _console()
    console.print(
        Text(f"Evaluated {report.cases} cases", style="bold"),
        Text(f"using {source}, time-split.", style="dim"),
    )
    table = _table()
    table.add_column("")
    for title in ("Top-1", "Top-3", "Top-5", "MRR"):
        table.add_column(title, justify="right")
    rows = (
        ("maas-delegate", report.tool, "bold"),
        ("without sub-team #4-5", report.overall_only, ""),
        ("most-active baseline", report.baseline, "dim"),
    )
    for label, m, style in rows:
        table.add_row(
            label, f"{m.top1:.1%}", f"{m.top3:.1%}", f"{m.top5:.1%}", f"{m.mrr:.3f}", style=style
        )
    console.print(table)
    return EXIT_OK


def cmd_who(args: argparse.Namespace, config: Config) -> int:
    with _open_index(config) as conn:
        name = _resolve_name(conn, " ".join(args.name))
        personal = conn.execute(
            """
            SELECT t.term AS term, SUM(a.weight * t.tf * 1.0 / d.length) AS s
            FROM attributions a
            JOIN doc_terms t ON t.conv_id = a.conv_id
            JOIN docs d ON d.conv_id = a.conv_id
            WHERE a.person = ?
            GROUP BY t.term
            """,
            (name,),
        ).fetchall()
        overall = {
            r["term"]: (r["g"], r["df"])
            for r in conn.execute(
                "SELECT t.term AS term, SUM(t.tf * 1.0 / d.length) AS g, COUNT(*) AS df "
                "FROM doc_terms t JOIN docs d ON d.conv_id = t.conv_id GROUP BY t.term"
            )
        }
        kinds = conn.execute(
            "SELECT c.kind, c.channel, COUNT(*) AS n FROM attributions a "
            "JOIN conversations c ON c.id = a.conv_id WHERE a.person = ? "
            "GROUP BY c.kind, c.channel ORDER BY n DESC",
            (name,),
        ).fetchall()
    console = _console()
    console.print(Text(name, style="bold"))
    threads = ", ".join(f"{r['n']} {r['kind']} in #{r['channel']}" for r in kinds)
    terms = ", ".join(_distinctive_terms(personal, overall, args.terms))
    console.print(Text.assemble(("  threads: ", "dim"), threads))
    console.print(Text.assemble(("  distinctive terms: ", "dim"), (terms, "cyan")))
    return EXIT_OK


def _distinctive_terms(
    personal: list[sqlite3.Row], overall: dict[str, tuple[float, int]], limit: int
) -> list[str]:
    """Rank terms by personal weight x log-lift over the whole corpus (df >= 3)."""
    total_personal = sum(r["s"] for r in personal) or 1.0
    total_overall = sum(g for g, _ in overall.values()) or 1.0
    scored: list[tuple[str, float]] = []
    for row in personal:
        g, df = overall.get(row["term"], (0.0, 0))
        if df < 3 or g <= 0:
            continue
        lift = (row["s"] / total_personal) / (g / total_overall)
        if lift > 1:
            scored.append((row["term"], row["s"] * math.log(lift)))
    scored.sort(key=lambda kv: kv[1], reverse=True)
    return [term for term, _ in scored[:limit]]


# -------------------------------------------------------------------- helpers
def _open_index(config: Config) -> closing[sqlite3.Connection]:
    return closing(store.open_existing(config.db_path))


def _resolve_name(conn: sqlite3.Connection, query: str) -> str:
    names = {r["name"] for r in conn.execute("SELECT name FROM people")}
    names |= {r["sender"] for r in conn.execute("SELECT DISTINCT sender FROM posts")}
    q = query.strip().lower()
    exact = [n for n in names if n.lower() == q]
    if exact:
        return exact[0]
    partial = sorted(n for n in names if q in n.lower())
    if len(partial) == 1:
        return partial[0]
    if not partial:
        raise ConfigError(f"no person matches '{query}'")
    raise ConfigError(f"'{query}' is ambiguous: {', '.join(partial)}")


def _warn_stale_overrides(conn: sqlite3.Connection, config: Config) -> None:
    indexed_at = float(store.get_meta(conn, "indexed_at") or 0)
    path = config.overrides_file
    if path.exists() and path.stat().st_mtime > indexed_at:
        print(f"warning: {path.name} changed since the last index; run `index`", file=sys.stderr)


def _date(ts: float | None) -> str:
    if not ts:
        return "-"
    return datetime.fromtimestamp(ts, UTC).date().isoformat()


def _console() -> Console:
    """Colour only on a terminal (rich also honours NO_COLOR); wide rows when piped."""
    return Console(highlight=False, width=None if sys.stdout.isatty() else PIPED_WIDTH)


def _table() -> Table:
    return Table(
        box=box.HORIZONTALS,
        show_edge=False,
        pad_edge=False,
        header_style="bold",
        border_style="dim",
    )


def _usual_style(vs_usual: float) -> str:
    if vs_usual >= 3:
        return "bold green"
    if vs_usual >= 1.5:
        return "green"
    return "dim" if vs_usual < 1 else ""


def _member_row(i: int, m: MemberScore, top: float) -> list[Text]:
    name = Text(m.name)
    if m.status != "current":
        name.append(f" [{m.status}]", STATUS_STYLE.get(m.status, ""))
    filled = round(m.score / top * BAR_WIDTH) if top else 0
    bar = Text("█" * filled, "magenta" if m.sub_team else "green")
    bar.append("░" * (BAR_WIDTH - filled), "dim")
    channel = Text(f"#{m.sub_team}", "magenta") if m.sub_team else Text()
    return [
        Text(f"{i}.", "dim"),
        name,
        Text(f"{m.score:.1%}"),
        bar,
        Text(f"{m.vs_usual:.1f}x", _usual_style(m.vs_usual)),
        Text(_date(m.latest_ts), "dim"),
        channel,
    ]


def _print_result(text: str, result: RankResult, config: Config, *, explain: bool) -> None:
    console = _console()
    query = " ".join(text.split())
    shown = f"{query[:100]}{'…' if len(query) > 100 else ''}"
    console.print(Text.assemble(("Query: ", "bold"), (f'"{shown}"', "italic")))
    console.print(Text(f"Matched {result.matched} past conversation(s).", "dim"))
    if result.results:
        table = _table()
        table.add_column("", justify="right")
        table.add_column("Member")
        table.add_column("Score", justify="right")
        table.add_column("", no_wrap=True)
        table.add_column("", justify="right")
        table.add_column("Latest")
        table.add_column("Channel")
        previous: MemberScore | None = None
        # Bars are scaled to the best score in the same section (overall / sub-team).
        top = {
            section: max(
                (m.score for m in result.results if bool(m.sub_team) == section), default=0
            )
            for section in (False, True)
        }
        for i, m in enumerate(result.results, 1):
            if previous is not None and m.sub_team and not previous.sub_team:
                table.add_section()
            table.add_row(*_member_row(i, m, top[bool(m.sub_team)]))
            previous = m
        console.print()
        console.print(table)
    console.print()
    if result.low_confidence:
        reasons = "; ".join(result.reasons)
        console.print(Text.assemble(("Confidence: low", "bold yellow"), f" ({reasons})"))
    else:
        console.print(Text("Confidence: high", "bold green"))
    if explain and result.results:
        console.print(Text("\nEvidence", "bold"))
        for i, m in enumerate(result.results, 1):
            console.print(Text.assemble((f"{i}. ", "dim"), (m.name, "bold")))
            for e in m.evidence:
                console.print(
                    Text.assemble(
                        "   ",
                        (_date(e.root_ts), "dim"),
                        "  ",
                        (f"#{e.channel:<13}", "cyan"),
                        f" {e.role:<11} ",
                        (f"sim {e.similarity:.2f}", "dim"),
                        f"  {e.snippet[:80]}",
                    ),
                    no_wrap=True,
                    overflow="ellipsis",
                )
                link = f"{config.permalink_base}{e.conv_id}" if config.permalink_base else None
                where = Text(f"   {link or 'post ' + e.conv_id}", "dim")
                if link:
                    where.stylize(f"link {link}")
                console.print(where)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
