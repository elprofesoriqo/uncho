"""
Bronze Ingestion — Humanitarian Response Plans (HRP) data.

Reads the HRP plan metadata CSV and loads into the Bronze layer.
HRP data tracks which crises have active response plans and their status.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


def ingest_hrp(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Ingest Humanitarian Response Plans data into Bronze layer.

    Returns:
        DataFrame of HRP records
    """
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting Humanitarian Response Plans (HRP)")
    logger.info("─" * 50)

    filepath = config.raw_dir / "humanitarian-response-plans.csv"

    if not filepath.exists():
        logger.warning(f"  ⚠ HRP file not found: {filepath}")
        return pd.DataFrame()

    logger.info(f"  Reading HRP: {filepath.name}")

    df = pd.read_csv(filepath, encoding="utf-8-sig", on_bad_lines="skip", low_memory=False)

    # Drop HXL rows
    if len(df) > 0:
        first_col = df.columns[0]
        hxl_mask = df[first_col].astype(str).str.startswith("#")
        if hxl_mask.any():
            logger.debug(f"  Dropping {hxl_mask.sum()} HXL header rows")
            df = df[~hxl_mask].reset_index(drop=True)

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Map common variations
    rename_map: dict[str, str] = {}
    for target, candidates in {
        "plan_id": ["planid", "plan_id", "id"],
        "plan_name": ["planname", "plan_name", "name"],
        "country": ["country", "countries", "location"],
        "iso3": ["iso3", "country_code", "countrycode", "locations"],
        "status": ["status", "planstatus", "plan_status", "state"],
        "year_start": ["startdate", "start_date", "year_start", "startyear"],
        "year_end": ["enddate", "end_date", "year_end", "endyear"],
        "requirements_usd": ["requirements", "requirements_(us$)", "revisedRequirements"],
        "funding_usd": ["funding", "funding_(us$)", "totalFunding"],
    }.items():
        for candidate in candidates:
            if candidate in df.columns:
                rename_map[candidate] = target
                break

    df = df.rename(columns=rename_map)

    # Convert numeric columns
    for col in ["requirements_usd", "funding_usd"]:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(",", ""), errors="coerce"
            )

    if "country" not in df.columns and "iso3" in df.columns:
        df["country"] = df["iso3"]

    if "status" not in df.columns:
        df["status"] = "Active"

    # Extract year from start date if year_start not present
    if "year_start" in df.columns:
        df["year_start"] = pd.to_numeric(
            df["year_start"].astype(str).str[:4], errors="coerce"
        )

    # Add metadata
    df["source_file"] = filepath.name

    # Write to Bronze
    table_name = config.bronze_table("hrp_raw")
    client.write_dataframe(df, table_name, mode="overwrite")

    logger.info(f"✓ Bronze HRP: {len(df)} plan records → {table_name}")
    return df
