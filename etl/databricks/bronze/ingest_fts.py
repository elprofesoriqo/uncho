"""
Bronze Ingestion — Financial Tracking Service (FTS) data.

Reads FTS requirements & funding CSVs (both global and cluster-level)
and loads them into the Bronze layer.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


def _read_fts_csv(filepath: Path, has_cluster: bool = False) -> pd.DataFrame:
    """Read and normalize an FTS CSV file.

    FTS files use HXL tags in the second row — we need to skip those.
    """
    logger.info(f"  Reading FTS: {filepath.name} (cluster={has_cluster})")

    df = pd.read_csv(filepath, encoding="utf-8-sig", on_bad_lines="skip", low_memory=False)

    # Drop HXL rows
    if len(df) > 0:
        first_col = df.columns[0]
        hxl_mask = df[first_col].astype(str).str.startswith("#")
        if hxl_mask.any():
            df = df[~hxl_mask].reset_index(drop=True)

    # Normalize column names (lowercase, strip whitespace)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Map common FTS column name variations
    rename_map: dict[str, str] = {}
    for target, candidates in {
        "iso3": ["countrycode", "iso3", "country_code", "iso"],
        "country": ["country", "countryname", "location"],
        "year": ["year", "plan_year"],
        "requirements_usd": ["requirements", "requirements_(us$)", "current_requirements", "original_requirements"],
        "funding_usd": ["funding", "funding_(us$)", "total_funding", "current_funding"],
        "coverage": ["percentfunded", "coverage", "coverage_%", "coverage_(%)"],
        "cluster": ["cluster", "sector", "cluster_name", "sector_name"],
        "plan_name": ["plan_name", "planname", "plan"],
    }.items():
        for candidate in candidates:
            if candidate in df.columns:
                rename_map[candidate] = target
                break

    df = df.rename(columns=rename_map)

    # Convert numeric columns
    for col in ["requirements_usd", "funding_usd", "year"]:
        if col in df.columns:
            # Remove commas
            df[col] = df[col].astype(str).str.replace(",", "")
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop/recalculate percentfunded/coverage
    if "coverage" in df.columns:
        df = df.drop(columns=["coverage"])
    if "requirements_usd" in df.columns and "funding_usd" in df.columns:
        df["coverage"] = df["funding_usd"] / df["requirements_usd"]
        df["coverage"] = df["coverage"].replace([float("inf"), -float("inf")], 0).fillna(0)

    # Add metadata
    df["source_file"] = filepath.name

    # Ensure essential columns exist
    if "iso3" in df.columns and "country" not in df.columns:
        df["country"] = df["iso3"]

    if "country" not in df.columns:
        df["country"] = "Unknown"

    logger.info(f"  ✓ FTS: {len(df)} records from {filepath.name}")
    return df


def ingest_fts(client: DatabricksClient, config: DatabricksConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Ingest FTS requirements & funding data into Bronze layer.

    Loads both global (country-level) and cluster-level (sector) data.

    Returns:
        Tuple of (global_df, cluster_df)
    """
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting Financial Tracking Service (FTS)")
    logger.info("─" * 50)

    global_df = pd.DataFrame()
    cluster_df = pd.DataFrame()

    # Global (country-level) data
    global_path = config.raw_dir / "fts_requirements_funding_global.csv"
    if global_path.exists():
        try:
            global_df = _read_fts_csv(global_path, has_cluster=False)
            table_name = config.bronze_table("fts_global_raw")
            client.write_dataframe(global_df, table_name, mode="overwrite")
            logger.info(f"✓ Bronze FTS Global: {len(global_df)} records → {table_name}")
        except Exception as e:
            logger.error(f"  ✗ Failed to read FTS Global: {e}")
    else:
        logger.warning(f"  ⚠ FTS Global file not found: {global_path}")

    # Cluster-level (sector) data — THE GOLDMINE
    cluster_path = config.raw_dir / "fts_requirements_funding_cluster_global.csv"
    if cluster_path.exists():
        try:
            cluster_df = _read_fts_csv(cluster_path, has_cluster=True)
            table_name = config.bronze_table("fts_cluster_raw")
            client.write_dataframe(cluster_df, table_name, mode="overwrite")
            logger.info(f"✓ Bronze FTS Cluster: {len(cluster_df)} records → {table_name}")
        except Exception as e:
            logger.error(f"  ✗ Failed to read FTS Cluster: {e}")
    else:
        logger.warning(f"  ⚠ FTS Cluster file not found: {cluster_path}")

    return global_df, cluster_df
