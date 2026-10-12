# maas-delegate

Rank MAAS team members by their past involvement in similar Mattermost conversations. All processing is local.

## Archive

Use [mattermost-retrieval](https://github.com/jurekh/mattermost-retrieval) to create the archive, then place it in `mm-archive/` or set `archive_dir` in the config. Expected files are `<archive>/<channel>/YYYY/MM/YYYY-MM-DD.md`; this tool never modifies them.

## Quick start

```sh
uv sync
cp maas-delegate.example.toml maas-delegate.toml
# Edit maas-delegate.toml: set eod_channel, team_channel, and any sub_team_channels.
uv run maas-delegate index
uv run maas-delegate ask "PXE boot fails with DHCP timeout"
```

Paths in `maas-delegate.toml` are relative to that file. `team-overrides.toml` is optional; use it for membership overrides and display-name aliases.

## Commands

```sh
uv run maas-delegate index                       # rebuild the index after archive updates
uv run maas-delegate ask --explain "issue text" # rank members and show evidence
uv run maas-delegate ask --exclude "Your Name" - < bug.txt
uv run maas-delegate ask --team maas-ui "UI issue"
uv run maas-delegate team                        # show detected membership
uv run maas-delegate who "Firstname"             # show distinctive topics
uv run maas-delegate eval --labels labels.toml   # evaluate labelled threads
```

`ask` normally shows three overall results followed by two sub-team specialists. `--include-former` and `--include-candidates` widen the eligible members. Global `--archive` and `--data-dir` options go before the subcommand and override the config.

## Privacy

`mm-archive/`, `.maas-delegate/`, and evidence output may contain team-private messages. The local config, overrides, and labels may contain channel or member names. These paths are gitignored; do not commit or share them.

## Development

```sh
make test
make lint
make typecheck
```

See [`specs/spec.md`](specs/spec.md) for the behavior contract and [`specs/research.md`](specs/research.md) for design notes.
