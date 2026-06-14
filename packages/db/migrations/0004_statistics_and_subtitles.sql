-- migrate:up
-- Content Logic (June 2026) additive fields:
--   claims.has_statistic / statistic  — flag + extract dated, attributable numbers
--   domain_key_trends.hero_stat        — the one surfaced hero statistic per Key Trend (JSON)
--   domain_sub_trends.subtitle         — mandatory subtitle (name carries curiosity, subtitle the meaning)
-- All additive: existing columns and the map-document shape are unchanged.
ALTER TABLE claims            ADD COLUMN has_statistic BOOLEAN DEFAULT FALSE;
ALTER TABLE claims            ADD COLUMN statistic     TEXT;
ALTER TABLE domain_key_trends ADD COLUMN hero_stat     JSONB;
ALTER TABLE domain_sub_trends ADD COLUMN subtitle      TEXT;

-- migrate:down
ALTER TABLE domain_sub_trends DROP COLUMN IF EXISTS subtitle;
ALTER TABLE domain_key_trends DROP COLUMN IF EXISTS hero_stat;
ALTER TABLE claims            DROP COLUMN IF EXISTS statistic;
ALTER TABLE claims            DROP COLUMN IF EXISTS has_statistic;
