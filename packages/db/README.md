# db — Postgres schema, migrations, ETL

Postgres is the **single source of truth** for all data. This package owns the
schema, its migrations, and the one-off import from the legacy SQLite database.
Neither app owns the schema via an ORM — both the Python **pipeline** (writer)
and the Rust **backend** (reader) depend on the migrations here.

```
migrations/   SQL migrations (dbmate, forward-only)
  0001_initial_schema.sql                  core schema
  0002_documents.sql                       documents blob table
  0003_thinker_images_and_scrape_sources.sql  thinker images/bios + scrape manifest
etl/
  sqlite_to_postgres.py   one-off import from legacy serious-shift.db
  verify_parity.py        proves the import was lossless
docker-compose.yml        local Postgres 16
```

## Migrations — dbmate

A single static binary, so Rust and Python agree on schema without either's
migration framework. Files use `-- migrate:up` / `-- migrate:down`.

```bash
brew install dbmate
export DATABASE_URL='postgres://serious:serious@localhost:5432/serious_shift?sslmode=disable'
export DBMATE_MIGRATIONS_DIR=./migrations
dbmate up        # apply   ·   dbmate status   ·   dbmate rollback
```

## Local setup + one-off import

```bash
docker compose up -d
dbmate up
pip install "psycopg[binary]"
python etl/sqlite_to_postgres.py --sqlite ../../serious-shift.db --truncate
python etl/verify_parity.py     --sqlite ../../serious-shift.db   # "lossless ✓"
```

The ETL normalizes SQLite's dirty data (mixed-type dates → valid dates or NULL)
and bumps identity sequences; `--truncate` makes re-runs idempotent. After
import, the `documents` (map/keynote/daily) and per-thinker images/scrape manifest
are populated by migration `0003` and the pipeline generators — there are **no
JSON files**; everything lives in the database.

## Tables

Source of truth for all application data. (`schema_migrations` is dbmate's own
bookkeeping table and isn't listed.)

### Core entities
| Table | Purpose |
|---|---|
| `thinkers` | one row per thinker — name, affiliation, credibility/accuracy/outlier scores, bio, `image_url` |
| `sources` | articles/talks/podcasts/papers ⋈ thinker; title, date, url, full_text, signal/novelty/depth |
| `claims` | atomic extracted claims ⋈ source+thinker; domain, signal_strength, specificity, `claim_weight`, `freshness_score`, `duplicate_of` |
| `predictions` | falsifiable predictions ⋈ claim+thinker+source; status, consensus_alignment, evaluation_date |
| `concepts` | cross-thinker concepts (keynote relevance) |
| `tensions` | mapped disagreements (side_a vs side_b, consumer implications) |

### Tagging & relationships (junctions)
| Table | Links |
|---|---|
| `tags`, `source_tags`, `claim_tags` | free-text tags ↔ sources/claims |
| `claim_concepts` | claims ↔ concepts |
| `claim_tensions` | claims ↔ tensions (side A/B/nuanced) |
| `concept_thinkers` | concepts ↔ thinkers (stance) |
| `tension_thinkers` | tensions ↔ thinkers (side, stance) |
| `thinker_disagreements` | thinker ↔ thinker (topic) |

### Keynote
| Table | Purpose |
|---|---|
| `keynote_sections` | keynote section structure/content |
| `section_claims` | sections ↔ claims (primary/supporting/contrarian) |

### Trend map — domain-first v2 (canonical)
| Table | Purpose |
|---|---|
| `domains_v2` | 4 strategic domains |
| `domain_scenarios` | scenarios per domain |
| `domain_key_trends` | key trends per scenario |
| `domain_sub_trends` | sub-trends per key trend |
| `domain_sub_trend_claims` | sub-trends ↔ claims |
| `domain_synthesis_insights` | synthesis insights per domain |
| `domain_synthesis_insight_claims` | insights ↔ claims |
| `domain_links` | typed edges between map nodes |
| `domain_flows` | domain → domain directional influence |

### Trend map — legacy v1 (retained for parity, not actively written)
`sub_trends`, `sub_trend_claims`, `macro_scenarios`, `macro_key_links`,
`key_trend_meta`, `synthesis_insights`, `synthesis_insight_claims`, `scenario_links`.

### Pipeline operational
| Table | Purpose |
|---|---|
| `scrape_sources` | the scrape manifest — per-thinker sources (platform, method, url/rss/channel) the scraper reads (was `scraper_config.json`) |
| `source_state` | per-source scrape watermark (last_item_date, last_run_status) |

### Documents
| Table | Purpose |
|---|---|
| `documents` | whole-JSON blobs keyed `map` / `keynote` / `daily`, served by the backend at `/api/<key>`. Written by the pipeline generators (`generate_map_data`, `generate_keynote`). |

## Deploy a free Postgres — Neon

1. Create a project at neon.tech → copy the `postgres://…?sslmode=require` string.
2. Apply schema + load data against it:
   ```bash
   export DATABASE_URL='postgres://…neon…?sslmode=require'
   DBMATE_MIGRATIONS_DIR=./migrations dbmate up
   python etl/sqlite_to_postgres.py --sqlite ../../serious-shift.db --truncate
   python etl/verify_parity.py     --sqlite ../../serious-shift.db
   ```
3. Populate `documents` by running the pipeline generators
   (`python -m serious_shift_pipeline.generate_map_data --export-only` rebuilds
   `documents['map']` from existing rows with no API cost; `generate_keynote`
   rebuilds the keynote). Use the same `DATABASE_URL` for the backend and pipeline.

Use a separate Neon branch/project per environment; supply `DATABASE_URL` via the
platform secret store. The local `serious-shift.db` is the import source only —
archive it to object storage and keep it out of git once Neon is authoritative.
