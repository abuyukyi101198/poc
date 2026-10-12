"""Configuration and team-override loading."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

DEFAULT_CONFIG_NAME = "maas-delegate.toml"
# mattermost-archive writes system messages (joins, header changes) under this sender.
SYSTEM_SENDER = "System"
_STRING_KEYS = frozenset(
    {"archive_dir", "data_dir", "overrides_file", "permalink_base", "eod_channel", "team_channel"}
)
_LIST_KEYS = frozenset({"sub_team_channels", "bots"})
_PATTERN_KEYS = ("chatter", "bug", "review", "bug_id", "command_words")


class ConfigError(Exception):
    """Raised when a configuration or overrides file is invalid."""


@dataclass(frozen=True)
class Patterns:
    """Deployment-specific vocabulary, added to the generic built-in rules.

    All but `command_words` are case-insensitive regexes. `chatter`: team rituals and logistics
    that carry no expertise. `bug`: bug signals. `review`: review requests. `bug_id`: bug
    references, with one group capturing the number. `command_words`: CLI tools whose mention
    makes a short reply substantive (matched literally, case-sensitive).
    """

    chatter: tuple[str, ...] = ()
    bug: tuple[str, ...] = ()
    review: tuple[str, ...] = ()
    bug_id: tuple[str, ...] = ()
    command_words: tuple[str, ...] = ()


@dataclass(frozen=True)
class Config:
    archive_dir: Path = Path("mm-archive")
    data_dir: Path = Path(".maas-delegate")
    overrides_file: Path = Path("team-overrides.toml")
    permalink_base: str | None = None
    # Top-level EOD posts in `eod_channel` and posts in the team-only `team_channel` define the
    # team (specs/research.md §3). Sub-team channels have their own technical focus (§6).
    eod_channel: str = ""
    team_channel: str = ""
    sub_team_channels: tuple[str, ...] = ()
    bots: frozenset[str] = frozenset({SYSTEM_SENDER})
    patterns: Patterns = Patterns()

    @property
    def db_path(self) -> Path:
        return self.data_dir / "db.sqlite"

    @property
    def channels(self) -> tuple[str, ...]:
        """All channels to index, without duplicates."""
        return tuple(dict.fromkeys((self.eod_channel, self.team_channel, *self.sub_team_channels)))

    def require_channels(self) -> None:
        if not self.eod_channel or not self.team_channel:
            raise ConfigError(
                f"set eod_channel and team_channel in {DEFAULT_CONFIG_NAME} "
                f"(see maas-delegate.example.toml)"
            )


@dataclass(frozen=True)
class Overrides:
    include: frozenset[str] = frozenset()
    exclude: frozenset[str] = frozenset()
    former: frozenset[str] = frozenset()
    # canonical name -> alternative display names
    aliases: dict[str, tuple[str, ...]] = field(default_factory=dict[str, tuple[str, ...]])

    def status_for(self, name: str) -> str | None:
        if name in self.exclude:
            return "external"
        if name in self.former:
            return "former"
        if name in self.include:
            return "current"
        return None

    def alias_map(self) -> dict[str, str]:
        """Alternative display name -> canonical name."""
        return {alias: name for name, aliases in self.aliases.items() for alias in aliases}


def read_toml(path: Path) -> dict[str, Any]:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ConfigError(f"cannot read {path}: {exc}") from exc
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"invalid TOML in {path}: {exc}") from exc


def load_config(path: Path | None = None, base_dir: Path | None = None) -> Config:
    """Load configuration from `path`, or from `./maas-delegate.toml` if present, else defaults."""
    base = base_dir or Path.cwd()
    if path is None:
        path = base / DEFAULT_CONFIG_NAME
        if not path.exists():
            return _resolve_paths(Config(), base)
    raw = read_toml(path)
    unknown = set(raw) - _STRING_KEYS - _LIST_KEYS - {"patterns"}
    if unknown:
        raise ConfigError(f"{path}: unknown keys {sorted(unknown)}")
    if not all(isinstance(raw[k], str) for k in _STRING_KEYS & raw.keys()):
        raise ConfigError(f"{path}: {', '.join(sorted(_STRING_KEYS))} must be strings")
    default = Config()
    config = Config(
        archive_dir=Path(raw.get("archive_dir", default.archive_dir)),
        data_dir=Path(raw.get("data_dir", default.data_dir)),
        overrides_file=Path(raw.get("overrides_file", default.overrides_file)),
        permalink_base=raw.get("permalink_base"),
        eod_channel=raw.get("eod_channel", ""),
        team_channel=raw.get("team_channel", ""),
        sub_team_channels=tuple(
            _string_list(raw.get("sub_team_channels", []), "sub_team_channels", path)
        ),
        bots=default.bots | frozenset(_string_list(raw.get("bots", []), "bots", path)),
        patterns=_patterns(raw.get("patterns", {}), path),
    )
    return _resolve_paths(config, path.parent)


def _patterns(raw: Any, path: Path) -> Patterns:
    if not isinstance(raw, dict):
        raise ConfigError(f"{path}: 'patterns' must be a table")
    unknown = set(raw) - set(_PATTERN_KEYS)
    if unknown:
        raise ConfigError(f"{path}: unknown keys in [patterns] {sorted(unknown)}")
    values = {k: tuple(_string_list(raw.get(k, []), f"patterns.{k}", path)) for k in _PATTERN_KEYS}
    for key in ("chatter", "bug", "review", "bug_id"):
        for pattern in values[key]:
            try:
                groups = re.compile(pattern).groups
            except re.error as exc:
                raise ConfigError(
                    f"{path}: patterns.{key}: invalid regex {pattern!r}: {exc}"
                ) from exc
            if key == "bug_id" and groups != 1:
                raise ConfigError(
                    f"{path}: patterns.bug_id: {pattern!r} needs exactly one capturing group"
                )
    return Patterns(**values)


def _resolve_paths(config: Config, base: Path) -> Config:
    def resolve(p: Path) -> Path:
        return p if p.is_absolute() else base / p

    return replace(
        config,
        archive_dir=resolve(config.archive_dir),
        data_dir=resolve(config.data_dir),
        overrides_file=resolve(config.overrides_file),
    )


def load_overrides(path: Path) -> Overrides:
    if not path.exists():
        return Overrides()
    raw = read_toml(path)
    aliases_raw = raw.get("aliases", {})
    if not isinstance(aliases_raw, dict):
        raise ConfigError(f"{path}: 'aliases' must be a table")
    aliases = {
        str(name): tuple(_string_list(values, f"aliases.{name}", path))
        for name, values in aliases_raw.items()
    }
    unknown = set(raw) - {"include", "exclude", "former", "aliases"}
    if unknown:
        raise ConfigError(f"{path}: unknown keys {sorted(unknown)}")
    return Overrides(
        include=frozenset(_string_list(raw.get("include", []), "include", path)),
        exclude=frozenset(_string_list(raw.get("exclude", []), "exclude", path)),
        former=frozenset(_string_list(raw.get("former", []), "former", path)),
        aliases=aliases,
    )


def _string_list(value: Any, key: str, path: Path) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ConfigError(f"{path}: '{key}' must be a list of strings")
    return list(value)
