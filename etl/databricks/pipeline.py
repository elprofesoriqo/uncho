"""
Pipeline Orchestrator — Runs the full Bronze → Silver → Gold ETL pipeline.

Usage:
    uv run python -m etl.databricks.pipeline --full      # Download + full pipeline
    uv run python -m etl.databricks.pipeline --init       # Initialize schemas only
    uv run python -m etl.databricks.pipeline --stage bronze  # Run single stage
    uv run python -m etl.databricks.pipeline --stage silver
    uv run python -m etl.databricks.pipeline --stage gold
    uv run python -m etl.databricks.pipeline --download   # Download data only
    uv run python -m etl.databricks.pipeline --validate   # Print top-10 ranking
"""

from __future__ import annotations

import sys
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import time
from datetime import datetime

import typer
from loguru import logger

from etl.databricks.bronze import ingest_cbpf, ingest_fts, ingest_hno, ingest_hrp, ingest_inform, ingest_reliefweb
from etl.databricks.bronze.downloader import HDXDownloader
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.gold import (
    build_crisis_index,
    compute_confidence_scores,
    compute_donor_concentration,
    compute_mismatch_scores,
    compute_structural_profiles,
    compute_visibility_scores,
)
from etl.databricks.silver import (
    build_severity_index,
    normalize_countries,
    normalize_funding,
    normalize_needs,
)

# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | {message}",
    level="INFO",
)
logger.add(
    "data/pipeline.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<7} | {message}",
    rotation="10 MB",
    level="DEBUG",
)


app = typer.Typer(
    name="lighthouse-pipeline",
    help="Lighthouse OS — Humanitarian Data Pipeline (Bronze → Silver → Gold)",
)


def _run_download(config: DatabricksConfig, force: bool = False) -> None:
    """Download all datasets from HDX."""
    with HDXDownloader(config) as downloader:
        downloader.download_all(force=force)


def _run_bronze(client: DatabricksClient, config: DatabricksConfig) -> None:
    """Run all Bronze layer ingestion."""
    logger.info("BRONZE LAYER — Raw Data Ingestion")

    ingest_hno(client, config)
    ingest_fts(client, config)
    ingest_inform(client, config)
    ingest_cbpf(client, config)
    ingest_reliefweb(client, config)

    # TODO: Add ingestion for the following sources when ready/accessible:
    # - bronze.acled_events (https://acleddata.com/platform/explorer)
    # - bronze.ipc_phases (inaccessible without API keys)
    # - bronze.reliefweb_parsed (https://apidoc.reliefweb.int/endpoints - MCP AGENT ENRICHMENT LAYER, JACEK HAS API KEY)
    # - bronze.news_sentiment (Vertex AI visibility/sentiment scores)


def _run_silver(client: DatabricksClient, config: DatabricksConfig) -> None:
    """Run all Silver layer normalization."""
    logger.info("SILVER LAYER — Normalization & Joins")

    normalize_countries(client, config)
    normalize_funding(client, config)
    normalize_needs(client, config)
    build_severity_index(client, config)


def _run_gold(client: DatabricksClient, config: DatabricksConfig) -> None:
    """Run all Gold layer computation."""
    logger.info("GOLD LAYER — Analytics & Scoring")

    build_crisis_index(client, config)
    compute_visibility_scores(client, config)
    compute_confidence_scores(client, config)
    compute_structural_profiles(client, config)
    compute_mismatch_scores(client, config)
    compute_donor_concentration(client, config)


def _run_validate(client: DatabricksClient, config: DatabricksConfig) -> None:
    """Validate the pipeline output by printing the top-ranked crises."""
    logger.info("VALIDATION — Top Overlooked Crises")

    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        logger.error(f"Crisis index not found: {table_name}. Run --full first.")
        return

    df = client.query(f"SELECT * FROM {table_name}")
    scored = df[df["mismatch_score"].astype(float) > 0].copy()
    scored["mismatch_score"] = scored["mismatch_score"].astype(float)
    scored = scored.sort_values("mismatch_score", ascending=False).head(20)

    logger.info(f"Total records: {len(df)}")
    logger.info(f"Scored records: {len(scored)}")
    logger.info("")
    logger.info(f"{'Rank':<6} {'Country':<8} {'Sector':<28} {'Score':>8} {'Coverage':>10} {'Type':<12} {'Conf':<6}")
    logger.info("─" * 85)

    for i, (_, row) in enumerate(scored.iterrows(), 1):
        logger.info(
            f"#{i:<5} {row['iso3']:<8} {str(row['sector'])[:27]:<28} "
            f"{float(row['mismatch_score']):>8.3f} "
            f"{float(row['coverage_ratio']):>9.1%} "
            f"{str(row['crisis_type']):<12} "
            f"{str(row.get('confidence_level', 'N/A')):<6}"
        )


@app.command()
def main(
    full: bool = typer.Option(False, "--full", help="Run full pipeline: download + bronze + silver + gold"),
    init: bool = typer.Option(False, "--init", help="Initialize database schemas only"),
    download: bool = typer.Option(False, "--download", help="Download data from HDX only"),
    stage: str = typer.Option("", "--stage", help="Run a specific stage: bronze, silver, gold"),
    validate: bool = typer.Option(False, "--validate", help="Print top-ranked crises for validation"),
    force_download: bool = typer.Option(False, "--force-download", help="Force re-download even if cached"),
) -> None:
    """Lighthouse OS — Humanitarian Data Pipeline

    Runs the medallion ETL pipeline: Download → Bronze → Silver → Gold.
    """
    start_time = time.time()

    logger.info("LIGHTHOUSE OS — Data Pipeline Started")

    config = DatabricksConfig()
    config.log_config()

    with DatabricksClient(config) as client:
        if init:
            client.initialize_schemas()
            logger.info("✓ Schemas initialized. Ready for data ingestion.")
            return

        if download:
            _run_download(config, force=force_download)
            return

        if full:
            client.initialize_schemas()
            _run_download(config, force=force_download)
            _run_bronze(client, config)
            _run_silver(client, config)
            _run_gold(client, config)
            _run_validate(client, config)

        elif stage:
            stage_lower = stage.lower()
            if stage_lower == "bronze":
                _run_bronze(client, config)
            elif stage_lower == "silver":
                _run_silver(client, config)
            elif stage_lower == "gold":
                _run_gold(client, config)
            else:
                logger.error(f"Unknown stage: {stage}. Use: bronze, silver, gold")
                raise typer.Exit(code=1)

        elif validate:
            _run_validate(client, config)

        else:
            logger.info("No action specified. Use --help to see options.")
            logger.info("  Quick start: uv run python -m etl.databricks.pipeline --full")

    elapsed = time.time() - start_time
    logger.info("")
    logger.info(f"Pipeline completed in {elapsed:.1f} seconds")


if __name__ == "__main__":
    app()
