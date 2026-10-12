from __future__ import annotations

from maas_delegate.text import stem, tokenize

from .conftest import TEST_PATTERNS

TB = TEST_PATTERNS.bug_id


def test_keeps_versions_and_domain_tokens() -> None:
    tokens = tokenize("Upgrade to 3.6 broke cloud-init on 24.04 with rackd")
    assert "3.6" in tokens
    assert "24.04" in tokens
    assert "cloud-init" in tokens
    assert "cloud" in tokens and "init" in tokens
    assert "rackd" in tokens


def test_short_words_and_maas_are_not_stemmed() -> None:
    assert stem("maas") == "maas"
    assert stem("failing") == "fail"
    assert stem("failed") == "fail"
    assert stem("process") == "process"
    assert stem("3.6") == "3.6"


def test_inflections_share_a_stem() -> None:
    assert stem("image") == stem("images") == "imag"
    assert stem("upgrade") == stem("upgrading") == stem("upgraded") == stem("upgrades")
    assert stem("setting") == stem("settings")
    assert stem("machine") == stem("machines")
    assert stem("processes") == stem("process") == "process"
    assert stem("docs") == "docs" and stem("nodes") == stem("node") == "node"


def test_links_emoji_mentions_and_stopwords() -> None:
    text = (
        "Hi @bob :wave: see https://bugs.launchpad.net/maas/+bug/2012345 and "
        "[docs](https://maas.io/docs/how-to-network) thanks"
    )
    tokens = tokenize(text)
    assert "bug2012345" not in tokens
    assert "bug2012345" in tokenize(text, bug_ids=(r"\+bug/(\d+)",))
    assert "bug42" in tokenize("Fixed by bug #42") and "bug42" in tokenize("lp:42", bug_ids=TB)
    assert "bob" not in tokens
    assert "wave" not in tokens
    assert "hi" not in tokens and "thanks" not in tokens
    assert "how-to-network" in tokens
    assert "docs" in tokens


def test_paths_are_split_and_short_numbers_dropped() -> None:
    tokens = tokenize("see /var/snap/maas/common/log/rackd.log line 42 error 1234")
    assert "rackd.log" in tokens
    assert "rackd" in tokens
    assert "snap" in tokens
    assert "42" not in tokens
    assert "1234" in tokens


def test_extra_stopwords_and_opaque_ids() -> None:
    tokens = tokenize(
        "ask zelda https://chat.example.com/team/pl/abcdefghijklmnopqrstuvwxyz", ["zelda"]
    )
    assert "zelda" not in tokens
    assert not any(len(t) >= 20 for t in tokens)
