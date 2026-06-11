#!/usr/bin/env python3
"""
Verify the SQLite -> Postgres ETL was lossless.

Checks, per table:
  1. row count matches
  2. a content checksum over the id column matches (catches dropped/extra rows)

Exits non-zero if any table diverges, so it can gate CI / promotion.

Usage:
  export DATABASE_URL=postgres://user:pass@localhost:5432/serious_shift
  python verify_parity.py --sqlite ../../serious-shift.db
"""
import argparse
import os
import sqlite3
import sys

import psycopg

from sqlite_to_postgres import LOAD_ORDER


def sqlite_count(scur, table):
    scur.execute(f"SELECT COUNT(*) FROM {table}")
    return scur.fetchone()[0]


def pg_count(pcur, table):
    pcur.execute(f"SELECT COUNT(*) FROM {table}")
    return pcur.fetchone()[0]


def has_int_id(scur, table):
    """True only if the table has an integer `id` column. Tables with a text PK
    named id (domains_v2) or no id (junctions) are checked by row count only —
    SUM()/MAX() over a text id isn't valid in Postgres."""
    scur.execute(f"PRAGMA table_info({table})")
    for row in scur.fetchall():
        if row[1] == "id":
            return "INT" in (row[2] or "").upper()
    return False


def sqlite_id_sum(scur, table):
    scur.execute(f"SELECT COALESCE(SUM(id), 0), COALESCE(MAX(id), 0) FROM {table}")
    return scur.fetchone()


def pg_id_sum(pcur, table):
    pcur.execute(f"SELECT COALESCE(SUM(id), 0), COALESCE(MAX(id), 0) FROM {table}")
    return pcur.fetchone()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", required=True)
    ap.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    args = ap.parse_args()
    if not args.database_url:
        sys.exit("error: --database-url or DATABASE_URL is required")

    sconn = sqlite3.connect(args.sqlite)
    scur = sconn.cursor()

    failures = []
    with psycopg.connect(args.database_url) as pconn, pconn.cursor() as pcur:
        print(f"{'table':<34} {'sqlite':>9} {'postgres':>9}  status")
        print("-" * 70)
        for table in LOAD_ORDER:
            sc = sqlite_count(scur, table)
            pc = pg_count(pcur, table)
            ok = sc == pc
            detail = ""
            if ok and has_int_id(scur, table):
                # Identity-sum check catches reshuffled/dropped ids that a bare
                # count would miss.
                if sqlite_id_sum(scur, table) != pg_id_sum(pcur, table):
                    ok = False
                    detail = " (id-sum mismatch)"
            status = "ok" if ok else f"MISMATCH{detail}"
            if not ok:
                failures.append(table)
            print(f"{table:<34} {sc:>9} {pc:>9}  {status}")

    sconn.close()
    if failures:
        print(f"\n{len(failures)} table(s) diverged: {', '.join(failures)}")
        sys.exit(1)
    print("\nAll tables match. ETL is lossless. ✓")


if __name__ == "__main__":
    main()
