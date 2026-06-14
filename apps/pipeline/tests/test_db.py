"""Unit tests for db helpers that don't need a database."""
import pytest

from serious_shift_pipeline.core import db
from serious_shift_pipeline.core.db import normalize_date


def test_normalize_date():
    assert normalize_date(2027) == "2027-01-01"        # bare year int (the runtime risk)
    assert normalize_date("2027") == "2027-01-01"       # year-only string
    assert normalize_date("2026-05") == "2026-05-01"    # year-month
    assert normalize_date("2026-05-12") == "2026-05-12"  # full date
    assert normalize_date("2026-01-06T12:00:00") == "2026-01-06"  # datetime -> date
    assert normalize_date("2001-00-00") == "2001-01-01"  # zero month/day -> Jan 1
    assert normalize_date("2026-02-30") == "2026-02-01"  # impossible day -> 1st of month
    assert normalize_date("2026-13-05") == "2026-01-05"  # out-of-range month -> Jan
    assert normalize_date("") is None
    assert normalize_date("   ") is None
    assert normalize_date(None) is None
    assert normalize_date("by next year") is None       # garbage -> NULL, not a crash


def _clear_dsn_env(monkeypatch):
    for name in db._DSN_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def test_get_dsn_prefers_database_url(monkeypatch):
    _clear_dsn_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL", "postgres://primary/db")
    monkeypatch.setenv("DATABASE_PRIVATE_URL", "postgres://fallback/db")
    assert db.get_dsn() == "postgres://primary/db"


def test_get_dsn_accepts_railway_alternatives(monkeypatch):
    _clear_dsn_env(monkeypatch)
    monkeypatch.setenv("DATABASE_PRIVATE_URL", "postgres://private/db")
    assert db.get_dsn() == "postgres://private/db"


def test_get_dsn_error_lists_present_db_vars(monkeypatch):
    _clear_dsn_env(monkeypatch)
    monkeypatch.setenv("PGHOST", "shouldnotleakvalue")
    with pytest.raises(RuntimeError) as exc:
        db.get_dsn()
    msg = str(exc.value)
    assert "PGHOST" in msg                 # names are surfaced for diagnosis
    assert "shouldnotleakvalue" not in msg  # values are never printed
