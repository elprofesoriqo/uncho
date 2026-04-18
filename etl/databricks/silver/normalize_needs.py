"""
Silver Layer — Needs Data Normalization.

Normalizes HNO people-in-need data into a clean table of:
  iso3 × year × sector × people_in_need × people_targeted × population
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.silver.normalize_countries import _resolve_iso3
from etl.databricks.silver.normalize_funding import _normalize_sector


def normalize_needs(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Build the Silver needs_by_sector table.

    Normalizes HNO data with ISO3 codes and standardized sectors.

    Returns:
        DataFrame of normalized needs data
    """
    logger.info("─" * 50)
    logger.info("SILVER: Normalizing needs data (HNO)")
    logger.info("─" * 50)

    hno_table = config.bronze_table("hno_raw")
    if not client.table_exists(hno_table):
        logger.error(f"Bronze HNO table not found: {hno_table}")
        return pd.DataFrame()

    df = client.query(f"SELECT * FROM {hno_table}")
    logger.info(f"  Loaded {len(df)} raw HNO records")

    # Resolve ISO3
    if "country" in df.columns:
        df["iso3"] = df["country"].apply(lambda c: _resolve_iso3(str(c)) if pd.notna(c) else None)
    else:
        df["iso3"] = None
    df = df.dropna(subset=["iso3"])

    # Normalize sector names
    if "sector" in df.columns:
        df["sector"] = df["sector"].apply(_normalize_sector)
    else:
        df["sector"] = "Total"

    # Convert numeric columns
    for col in ["in_need", "targeted", "population", "year"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Rename to standard names
    rename = {"in_need": "people_in_need", "targeted": "people_targeted"}
    df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})

    # Fill missing needs with 0 (some sectors report 0 PIN)
    df["people_in_need"] = df.get("people_in_need", pd.Series(dtype=float)).fillna(0).astype(int)
    if "people_targeted" in df.columns:
        df["people_targeted"] = df["people_targeted"].fillna(0).astype(int)
    if "population" in df.columns:
        df["population"] = df["population"].fillna(0).astype(int)

    # Filter to valid years
    df = df[df["year"].notna()]
    df["year"] = df["year"].astype(int)

    # Aggregate subnational to national level
    group_cols = [c for c in ["iso3", "country", "year", "sector"] if c in df.columns]
    agg_cols = {
        "people_in_need": "sum",
        "targeted": "sum",
        "reached": "sum",
        "affected": "sum",
    }
    # Only keep agg_cols that actually exist in the dataframe
    agg_cols = {k: v for k, v in agg_cols.items() if k in df.columns}

    if "population" in df.columns:
        agg_cols["population"] = "max"  # max, not sum — population is national

    result = df.groupby(group_cols, as_index=False).agg(agg_cols)

    # Compute per-capita metric
    if "population" in result.columns:
        result["pin_per_capita"] = result.apply(
            lambda r: r["people_in_need"] / r["population"]
            if r["population"] > 0 else 0.0,
            axis=1,
        )
    else:
        result["pin_per_capita"] = 0.0

    # Write to Silver
    table_name = config.silver_table("needs_by_sector")
    client.write_dataframe(result, table_name, mode="overwrite")

    logger.info(f"✓ Silver Needs: {len(result)} records → {table_name}")
    logger.info(f"  Countries: {result['iso3'].nunique()}, "
                f"Sectors: {result['sector'].nunique()}")

    return result
