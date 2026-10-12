from __future__ import annotations

from pathlib import Path

from maas_delegate.parse import iter_day_files, parse_text, parse_timestamp


def test_parses_posts_replies_and_multiline_text() -> None:
    content = (
        "# maas - 2026-03-23\n\n"
        "**[2026-03-23T06:38:04Z] [aaa111] Erin External**: How do I change the port?\n"
        "second line\n\n"
        "**[2026-03-23T06:51:25Z] [bbb222] Bob Brown** *(reply to aaa111)*: Use haproxy\n"
    )
    posts = parse_text(content, "maas")
    assert [p.id for p in posts] == ["aaa111", "bbb222"]
    assert posts[0].text == "How do I change the port?\nsecond line"
    assert posts[0].root_id is None
    assert posts[1].root_id == "aaa111"
    assert posts[1].sender == "Bob Brown"
    assert posts[1].ts == parse_timestamp("2026-03-23T06:51:25Z")
    assert posts[0].channel == "maas"


def test_missing_post_id_gets_stable_synthetic_id() -> None:
    content = "**[2026-03-23T06:38:04Z] Erin External**: no id here\n"
    first = parse_text(content, "maas")
    second = parse_text(content, "maas")
    assert len(first) == 1
    assert first[0].id == second[0].id
    assert first[0].id.startswith("x")


def test_empty_message_and_preamble_lines() -> None:
    content = "preamble\n**[2026-03-23T06:38:04Z] [a1] maasbot**: \n"
    posts = parse_text(content, "maas")
    assert len(posts) == 1
    assert posts[0].text == ""


def test_bold_text_inside_message_is_continuation() -> None:
    content = "**[2026-03-23T06:38:04Z] [a1] Bob Brown**: start\n**not a post** just bold text\n"
    posts = parse_text(content, "maas")
    assert len(posts) == 1
    assert "just bold text" in posts[0].text


def test_iter_day_files_ignores_other_files(tmp_path: Path) -> None:
    day_dir = tmp_path / "maas" / "2026" / "03"
    day_dir.mkdir(parents=True)
    (day_dir / "2026-03-02.md").write_text("")
    (day_dir / "notes.md").write_text("")
    assert [p.name for p in iter_day_files(tmp_path, "maas")] == ["2026-03-02.md"]
    assert list(iter_day_files(tmp_path, "missing")) == []
