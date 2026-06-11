# Pipeline image — used by the Railway cron service (and any container host).
# run_weekly subprocesses `python -m serious_shift_pipeline.<step>`, so the
# package is installed into the image.
FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY serious_shift_pipeline ./serious_shift_pipeline
RUN pip install --no-cache-dir .
# raw_content + logs are written under the working dir (ephemeral per run — fine,
# since scrape → process run in the same invocation; watermarks live in the DB).
CMD ["python", "-m", "serious_shift_pipeline.run_weekly"]
