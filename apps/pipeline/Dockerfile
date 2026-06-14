# Pipeline image — used by the Railway cron service (and any container host).
#
# IMPORTANT: this Dockerfile is built from the REPO ROOT as context (not
# apps/pipeline), so it can bundle the shared database migrations from
# packages/db. On Railway set the pipeline service's Root Directory to the repo
# root and its Config Path to apps/pipeline/railway.json.
#
# run_weekly subprocesses `python -m serious_shift_pipeline.<step>` and applies
# the bundled migrations (at /app/migrations) on startup.
FROM python:3.13-slim
WORKDIR /app
COPY apps/pipeline/pyproject.toml ./
COPY apps/pipeline/serious_shift_pipeline ./serious_shift_pipeline
# Shared schema (dbmate-format) — applied idempotently at the start of each run.
COPY packages/db/migrations ./migrations
RUN pip install --no-cache-dir .
# raw_content + logs are written under the working dir (ephemeral per run — fine,
# since scrape → process run in the same invocation; watermarks live in the DB).
CMD ["python", "-m", "serious_shift_pipeline.run_weekly"]
