"""
Bronze Ingestion — INFORM Severity Index data.

The INFORM Severity Index is an independent crisis severity measure (0-10 scale)
published by the EU Joint Research Centre. It provides an external validation
signal for our gap scoring — we don't want to only rely on self-reported HNO data.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


def ingest_inform(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Ingest INFORM Severity Index data into Bronze layer.

    The INFORM file format varies by year. We handle common variations.

    Returns:
        DataFrame of INFORM severity records
    """
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting INFORM Severity Index")
    logger.info("─" * 50)

    filepath = config.raw_dir / "inform_severity.xlsx"

    if not filepath.exists():
        logger.warning(
            f"  ⚠ INFORM file not found: {filepath}. "
            f"INFORM severity scores will be unavailable — "
            f"pipeline continues with HNO/FTS data only."
        )
        return pd.DataFrame()

    logger.info(f"  Reading INFORM: {filepath.name}")

    try:
        df = pd.read_excel(filepath, sheet_name="INFORM Severity - country", header=1, engine="openpyxl")
    except Exception as e:
        logger.warning(f"  ⚠ Failed to read 'INFORM Severity - country' sheet: {e}. Trying first sheet...")
        try:
            df = pd.read_excel(filepath, engine="openpyxl")
        except Exception as e2:
            logger.error(f"  ✗ Failed to parse INFORM Excel: {e2}")
            return pd.DataFrame()

    # Normalize column names
    import re
    df.columns = [re.sub(r"[^\w]+", "", str(c).strip().lower().replace(" ", "_")) for c in df.columns]

    # Map common column name variations
    rename_map: dict[str, str] = {}
    for target, candidates in {
        "country": ["country", "countryname", "crisis_name", "location"],
        "iso3": ["iso3", "country_code", "countrycode", "iso"],
        "inform_severity": [
            "inform_severity", "severity", "inform_severity_index",
            "crisis_severity", "overall_severity", "severity_score",
        ],
        "inform_risk": ["inform_risk", "risk", "inform_risk_index", "risk_score"],
        "year": ["year", "date", "period"],
    }.items():
        for candidate in candidates:
            if candidate in df.columns:
                rename_map[candidate] = target
                break

    df = df.rename(columns=rename_map)

    # Ensure severity is numeric
    if "inform_severity" in df.columns:
        df["inform_severity"] = pd.to_numeric(df["inform_severity"], errors="coerce")
        # Clamp to valid range
        df["inform_severity"] = df["inform_severity"].clip(0, 10)
    else:
        logger.warning("  ⚠ No 'inform_severity' column found in INFORM data")
        return pd.DataFrame()

    if "inform_risk" in df.columns:
        df["inform_risk"] = pd.to_numeric(df["inform_risk"], errors="coerce")

    # If no year column, assume current year
    if "year" not in df.columns:
        from datetime import datetime
        df["year"] = datetime.now().year

    # Add metadata
    df["source_file"] = filepath.name

    # Drop rows without country or severity
    required_cols = [c for c in ["country", "inform_severity"] if c in df.columns]
    if required_cols:
        df = df.dropna(subset=required_cols)

    # Write to Bronze
    table_name = config.bronze_table("inform_severity_raw")
    client.write_dataframe(df, table_name, mode="overwrite")

    logger.info(f"✓ Bronze INFORM: {len(df)} severity records → {table_name}")
    return df
