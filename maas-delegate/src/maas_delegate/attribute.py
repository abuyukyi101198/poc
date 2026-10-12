"""Per-conversation attribution of expertise to team members (specs/research.md §5)."""

from __future__ import annotations

import re
from collections.abc import Collection
from dataclasses import dataclass

from .config import Patterns
from .text import any_of
from .threads import Conversation

RESOLVER = 1.0
CONTRIBUTOR = 0.75
AUTHOR = 0.5

_ACK_RE = re.compile(
    r"\b(?:thanks|thank you|thx|ty|works|worked|working now|solved|fixed|that did it|perfect)\b",
    re.I,
)
_QUESTION_RE = re.compile(
    r"\?|\b(?:anyone|how do|how can|how to|is it possible|any idea|can someone|could someone)\b",
    re.I,
)
_REVIEW = r"\b(?:review|pr|pull request)\b|/pull/\d"
_COMMAND_WORDS = ("sudo", "apt", "systemctl")
SUBSTANTIVE_CHARS = 40
MEANINGFUL_CHARS = 15


@dataclass(frozen=True)
class Attribution:
    person: str
    role: str
    weight: float


def is_question(text: str) -> bool:
    return bool(_QUESTION_RE.search(text))


def is_substantive(text: str, patterns: Patterns) -> bool:
    if len(text.strip()) >= SUBSTANTIVE_CHARS:
        return True
    words = "|".join(re.escape(w) for w in (*_COMMAND_WORDS, *patterns.command_words))
    command = any_of((r"`|https?://|\s--?[a-z]", rf"\b(?:{words})\s"), ignore_case=False)
    return bool(command.search(text))


def attribute(conv: Conversation, team: Collection[str], patterns: Patterns) -> list[Attribution]:
    """Assign resolver/contributor/author roles to team members in a conversation.

    Posts must already use canonical sender names.
    """
    review_re = any_of((_REVIEW, *patterns.review))
    root_author = conv.root_author
    replies = conv.replies

    cutoff = len(replies)
    if root_author is not None:
        for i, reply in enumerate(replies):
            if (
                i > 0
                and reply.sender == root_author
                and _ACK_RE.search(reply.text)
                and any(r.sender != root_author for r in replies[:i])
            ):
                cutoff = i
                break

    def answerer(sender: str) -> bool:
        return sender in team and sender != root_author

    before_ack = replies[:cutoff]
    substantive = [r for r in before_ack if answerer(r.sender) and is_substantive(r.text, patterns)]
    meaningful = [
        r for r in before_ack if answerer(r.sender) and len(r.text.strip()) >= MEANINGFUL_CHARS
    ]
    roles: dict[str, Attribution] = {}
    resolver_post = (substantive or meaningful or [None])[-1]
    if resolver_post is not None:
        roles[resolver_post.sender] = Attribution(resolver_post.sender, "resolver", RESOLVER)

    for reply in replies:
        if (
            answerer(reply.sender)
            and reply.sender not in roles
            and is_substantive(reply.text, patterns)
        ):
            roles[reply.sender] = Attribution(reply.sender, "contributor", CONTRIBUTOR)

    if (
        conv.root is not None
        and root_author is not None
        and root_author in team
        and root_author not in roles
        and is_substantive(conv.root.text, patterns)
        and (not is_question(conv.root.text) or review_re.search(conv.root.text))
    ):
        if conv.standalone:
            roles[root_author] = Attribution(root_author, "author", AUTHOR)
        else:
            roles[root_author] = Attribution(root_author, "contributor", CONTRIBUTOR)

    return list(roles.values())
