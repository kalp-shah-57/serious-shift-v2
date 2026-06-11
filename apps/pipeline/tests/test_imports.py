"""Import-smoke test: every module imports cleanly (catches syntax/name errors).
The Anthropic SDK is imported lazily, so even the LLM-backed modules import
without it installed."""


def test_all_modules_import():
    import serious_shift_pipeline.config  # noqa: F401
    import serious_shift_pipeline.db  # noqa: F401
    import serious_shift_pipeline.queries  # noqa: F401
    import serious_shift_pipeline.evaluate  # noqa: F401
    import serious_shift_pipeline.observability  # noqa: F401
    import serious_shift_pipeline.scraper  # noqa: F401
    import serious_shift_pipeline.llm  # noqa: F401
    import serious_shift_pipeline.process_raw  # noqa: F401
    import serious_shift_pipeline.generate_keynote  # noqa: F401
    import serious_shift_pipeline.generate_map_data  # noqa: F401
    import serious_shift_pipeline.deduplicate  # noqa: F401
    import serious_shift_pipeline.run_weekly  # noqa: F401
    import serious_shift_pipeline.ingest  # noqa: F401
    import serious_shift_pipeline.status  # noqa: F401
    import serious_shift_pipeline.scoring  # noqa: F401
