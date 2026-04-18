"""
Silver Layer — Composite Severity Index.

Builds a per-crisis severity score that combines INFORM severity with
other available signals (ACLED conflict events, IPC food security).

For now, this primarily normalizes INFORM data. As additional data sources
are integrated (ACLED, IPC), they are fused here into a composite signal.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


def build_severity_index(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Build the Silver severity_index table.

    Normalizes INFORM severity data and prepares it for joining
    into the Gold crisis_index.

    Returns:
        DataFrame with iso3, year, inform_severity
    """
    logger.info("─" * 50)
    logger.info("SILVER: Building composite severity index")
    logger.info("─" * 50)

    inform_table = config.bronze_table("inform_severity_raw")

    if not client.table_exists(inform_table):
        logger.warning(
            "  ⚠ No INFORM data available. Severity index will use defaults. "
            "Pipeline continues — scores will be computed without external severity signal."
        )
        return pd.DataFrame(columns=["iso3", "year", "inform_severity"])

    df = client.query(f"SELECT * FROM {inform_table}")
    logger.info(f"  Loaded {len(df)} INFORM records")

    # Ensure required columns
    if "iso3" not in df.columns or "inform_severity" not in df.columns:
        logger.warning("  ⚠ INFORM data missing required columns (iso3, inform_severity)")
        return pd.DataFrame(columns=["iso3", "year", "inform_severity"])

    # Clean
    df["iso3"] = df["iso3"].astype(str).str.strip().str.upper()
    df["inform_severity"] = pd.to_numeric(df["inform_severity"], errors="coerce")
    df = df.dropna(subset=["iso3", "inform_severity"])

    if "year" not in df.columns:
        from datetime import datetime
        df["year"] = datetime.now().year

    df["year"] = pd.to_numeric(df["year"], errors="coerce").astype(int)

    # Select and deduplicate
    result = df[["iso3", "year", "inform_severity"]].drop_duplicates(
        subset=["iso3", "year"], keep="first"
    )

    # Write to Silver
    table_name = config.silver_table("severity_index")
    client.write_dataframe(result, table_name, mode="overwrite")

    logger.info(f"✓ Silver Severity Index: {len(result)} records → {table_name}")
    logger.info(f"  Severity range: {result['inform_severity'].min():.1f} – {result['inform_severity'].max():.1f}")

    return result
