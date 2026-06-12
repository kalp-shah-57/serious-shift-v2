"""Unit tests for db helpers that don't need a database."""
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
