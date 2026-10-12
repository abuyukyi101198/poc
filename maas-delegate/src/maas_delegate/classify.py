"""Rule-based conversation classification: bug / feature / help / discussion / other.

`other` covers chatter that carries no expertise: greetings, EODs, absence and lateness notices,
italic `/me` status lines, and team logistics (polls, slot scheduling, `patterns.chatter`).
"""

from __future__ import annotations

import re

from .config import SYSTEM_SENDER, Config
from .team import is_eod
from .text import any_of, tokenize
from .threads import Conversation

EXPERTISE_KINDS = frozenset({"bug", "feature", "help", "discussion"})

_GREETING_RE = re.compile(
    r"^\W*(?:good\s+)?(?:morning|afternoon|evening|hi|hello|hey|welcome)\b", re.I
)
_AWAY_RE = re.compile(
    r"\b(?:ooo|out of office|pto|brb|afk|lunch|be back|back in|stepping out|sick|doctor|"
    r"dentist|appointment|errand|power cut|internet (?:is )?down)\b|^\W*back\W*$",
    re.I,
)
_HOUSEKEEPING_RE = re.compile(r"updated the channel header", re.I)
_ABSENCE_RE = re.compile(
    r"\b(?:sick|(?:not )?feeling (?:unwell|sick|rough|ill|bad|great|amazing|well)|day off|"
    r"take (?:a|the) (?:day|afternoon|morning)|power (?:outage|cut)|coming down with|"
    r"lie down|running late|be late|late for|drop(?:ping)? (?:out|off)|make (?:it )?up|"
    r"holiday|vacation|ooo|out of office|pto|doctor|dentist|appointment|paperwork|"
    r"miss(?:ing)? (?:the )?(?:standup|stand-up|sync|meeting|call)|call(?:ing|in'?)? it a day|"
    r"i'?m off|off (?:for|today|tomorrow|until|on)\b|"
    r"(?:\d+\s*(?:minutes?|mins?)|a (?:bit|little)|slightly) late|later start|"
    r"start(?:ing)? (?:my day )?(?:a bit |slightly )?later?|traffic)\b",
    re.I,
)
ABSENCE_MAX_CHARS = 300
# Mattermost `/me` messages render as a single italic line: the team uses them for status notes.
_STATUS_RE = re.compile(r"\s*\*[^*\s](?:[^*]*[^*\s])?\*\s*")
# Team logistics: polls, presentation slots, cancelled meetings, swag.
_LOGISTICS = (
    r"forms\.gle|restaurant|\bt-?shirts?\b|\bswag\b|"
    r"any volunteers?\b|(?:grab|claim) (?:it|this|the|that)\b.*\bslot\b|"
    r"\bslot (?:has )?(?:just )?opened|swap (?:around|with)|is (?:now )?scheduled\b|"
    r"cancel(?:l?ed|l?ing)? (?:the |this |today'?s )?(?:meeting|call|sync)|"
    r"meeting (?:is|was) cancel|fill (?:out|in) your|"
    r"retrospective feedback|feedback (?:on|for) (?:my|the) presentation"
)
_TECHNICAL_RE = re.compile(r"`|https?://")
_BUG = (
    r"traceback|exception|\berror|errno|\bfail(?:s|ed|ing|ures?)?\b|crash|broken|regression|"
    r"\bbug\b|segfault|timed? ?out|doesn'?t work|not working|\bstuck\b|\bhangs?\b|panic:"
)
FEATURE_RE = re.compile(
    r"feature request|would be (?:nice|great|good|useful)|support for|could we (?:add|have)|"
    r"\brfe\b|wishlist|enhancement|add (?:an? )?option|\bpropos(?:e|al)\b",
    re.I,
)
HELP_RE = re.compile(
    r"\?|\bhow (?:do|can|to|does|should)\b|\banyone (?:know|have|seen|familiar)\b|"
    r"is it possible|any idea|can someone|could someone|\bhelp\b",
    re.I,
)
MIN_TOKENS = 6


def classify(conv: Conversation, config: Config) -> str:
    bots, patterns = config.bots, config.patterns
    bug_re = any_of((_BUG, *patterns.bug))
    root = conv.root_text
    root_sender = conv.root_author
    if root_sender == SYSTEM_SENDER or _HOUSEKEEPING_RE.search(root):
        return "other"
    if root_sender not in bots and is_eod(root):
        return "other"
    technical = _TECHNICAL_RE.search(root) is not None
    short_social = _GREETING_RE.match(root) or _AWAY_RE.search(root)
    if len(root) <= 80 and "?" not in root and short_social and not technical:
        return "other"
    if len(root) <= ABSENCE_MAX_CHARS and _ABSENCE_RE.search(root) and not technical:
        return "other"
    if _STATUS_RE.fullmatch(root) and "`" not in root:
        return "other"
    chatter = any_of((_LOGISTICS, *patterns.chatter)).search(root)
    if chatter and "`" not in root and not bug_re.search(root):
        return "other"
    human_tokens = sum(
        len(tokenize(p.text, bug_ids=patterns.bug_id)) for p in conv.posts if p.sender not in bots
    )
    if human_tokens < MIN_TOKENS:
        return "other"
    if bug_re.search(root):
        return "bug"
    if FEATURE_RE.search(root):
        return "feature"
    if HELP_RE.search(root):
        return "help"
    return "discussion"
