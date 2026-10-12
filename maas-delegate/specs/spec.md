# MAAS Delegate Specification

## Purpose

Given a free-text issue, rank current MAAS team members by their involvement in similar Mattermost conversations and show the evidence behind each result.

The input archive is produced by [mattermost-retrieval](https://github.com/jurekh/mattermost-retrieval). This package reads only its Markdown format (`<archive>/<channel>/YYYY/MM/YYYY-MM-DD.md`) and does not depend on the archiver's code.

## Behavior

### Indexing

- `index` reads the configured EOD, team, and sub-team channels.
- Each run rebuilds the SQLite index and replaces the previous index only after success.
- Posts are parsed into ID, channel, timestamp, sender, optional thread root, and text. Non-header continuation lines belong to the previous post.
- Explicit threads and substantive standalone team posts become conversations.
- Bots, `System`, greetings, EODs, absence notices, and team logistics do not contribute expertise.
- Conversations are classified as `bug`, `help`, `feature`, `discussion`, or `other`; `other` is not searchable evidence.

### Team detection

Membership combines top-level EOD posts with activity in the configured team-only channel:

- `current`: at least three EODs in the 180-day lookback and activity within 30 days;
- `candidate`: recent team-channel activity without regular EODs;
- `former`: prior team evidence but no recent activity;
- `external`: no team evidence or explicitly excluded.

`team-overrides.toml` can include, exclude, mark former members, and merge display-name aliases. Overrides take precedence. Farewell wording is not a membership signal.

### Attribution and ranking

Each team participant receives at most one role per conversation:

- `resolver` (1.0): likely final substantive answer;
- `contributor` (0.75): another substantive participant or knowledgeable thread author;
- `author` (0.5): author of a substantive standalone post.

BM25 retrieves similar conversations. Member scores combine similarity, attribution, and a 180-day recency decay, then normalize across eligible members. Current members are eligible by default; flags can include candidates or former members.

Each result can show up to three supporting conversations. Low-confidence output must identify missing terms, matches, or eligible evidence rather than presenting a confident ranking.

### Sub-teams

`ask` normally returns three overall results followed by the two strongest remaining specialists from configured sub-team channels. Sub-team rows show their channel and use scores relative to that channel. `--team <channel>` restricts specialist picks; if none match, the overall ranking continues.

The displayed `vs usual` value compares a member's query share with their normal activity share. It is informational and does not affect ranking.

## CLI

- `index`: rebuild the index;
- `ask <text>`: rank members, with optional evidence and exclusions;
- `team`: show detected membership and signals;
- `who <name>`: show distinctive indexed terms;
- `eval`: report Top-1/3/5 and MRR against labels or derived resolvers.

Global `--archive` and `--data-dir` options override config paths. Missing archives, required channels, indexes, or invalid configuration must produce a clear error and a non-zero exit status.

## Configuration

`maas-delegate.toml` defines paths, channels, bots, permalink settings, and optional team vocabulary. `eod_channel` and `team_channel` are required for indexing. `sub_team_channels` are retrieval-only.

All processing is local. No archive content or model input may be sent to third parties, and no external model weights are used.

## Privacy

The archive, index, labels, and evidence may contain team-private content. `mm-archive/`, `.maas-delegate/`, `maas-delegate.toml`, `team-overrides.toml`, and `labels.toml` must remain local and gitignored.

## Acceptance criteria

- Team detection matches the current roster, with at most two manual overrides.
- Time-split Top-3 accuracy on at least 50 labelled conversations is at least 60% and exceeds the most-active baseline.
- `ask` completes in under two seconds after indexing.
- A full index of roughly 30,000 posts completes in under one minute.
- The archive remains unchanged by every command.

See [`research.md`](research.md) for algorithms, rationale, and measured trade-offs.
