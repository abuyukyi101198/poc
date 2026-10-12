"""Domain-aware tokenisation for chat text."""

from __future__ import annotations

import functools
import re
from collections.abc import Iterable

_URL_RE = re.compile(r"https?://[^\s)\]>]+")
_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")
_EMOJI_RE = re.compile(r":[a-z0-9_+\-]+:")
_MENTION_RE = re.compile(r"(?<![\w.])@[\w.\-]+")
_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9._\-/]*[a-z0-9]|[a-z0-9]")
# Bug references become one `bug<id>` token; `patterns.bug_id` adds tracker-specific forms.
_BUG_ID = r"\bbug\s?#(\d+)"
_VERSION_RE = re.compile(r"^\d+(?:\.\d+)+$")

_STOPWORD_TEXT = """
    a about above after again against all also am an and any are aren as at be because been
    before being below between both but by can cannot could couldn did didn do does doesn doing
    don down during each few for from further had hadn has hasn have haven having he her here
    hers herself him himself his how i if in into is isn it its itself just let me more most
    mustn my myself no nor not now of off on once only or other our ours ourselves out over own
    same shan she should shouldn so some such than that the their theirs them themselves then
    there these they this those through to too under until up very was wasn we were weren what
    when where which while who whom why will with won would wouldn you your yours yourself
    yourselves ll ve re im ive id youre thats theres dont cant isnt wont didnt doesnt
    hi hey hello morning evening afternoon good thanks thank thx ty please pls ok okay yes yeah
    yep nope no lol haha hmm sure great nice cool also maybe still get got think know see
    eod eow wave one two like want need thing things something anything really already actually
    today tomorrow yesterday folks folk mate guys everyone feel feeling hope soon
    https http www com org net html
"""
STOPWORDS = frozenset(_STOPWORD_TEXT.split())


@functools.cache
def any_of(patterns: tuple[str, ...], ignore_case: bool = True) -> re.Pattern[str]:
    """Compile a regex matching any of `patterns`."""
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.I if ignore_case else 0)


def tokenize(
    text: str, extra_stopwords: Iterable[str] = (), bug_ids: tuple[str, ...] = ()
) -> list[str]:
    """Lowercase, normalise links/emoji/mentions and split into stemmed domain tokens.

    `bug_ids` are extra regexes with one group capturing a bug number.
    """
    extra = frozenset(extra_stopwords)
    lowered = text.lower()
    lowered = any_of((*bug_ids, _BUG_ID)).sub(
        lambda m: f" bug{m.group(m.lastindex or 0)} ", lowered
    )
    lowered = _MD_LINK_RE.sub(lambda m: f"{m.group(1)} {_url_terms(m.group(2))}", lowered)
    lowered = _URL_RE.sub(lambda m: f" {_url_terms(m.group(0))} ", lowered)
    lowered = _EMOJI_RE.sub(" ", lowered)
    lowered = _MENTION_RE.sub(" ", lowered)

    tokens: list[str] = []
    for raw in _TOKEN_RE.findall(lowered):
        for tok in _expand(raw.strip("._-/")):
            if _keep(tok) and tok not in extra:
                tokens.append(stem(tok))
    return tokens


def _url_terms(url: str) -> str:
    body = url.split("://", 1)[-1].rstrip("/")
    host, _, path = body.partition("/")
    host_parts = [p for p in host.split(".") if p not in {"www", "com", "org", "net", "io"}]
    segments = [s for s in re.split(r"[/?#=&+]", path) if s]
    tail = segments[-1] if segments else ""
    if re.fullmatch(r"[a-z0-9]{20,}", tail):  # opaque IDs (permalinks, hashes)
        tail = ""
    return " ".join([*host_parts, tail])


def _expand(token: str) -> list[str]:
    if not token:
        return []
    if _VERSION_RE.match(token):
        return [token]
    if "/" in token:
        return [t for segment in token.split("/") for t in _expand(segment.strip("._-"))]
    parts = [p for p in re.split(r"[._\-]", token) if p]
    if len(parts) > 1:
        return [token, *parts]
    return [token]


def _keep(token: str) -> bool:
    if len(token) < 2 or token in STOPWORDS:
        return False
    if token.isdigit():
        return len(token) >= 3
    return True


def stem(token: str) -> str:
    """Very light suffix stripping for plain alphabetic words; domain tokens are untouched.

    Strips a plural "s", then "ing"/"ed", then a trailing "e", so inflections agree:
    image/images -> imag, upgrade/upgrading/upgraded -> upgrad, setting/settings -> sett.
    """
    if not token.isalpha() or len(token) <= 4:
        return token
    if token.endswith("s") and not token.endswith("ss") and len(token) - 1 >= 4:
        token = token[:-1]
    for suffix in ("ing", "ed"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            token = token[: -len(suffix)]
            break
    if token.endswith("e") and len(token) > 4:
        token = token[:-1]
    return token
