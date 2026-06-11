# pipeline — ingestion & intelligence (Python, Postgres)

Scrapes AGI thinkers' sources, extracts structured claims/predictions via the
Anthropic API, scores them, and generates the trend map + keynote — all written
to **Postgres** (the backend then serves it). A scheduled batch service, not a
request server.

## Flow

```
scraper  → raw_content/*.txt              (fetch; append-only, per-source watermark)
process_raw → claims/sources/predictions  (Claude extraction)
scoring  → source_depth, freshness, claim_weight   (free, no API)
generate_map_data    → documents['map']      (Claude; served at /api/map)
generate_keynote     → documents['keynote']  (Claude; served at /api/keynote)
evaluate → prediction status + credibility scores
run_weekly orchestrates 1→2→2.5→(3,4); steps 3-4 are gated on new claims.
```

Other modules: `ingest` (ad-hoc single-URL), `deduplicate` (mark duplicate
claims), `status` (DB/health dashboard), `queries` (read queries; also the
backend's functional spec), `db`/`llm`/`observability`/`config` (shared).

## Configuration (env)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres |
| `ANTHROPIC_API_KEY` | for extraction/generation | scraper & scoring don't need it |
| `RAW_CONTENT_DIR` | no | default `./raw_content` |
| `SS_LOGS_DIR` | no | default `./logs` |

Run modules from the **repo root** (raw_content + logs are cwd-relative).

## Source manifest — `scrape_sources` table

What to scrape lives in the database (table `scrape_sources`), not a JSON file —
the scraper reads it via `load_thinker_sources()`. One row per source:

| Column | Notes |
|---|---|
| `thinker_id` | FK → `thinkers` |
| `platform` | `blog` · `substack` · `x` · `youtube` · `linkedin` · `podcast` · `manual` |
| `method` | `scrape_index` (crawl a blog index) · `rss` (feed) · `youtube` (channel transcripts) · `manual` (placeholder, not auto-fetched) |
| `url`, `rss`, `channel_url`, `handle`, `note` | per-method fields |

Add/edit sources with SQL, e.g.:
```sql
INSERT INTO scrape_sources (thinker_id, platform, method, rss)
SELECT id, 'substack', 'rss', 'https://example.substack.com/feed'
FROM thinkers WHERE name = 'Sam Altman';
```
The initial manifest is seeded by migration `0003`.

## Run locally

```bash
# Postgres + data first — see ../../packages/db/README.md
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL=postgres://serious:serious@localhost:5432/serious_shift
export ANTHROPIC_API_KEY=sk-...

pytest                                            # SQL-validation + unit + (DB-gated) integration
python -m serious_shift_pipeline.status           # health snapshot
python -m serious_shift_pipeline.run_weekly --dry-run   # plan, no changes
python -m serious_shift_pipeline.run_weekly             # full run (scrape→extract→score→map→keynote)

# individual steps
python -m serious_shift_pipeline.scraper --thinker "Ethan Mollick"
python -m serious_shift_pipeline.process_raw --thinker "Ethan Mollick"
python -m serious_shift_pipeline.scoring
python -m serious_shift_pipeline.ingest --url URL --thinker "Sam Altman"
python -m serious_shift_pipeline.deduplicate --execute [--use-api]
python -m serious_shift_pipeline.evaluate
```

Lint/type: `ruff check` · `mypy serious_shift_pipeline`. CI: `.github/workflows/pipeline.yml`.

## Scheduling (deploy)

`run_weekly` is a batch job — run it on a schedule (GitHub Actions cron, or a
Render/Fly scheduled job) with `DATABASE_URL` + `ANTHROPIC_API_KEY` in the
environment. A full refresh spends roughly $60–100 of Anthropic credits;
`run_weekly` cost-guards and gates the expensive map/keynote steps on new claims.
