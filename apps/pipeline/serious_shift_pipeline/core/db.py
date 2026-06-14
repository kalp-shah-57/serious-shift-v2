"""
Postgres data-access adapter for the pipeline.

The pipeline is Postgres-first: local dev runs against the Docker Postgres in
packages/db (`docker compose up -d`), matching staging/prod. There is no SQLite
fallback — one dialect keeps the code maintainable.

All modules go through these helpers instead of opening their own connections,
so connection handling, row shape (dict rows), and the psycopg `%s` paramstyle
are consistent everywhere.
"""
from __future__ import annotations

import datetime
import os
import re
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row


def normalize_date(value):
    """Coerce a date-ish value to a Postgres-castable 'YYYY-MM-DD', or None.

    Models (and legacy data) return year-only ('2027'), partial dates, or
    malformed ones ('2001-00-00', '2026-02-30'). We parse leniently
    (missing/zero/out-of-range month or day fall back to 1) and validate
    against the real calendar, returning None if unsalvageable.
    """
    if value is None:
        return None
    s = str(value).strip()
    m = re.match(r"(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?", s)
    if not m:
        return None
    year = int(m.group(1))
    month = int(m.group(2)) if m.group(2) else 1
    day = int(m.group(3)) if m.group(3) else 1
    if not 1 <= month <= 12:
        month = 1
    if not 1 <= day <= 31:
        day = 1
    for d in (day, 1):  # e.g. Feb 30 -> fall back to the 1st
        try:
            return datetime.date(year, month, d).isoformat()
        except ValueError:
            continue
    return None


# Connection-string env vars we accept, in priority order. Railway's Postgres
# plugin exposes DATABASE_URL on the database service, but other services see it
# only if referenced (`${{Postgres.DATABASE_URL}}`); the private/public/`POSTGRES_*`
# variants are common alternatives, so we accept any of them.
_DSN_ENV_VARS = (
    "DATABASE_URL",
    "DATABASE_PRIVATE_URL",
    "DATABASE_PUBLIC_URL",
    "POSTGRES_URL",
    "POSTGRESQL_URL",
)


def get_dsn() -> str:
    for name in _DSN_ENV_VARS:
        dsn = os.environ.get(name)
        if dsn:
            return dsn
    # List the DB-ish env var NAMES present (never values) so a misnamed or
    # wrong-service variable is obvious from the logs.
    present = sorted(
        k for k in os.environ
        if any(tok in k.upper() for tok in ("DATABASE", "POSTGRES", "PG"))
    )
    raise RuntimeError(
        "No database connection string found in the environment (looked for "
        f"{', '.join(_DSN_ENV_VARS)}). "
        "On Railway: set this on THIS service — e.g. DATABASE_URL = "
        "${{Postgres.DATABASE_URL}} (the source service must be named 'Postgres') "
        "— then redeploy so the running deployment picks it up. "
        f"DB-related env vars currently visible: {present or 'none'}. "
        "Locally: `cd packages/db && docker compose up -d` and export DATABASE_URL."
    )


def raw_connect():
    """A plain dict-row connection (caller manages commit/close). Use for
    long-running loops that commit incrementally (e.g. the scraper)."""
    return psycopg.connect(get_dsn(), row_factory=dict_row)


@contextmanager
def connect():
    """Yield a dict-row connection, committing on success and closing always."""
    conn = psycopg.connect(get_dsn(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query(conn, sql: str, params: tuple | list | None = None) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def query_one(conn, sql: str, params: tuple | list | None = None) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()


def execute(conn, sql: str, params: tuple | list | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())


def insert_returning_id(conn, sql: str, params: tuple | list | None = None) -> int:
    """Run an INSERT … RETURNING id and return the new id.

    Replacement for SQLite's cursor.lastrowid — the INSERT must end with
    `RETURNING id`.
    """
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return row["id"]


def table_columns(conn, table: str) -> list[str]:
    """Column names for a table — replacement for `PRAGMA table_info(t)`."""
    rows = query(
        conn,
        """SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = %s
           ORDER BY ordinal_position""",
        (table,),
    )
    return [r["column_name"] for r in rows]
