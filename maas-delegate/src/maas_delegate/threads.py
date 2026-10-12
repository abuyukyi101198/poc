"""Conversation reconstruction: explicit threads plus standalone team posts.

Implicit Q&A windows (specs/research.md §4) were evaluated on the archive and dropped: the team
answers in threads, so unthreaded questions are followed only by greetings and EODs.
"""

from __future__ import annotations

from collections.abc import Collection, Iterable
from dataclasses import dataclass, field

from .parse import Post


@dataclass
class Conversation:
    id: str
    channel: str
    root: Post | None
    replies: list[Post] = field(default_factory=list[Post])

    @property
    def posts(self) -> list[Post]:
        return [self.root, *self.replies] if self.root else list(self.replies)

    @property
    def root_author(self) -> str | None:
        return self.root.sender if self.root else None

    @property
    def root_text(self) -> str:
        if self.root:
            return self.root.text
        return self.replies[0].text if self.replies else ""

    @property
    def standalone(self) -> bool:
        return not self.replies

    @property
    def root_ts(self) -> float:
        return self.posts[0].ts


def build_conversations(
    posts: Iterable[Post], standalone_authors: Collection[str] = ()
) -> list[Conversation]:
    """Group posts into explicit threads keyed by root post ID.

    Threads without replies are dropped, except top-level posts by `standalone_authors`
    (team members), which become single-post conversations: announcements, fixes and
    review requests are expertise evidence even when nobody replies in a thread.
    """
    by_id: dict[str, Post] = {}
    replies: dict[str, list[Post]] = {}
    top_level: list[Post] = []
    for post in posts:
        by_id[post.id] = post
        if post.root_id:
            replies.setdefault(post.root_id, []).append(post)
        elif post.sender in standalone_authors:
            top_level.append(post)

    conversations: list[Conversation] = []
    for root_id, items in replies.items():
        items.sort(key=lambda p: p.ts)
        root = by_id.get(root_id)
        channel = root.channel if root else items[0].channel
        conversations.append(Conversation(id=root_id, channel=channel, root=root, replies=items))
    for post in top_level:
        if post.id not in replies:
            conversations.append(Conversation(id=post.id, channel=post.channel, root=post))
    conversations.sort(key=lambda c: c.root_ts)
    return conversations
