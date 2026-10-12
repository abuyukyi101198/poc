"""Index-level tests for standalone team posts and display-name aliases."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from maas_delegate import store
from maas_delegate.config import Config, Overrides
from maas_delegate.index import build_index
from maas_delegate.rank import Ranker

from .conftest import ArchiveBuilder, with_channels


def _archive(root: Path) -> Path:
    a = ArchiveBuilder(root)
    for i in range(5):
        day = (date(2026, 10, 1) + timedelta(days=i)).isoformat()
        a.add("maas", f"{day}T16:00:00Z", "Alice Anders", "EOD")
        a.add("maas", f"{day}T16:05:00Z", "Bob Brown", "EOD")
    a.add("maas-private", "2026-10-02T09:00:00Z", "Alice Anders", "lunch")
    a.add("maas-private", "2026-10-02T09:05:00Z", "Bob Brown", "lunch")
    a.add(
        "maas-private",
        "2026-10-03T09:00:00Z",
        "Bob Brown",
        "Heads up: the temporal workflow for image sync now retries on lease expiry, "
        "see the commissioning notes",
    )
    a.add(
        "maas-private",
        "2026-10-03T10:00:00Z",
        "Bob Brown",
        "I'm off tomorrow for a doctor appointment, back on Monday",
    )
    q = a.add(
        "maas", "2026-10-04T11:00:00Z", "Erin External", "IPMI power on fails with cipher suite 17"
    )
    a.add(
        "maas",
        "2026-10-04T11:10:00Z",
        "Alice A.",
        "Set the cipher suite to 3 in the power parameters, lanplus needs it on that BMC",
        root=q,
    )
    return a.write()


@pytest.fixture
def signals_config(tmp_path: Path) -> Config:
    return with_channels(
        _archive(tmp_path / "archive"), tmp_path / "data", tmp_path / "team-overrides.toml"
    )


def test_index_adds_standalone_posts_and_applies_aliases(signals_config: Config) -> None:
    build_index(signals_config, Overrides(aliases={"Alice Anders": ("Alice A.",)}))
    conn = store.open_existing(signals_config.db_path)
    roles = {
        (r["person"], r["role"]) for r in conn.execute("SELECT person, role FROM attributions")
    }
    assert roles == {("Bob Brown", "author"), ("Alice Anders", "resolver")}
    snippets = [r["snippet"] for r in conn.execute("SELECT snippet FROM conversations")]
    assert not any("doctor" in s for s in snippets)  # absence notice is not a conversation

    ranker = Ranker(conn)
    assert ranker.rank("ipmi lanplus cipher suite power failure").results[0].name == "Alice Anders"
    assert ranker.rank("temporal image sync lease expiry").results[0].name == "Bob Brown"
    conn.close()
