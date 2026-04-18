"""
Silver Layer — Funding Flow Normalization.

Normalizes FTS funding data into a clean table of:
  iso3 × year × sector × requirements_usd × funding_usd

Handles currency consistency, deduplication, and sector name standardization.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.silver.normalize_countries import _resolve_iso3

# Sector name normalization — FTS uses inconsistent cluster names
SECTOR_NORMALIZE: dict[str, str] = {
    "health": "Health",
    "food security": "Food Security",
    "food security and agriculture": "Food Security",
    "food security and livelihoods": "Food Security",
    "water, sanitation and hygiene": "Water Sanitation Hygiene",
    "water sanitation hygiene": "Water Sanitation Hygiene",
    "wash": "Water Sanitation Hygiene",
    "protection": "Protection",
    "shelter": "Shelter/NFI",
    "shelter/nfi": "Shelter/NFI",
    "shelter and non-food items": "Shelter/NFI",
    "emergency shelter and nfi": "Shelter/NFI",
    "education": "Education",
    "nutrition": "Nutrition",
    "early recovery": "Early Recovery",
    "logistics": "Logistics",
    "camp coordination / management": "Camp Coordination / Management",
    "camp coordination and camp management": "Camp Coordination / Management",
    "cccm": "Camp Coordination / Management",
    "coordination and support services": "Coordination and support services",
    "coordination": "Coordination and support services",
    "emergency telecommunications": "Emergency Telecommunications",
    "multi-sector": "Multi-sector",
    "multi-cluster": "Multi-sector",
    "multi-sector refugees": "Multi-sector",
    "not specified": "Multi-sector",
}


def _normalize_sector(sector_name: str | None) -> str:
    """Normalize a sector/cluster name to a standard label."""
    if not sector_name or pd.isna(sector_name):
        return "Total"

    key = str(sector_name).strip().lower()
    return SECTOR_NORMALIZE.get(key, str(sector_name).strip())


def normalize_funding(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Build the Silver funding_flows table.

    Combines global and cluster-level FTS data into a clean, normalized table.

    Returns:
        DataFrame of normalized funding flows
    """
    logger.info("─" * 50)
    logger.info("SILVER: Normalizing funding flows")
    logger.info("─" * 50)

    frames: list[pd.DataFrame] = []

    # --- Load global-level FTS data ---
    global_table = config.bronze_table("fts_global_raw")
    if client.table_exists(global_table):
        try:
            global_df = client.query(f"SELECT * FROM {global_table}")
            global_df["sector"] = "Total"  # Global = aggregate
            frames.append(global_df)
            logger.info(f"  Loaded {len(global_df)} global FTS records")
        except Exception as e:
            logger.warning(f"  Could not read global FTS: {e}")

    # --- Load cluster-level FTS data ---
    cluster_table = config.bronze_table("fts_cluster_raw")
    if client.table_exists(cluster_table):
        try:
            cluster_df = client.query(f"SELECT * FROM {cluster_table}")
            if "cluster" in cluster_df.columns:
                cluster_df["sector"] = cluster_df["cluster"].apply(_normalize_sector)
            frames.append(cluster_df)
            logger.info(f"  Loaded {len(cluster_df)} cluster FTS records")
        except Exception as e:
            logger.warning(f"  Could not read cluster FTS: {e}")

    if not frames:
        logger.error("No FTS data available for normalization!")
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)

    # Resolve ISO3 codes
    if "country" in combined.columns:
        combined["iso3"] = combined.apply(
            lambda row: _resolve_iso3(
                str(row.get("country", "")),
                str(row.get("iso3", "")) if pd.notna(row.get("iso3")) else None
            ),
            axis=1,
        )

    # Clean numeric columns
    for col in ["requirements_usd", "funding_usd", "year"]:
        if col in combined.columns:
            combined[col] = pd.to_numeric(combined[col], errors="coerce")

    # Filter valid records
    if "iso3" not in combined.columns:
        combined["iso3"] = None
    combined = combined.dropna(subset=["iso3"])
    combined = combined[combined["year"].notna()]
    combined["year"] = combined["year"].astype(int)

    # Fill missing financial values with 0
    for col in ["requirements_usd", "funding_usd"]:
        if col not in combined.columns:
            combined[col] = 0.0
        combined[col] = combined[col].fillna(0)

    # Compute coverage ratio
    combined["coverage_ratio"] = combined.apply(
        lambda row: min(row["funding_usd"] / row["requirements_usd"], 1.0)
        if row["requirements_usd"] > 0 else 0.0,
        axis=1,
    )

    # Select Silver columns
    silver_cols = ["iso3", "country", "year", "sector", "requirements_usd", "funding_usd", "coverage_ratio"]
    available = [c for c in silver_cols if c in combined.columns]
    result = combined[available].copy()

    # Deduplicate (same iso3/year/sector may appear from multiple source rows)
    agg_dict = {
        "requirements_usd": "sum",
        "funding_usd": "sum",
    }
    if "country" in result.columns:
        agg_dict["country"] = "first"

    result = result.groupby(["iso3", "year", "sector"], as_index=False).agg(agg_dict)
    result["coverage_ratio"] = result.apply(
        lambda row: min(row["funding_usd"] / row["requirements_usd"], 1.0)
        if row["requirements_usd"] > 0 else 0.0,
        axis=1,
    )

    # Write to Silver
    table_name = config.silver_table("funding_flows")
    client.write_dataframe(result, table_name, mode="overwrite")

    logger.info(f"✓ Silver Funding Flows: {len(result)} records → {table_name}")
    logger.info(f"  Countries: {result['iso3'].nunique()}, "
                f"Years: {result['year'].min()}-{result['year'].max()}, "
                f"Sectors: {result['sector'].nunique()}")

    return result
