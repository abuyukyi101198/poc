from __future__ import annotations

from dataclasses import replace

from maas_delegate.attribute import attribute, is_substantive
from maas_delegate.classify import classify
from maas_delegate.config import Config, Patterns
from maas_delegate.parse import Post
from maas_delegate.threads import Conversation, build_conversations

from .conftest import CHANNEL_SETTINGS, TEST_PATTERNS, make_post

GENERIC = replace(CHANNEL_SETTINGS, patterns=Patterns())
TEAM = {"Alice Anders", "Bob Brown", "Carol Chen"}
LONG = "This is a fairly long and substantive explanation of the dhcp relay fix"


def _conv(root: Post | None, *replies: Post) -> Conversation:
    return Conversation(id="root", channel="maas", root=root, replies=list(replies))


def _roles(conv: Conversation, patterns: Patterns = TEST_PATTERNS) -> dict[str, str]:
    return {a.person: a.role for a in attribute(conv, TEAM, patterns)}


def test_resolver_is_last_substantive_answer_before_ack() -> None:
    conv = _conv(
        make_post("Erin External", "How do I fix this?", post_id="root"),
        make_post("Alice Anders", LONG, ts="2026-10-01T10:01:00Z"),
        make_post("Bob Brown", LONG + " too", ts="2026-10-01T10:02:00Z"),
        make_post("Erin External", "thanks, that worked", ts="2026-10-01T10:03:00Z"),
        make_post("Carol Chen", LONG + " later", ts="2026-10-01T10:04:00Z"),
    )
    assert _roles(conv) == {
        "Bob Brown": "resolver",
        "Alice Anders": "contributor",
        "Carol Chen": "contributor",
    }


def test_short_answer_can_resolve_when_nothing_substantive() -> None:
    conv = _conv(
        make_post("Erin External", "Is it fixed?", post_id="root"),
        make_post("Alice Anders", "yes, in 3.6.2 already"),
    )
    assert _roles(conv) == {"Alice Anders": "resolver"}


def test_team_root_author_gets_credit_unless_question() -> None:
    statement = _conv(
        make_post("Alice Anders", "I refactored the permission checks to use the cache"),
        make_post("Bob Brown", "ok"),
    )
    assert _roles(statement) == {"Alice Anders": "contributor"}
    question = _conv(
        make_post("Alice Anders", "Does anyone know why the permission checks are slow?"),
        make_post("Bob Brown", LONG),
    )
    assert _roles(question) == {"Bob Brown": "resolver"}


def test_is_substantive() -> None:
    assert is_substantive("run `maas status`", Patterns())
    assert is_substantive("sudo apt update", Patterns())
    assert not is_substantive("ok, will do", Patterns())
    assert not is_substantive("snap list", Patterns())
    assert is_substantive("snap list", TEST_PATTERNS)


def test_build_conversations_groups_and_drops_singletons() -> None:
    posts = [
        make_post("A", "root", post_id="r1", ts="2026-10-01T10:00:00Z"),
        make_post("B", "reply", post_id="c1", root="r1", ts="2026-10-01T10:05:00Z"),
        make_post("A", "lonely", post_id="r2", ts="2026-10-01T11:00:00Z"),
        make_post("B", "orphan reply", post_id="c2", root="missing", ts="2026-10-01T09:00:00Z"),
    ]
    convs = build_conversations(posts)
    assert [c.id for c in convs] == ["missing", "r1"]
    orphan = convs[0]
    assert orphan.root is None and orphan.root_author is None
    assert orphan.root_text == "orphan reply"
    assert convs[1].root_ts == convs[1].posts[0].ts and len(convs[1].posts) == 2
    with_team = build_conversations(posts, standalone_authors={"A"})
    assert [c.id for c in with_team] == ["missing", "r1", "r2"]
    assert with_team[2].standalone and not with_team[1].standalone


def test_standalone_author_and_review_requests() -> None:
    announcement = Conversation(
        id="s1",
        channel="maas-private",
        root=make_post("Alice Anders", "The new regiond race condition fix is merged into master"),
    )
    assert _roles(announcement) == {"Alice Anders": "author"}
    review = _conv(
        make_post(
            "Alice Anders",
            "Could someone review my MP? https://code.launchpad.net/~a/maas/+git/maas/+merge/1",
        ),
        make_post("Bob Brown", "ok"),
    )
    assert _roles(review) == {"Alice Anders": "contributor"}
    merge = _conv(
        make_post("Alice Anders", "Could someone look? https://code.launchpad.net/~a/+merge/1"),
        make_post("Bob Brown", "ok"),
    )
    assert _roles(merge) == {"Alice Anders": "contributor"}
    assert _roles(merge, Patterns()) == {}
    outsider = Conversation(id="s2", channel="maas", root=make_post("Erin External", LONG))
    assert _roles(outsider) == {}


def test_classify_kinds() -> None:
    def kind(root: str, reply: str = LONG, sender: str = "Erin External") -> str:
        conv = _conv(make_post(sender, root), make_post("Bob Brown", reply))
        return classify(conv, CHANNEL_SETTINGS)

    assert kind("Deploy fails with a traceback in curtin") == "bug"
    assert kind("It would be nice to have support for tags in the API") == "feature"
    assert kind("How do I configure a VLAN for PXE?") == "help"
    assert kind("We are moving the CI to a new region next week") == "discussion"
    assert kind("Morning all", "Hi") == "other"
    assert kind("back in 30m", "ok") == "other"
    sick = "Hi folks, I'm feeling sick this morning. I'm going to rest today and be back tomorrow"
    assert kind(sick, "Get well soon, take care and rest as much as you need to recover") == "other"
    assert kind("Dentist slot clash: deploy fails with `curtin` error on 3.6", LONG) == "bug"
    assert kind("EOD :wave:") == "other"
    assert kind("updated the channel header from: x", sender="System") == "other"
    assert kind(":jenkins_fire: tests failed on master", sender="maasbot") == "bug"
    assert kind("ok", "ok") == "other"


def test_classify_status_lateness_and_logistics_are_other() -> None:
    def kind(root: str, reply: str = LONG, config: Config = CHANNEL_SETTINGS) -> str:
        conv = _conv(make_post("Alice Anders", root), make_post("Bob Brown", reply))
        return classify(conv, config)

    crash = "*" + " ".join(["Someone crashed into my car, now police and insurance paperwork."] * 6)
    assert kind(crash + "*") == "other"
    assert kind("*starting 15 minutes late. stuck in traffic*") == "other"
    assert kind("Slightly late start as had to drop cat off at vet this morning") == "other"
    assert kind("Hi folks, I will start a bit later today. Need to collect some docs") == "other"
    vanguard_gap = "Looks like we don't have anybody on support vanguard this week. Any volunteer?"
    assert kind(vanguard_gap) == "other"
    poll = "Hello team, the next [C&D](https://docs.example.com/d) poll is up for your vote"
    assert kind(poll) == "other"
    assert kind(poll, config=GENERIC) != "other"
    assert kind("We are considering having a MAAS Team specific T-Shirt for the sprint") == "other"

    # Technical content survives: code in italics, failures in a logistics-looking root.
    assert kind("*`rackd` keeps restarting after the upgrade*") != "other"
    vanguard = "@dave as support vanguard, any volunteer to check these systemtests failures?"
    assert kind(vanguard) != "other"
    assert kind("The maas-ui CI started failing after the swap with the new runner, any idea?") == (
        "bug"
    )
