"""
Apply pending database migrations at pipeline startup.

The schema is owned by `packages/db` (dbmate). In a container the migrations
directory is bundled into the image at `/app/migrations`; for local runs it is
read from `packages/db/migrations` in the repo. This applier is **dbmate
compatible** — it uses the same `schema_migrations` table and the same version
scheme (the leading digits of the filename) — so a manual `dbmate up` and this
runner can be used interchangeably and idempotently against the same database.

Why the pipeline applies migrations: the weekly cron is the system's primary
writer and runs unattended. Without this, a database that never had `dbmate up`
run against it fails on the very first query (`relation "claims" does not
exist`). Bootstrapping here makes the cron self-sufficient.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import psycopg

from . import db

# Where to look for *.sql migrations, in priority order. SS_MIGRATIONS_DIR wins;
# then the in-image bundle (/app/migrations); then the repo checkout (local dev).
_REPO_MIGRATIONS = Path(__file__).resolve().parents[4] / "packages" / "db" / "migrations"
_CANDIDATES = (
    os.environ.get("SS_MIGRATIONS_DIR"),
    "/app/migrations",
    str(_REPO_MIGRATIONS),
)


def _migrations_dir() -> str | None:
    for c in _CANDIDATES:
        if c and os.path.isdir(c):
            return c
    return None


def _version(filename: str) -> str:
    """dbmate version = the leading digits of the filename (e.g. 0001_x.sql → 0001)."""
    m = re.match(r"(\d+)", os.path.basename(filename))
    return m.group(1) if m else os.path.basename(filename)


def _up_sql(text: str) -> str:
    """Extract the `-- migrate:up` … `-- migrate:down` section of a dbmate file."""
    up = text.split("-- migrate:down", 1)[0]
    up = re.sub(r"(?m)^\s*--\s*migrate:up.*$", "", up, count=1)
    return up.strip()


def apply_pending(verbose: bool = True) -> int:
    """Apply every migration not yet recorded in schema_migrations. Returns the
    number applied. No-op (with a note) if no migrations directory is found."""
    mdir = _migrations_dir()
    if not mdir:
        if verbose:
            print("  migrate: no migrations directory found — assuming the schema "
                  "is managed externally; skipping.")
        return 0

    files = sorted(f for f in os.listdir(mdir) if f.endswith(".sql"))
    applied = 0
    # autocommit so the bookkeeping DDL/SELECT run outside a transaction and each
    # migration gets its own explicit transaction (atomic per file).
    with psycopg.connect(db.get_dsn(), autocommit=True) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version varchar(255) NOT NULL, PRIMARY KEY (version))"
        )
        done = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}

        for f in files:
            version = _version(f)
            if version in done:
                continue
            sql = _up_sql(Path(mdir, f).read_text())
            if not sql:
                continue
            # Multi-statement SQL with no parameters runs via the simple query
            # protocol; the version insert is a separate parameterised statement.
            with conn.transaction():
                conn.execute(sql)
                conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
            applied += 1
            if verbose:
                print(f"  migrate: applied {f}")

    if verbose:
        msg = f"{applied} applied" if applied else "already up to date"
        print(f"  migrate: schema {msg} ({len(files)} migrations total).")
    return applied
