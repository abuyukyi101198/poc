# MAAS Delegate Design Notes

These notes record the algorithms and measured decisions behind the behavior in [`spec.md`](spec.md). Archive figures are from 2026-10-09.

## 1. Archive contract

The archive comes from [mattermost-retrieval](https://github.com/jurekh/mattermost-retrieval):

```text
mm-archive/<channel>/YYYY/MM/YYYY-MM-DD.md
```

Posts use this form:

```text
**[timestamp] [post_id] Display Name** *(reply to root_id)*: first line
continuation lines
```

Non-matching lines continue the previous post. Older files may omit `post_id`; the parser creates a stable ID from channel, timestamp, and sender. `state.json` belongs to the archiver and is ignored.

## 2. Corpus observations

The measured archive contained about 36,700 posts and 3,400 searchable conversations across the main, private, UI, regional, and Terraform channels.

Practical consequences:

- greetings, EODs, bot traffic, absence notices, and logistics must be filtered;
- team-only conversations are useful technical evidence but contain more chatter;
- explicit threads carry nearly all useful Q&A signal;
- the corpus is small enough for local lexical retrieval; downloaded embedding models are unnecessary.

## 3. Team detection

Team membership combines top-level EOD senders with activity in the configured team-only channel. Every regular EOD sender in the measured archive also appeared in the private channel; private-only participants account for manager, non-engineering, or new-joiner cases.

### 3.1 EOD detection

EOD matching accepts leading Markdown and variants such as `EOD`, `EOD, EOW`, `early EOD`, and `Last EOD`. Replies do not count. Farewell wording is ignored because activity is a more reliable signal.

### 3.2 Status evidence

For each canonical display name, the index stores recent EOD count, last EOD, private-channel post count, and last activity. Aliases are applied before these statistics are calculated.

### 3.3 Overrides

`team-overrides.toml` can force `current`, `former`, or `external` status and merge renamed display names. Overrides always win.

### 3.4 Status algorithm

```text
active = most recent EOD or team-channel post is within 30 days

if overridden:                         override status
elif at least 3 EODs in 180 days
     and active:                       current
elif prior EOD or team-channel posts:  candidate if active else former
else:                                  external
```

## 4. Conversation reconstruction and classification

Explicit replies are grouped globally by root ID, including threads that span day files. A substantive standalone post by a team member also becomes a conversation. Implicit top-level Q&A windows were tested and dropped because they mostly joined unrelated chatter.

Conversation kinds are `bug`, `help`, `feature`, `discussion`, and `other`. Only the first four provide expertise evidence. Deployment-specific vocabulary in `[patterns]` extends generic rules for chatter, bug links, review requests, bug IDs, and command names.

Noise filtering covers greetings, EODs, OOO and lateness messages, `/me` status lines, polls, scheduling, and cancelled meetings unless technical failure or code signals are present.

## 5. Attribution

Only team participants receive credit:

| Role | Weight | Rule |
|---|---:|---|
| resolver | 1.0 | Last substantive answer, preferably before an acknowledgement |
| contributor | 0.75 | Other substantive answer or knowledgeable thread author |
| author | 0.5 | Substantive standalone post |

A private-channel root author gets contributor credit unless the root is clearly a question. Review-request authors keep credit because they know the change.

Mention credit, commit-author mining, and username inference were removed: they added complexity without improving evaluation results. Automatically derived evaluation labels use the resolver rule above.

## 6. Retrieval and ranking

### 6.1 Terms

Text is lowercased; Markdown, emoji, mentions, and stop words are removed. Versions, paths, identifiers, bug IDs, and useful URL components are retained.

Plain alphabetic words receive light suffix stripping so related forms match: `image/images` become `imag`, and `upgrade/upgrading/upgraded` become `upgrad`. Domain tokens and words of four characters or fewer are unchanged. `who` displays these indexed forms.

### 6.2 BM25

BM25 is implemented over term-frequency tables in SQLite. The top 30 conversations are scored; no external model or service is used.

```text
similarity(q, c) = BM25(q, c) / best BM25 match
raw(member)      = sum(similarity × role weight × recency decay)
score(member)    = raw(member) / total eligible raw score
```

Recency has a 180-day half-life measured from the newest indexed post, which keeps results reproducible. Evidence uses each member's strongest matched conversations.

Confidence is low when the query has no indexed terms, has no matches, covers too little query weight, or has no eligible participants.

### 6.3 Sub-team results

The first three rows come from the overall ranking. Two additional rows use the strongest remaining members from configured sub-team channels. Their displayed scores and normal activity shares are relative to that channel. `--team` restricts these picks.

### 6.4 Activity context

`vs usual` is the query share divided by the member's normal recency-weighted activity share. It helps spot quiet specialists but does not affect ranking; ranking by this ratio performed worse.

## 7. Package and storage

```text
maas-delegate/
  src/maas_delegate/   Python package
  tests/               synthetic archive and CLI tests
  specs/               behavior and design notes
  mm-archive/          private input, gitignored
  .maas-delegate/      derived SQLite index, gitignored
```

`maas-delegate.toml` supplies paths, channels, bots, optional permalink settings, and deployment vocabulary. Relative paths resolve from the config file. The index is rebuilt into a temporary database and replaces the old database only after success.

The archive, index, config, overrides, labels, and evidence may contain private information and must remain local.

## 8. Evaluation summary

Evaluation uses time splits so a query cannot retrieve future conversations. Metrics are Top-1/3/5 and mean reciprocal rank, compared with a most-active responder baseline.

On 73 human-labelled conversations, the measured tool reached 31.5% Top-1, 56.2% Top-3, and 67.1% Top-5. The most-active baseline reached 24.7%, 37.0%, and 57.5%. Sub-team rows improved coverage on sub-team questions but reduced Top-5 on general channels; they are retained to expose specialists.

Sweeps over recency, retrieval depth, activity dampening, and attribution variants produced no consistent improvement across human and derived labels. The current constants favor a small, reviewable implementation.

A full measured rebuild took about 2.4 seconds for 36,694 posts; queries completed well below the two-second target.
