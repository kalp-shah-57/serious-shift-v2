"""Server-free Postgres-SQL validation for the keynote generator's queries.
Drives query_section_evidence with a capturing fake db (exercising the
hard-exclude + penalty branches) and parses every emitted SQL as Postgres."""
import sqlglot

from serious_shift_pipeline.core import db
from serious_shift_pipeline.steps import generate_keynote as gk


class _Capture:
    def __init__(self):
        self.sqls = []

    def query(self, conn, sql, params=None):
        self.sqls.append(sql)
        return []

    def query_one(self, conn, sql, params=None):
        self.sqls.append(sql)
        return {"id": 1}


def test_section_queries_are_valid_postgres(monkeypatch):
    cap = _Capture()
    monkeypatch.setattr(db, "query", cap.query)
    monkeypatch.setattr(db, "query_one", cap.query_one)

    cfg = gk.SECTION_CONFIG[0]
    # First call: no usage history. Second call: usage counts hit both the
    # soft-penalty (count 1-2) and hard-exclude (count >= 3) branches.
    gk.query_section_evidence(object(), cfg)
    gk.query_section_evidence(object(), cfg,
                              claim_usage_count={101: 1, 202: 3},
                              pred_usage_count={"P010": 3})

    assert cap.sqls, "no SQL captured"
    for sql in cap.sqls:
        sqlglot.parse_one(sql, dialect="postgres")
        assert "?" not in sql
