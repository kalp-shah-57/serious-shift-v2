-- migrate:up
-- Whole-document JSON blobs that aren't simple table dumps:
--   map     — assembled by the map generator from the domain_* tables
--   keynote — hand-edited for voice/style
--   daily   — generated daily briefing
-- The pipeline writes these; the backend serves them verbatim at /api/<key>.
-- This keeps the frontend's map.json / keynote.json / daily.json contracts
-- byte-identical without re-deriving them in SQL.
CREATE TABLE documents (
    key        TEXT PRIMARY KEY,        -- 'map' | 'keynote' | 'daily'
    body       JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- migrate:down
DROP TABLE IF EXISTS documents;
