"""
Gold Layer — Master Crisis Index Builder.

Joins Silver needs, funding, and severity data into the unified crisis_index table.
This is the foundational Gold table that all scoring operates on.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.schemas import get_region


def build_crisis_index(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Build the Gold crisis_index — the master unified table.

    Joins:
      - silver.needs_by_sector (people in need)
      - silver.funding_flows (requirements + funding)
      - silver.severity_index (INFORM severity)
      - silver.crisis_universe (ISO3, region, HRP status)

    Returns:
        The unified crisis index DataFrame
    """
    logger.info("═" * 60)
    logger.info("GOLD: Building Master Crisis Index")
    logger.info("═" * 60)

    # --- Load Silver tables ---
    needs_table = config.silver_table("needs_by_sector")
    funding_table = config.silver_table("funding_flows")
    severity_table = config.silver_table("severity_index")
    universe_table = config.silver_table("crisis_universe")

    # Funding is the primary driver — start there
    if not client.table_exists(funding_table):
        logger.error(f"Funding flows table not found: {funding_table}. Cannot build crisis index.")
        return pd.DataFrame()

    funding_df = client.query(f"SELECT * FROM {funding_table}")
    logger.info(f"  Loaded {len(funding_df)} funding flow records")

    # Load needs (optional — may have different sector granularity)
    needs_df = pd.DataFrame()
    if client.table_exists(needs_table):
        needs_df = client.query(f"SELECT * FROM {needs_table}")
        logger.info(f"  Loaded {len(needs_df)} needs records")
    else:
        logger.warning("  ⚠ No needs data — crisis index will be funding-only")

    # Load severity (optional)
    severity_df = pd.DataFrame()
    if client.table_exists(severity_table):
        severity_df = client.query(f"SELECT * FROM {severity_table}")
        logger.info(f"  Loaded {len(severity_df)} severity records")

    # Load universe (optional — for HRP status)
    universe_df = pd.DataFrame()
    if client.table_exists(universe_table):
        universe_df = client.query(f"SELECT * FROM {universe_table}")
        logger.info(f"  Loaded {len(universe_df)} universe records")

    # --- Join: Funding ← Needs ---
    # Primary key: iso3 × year × sector
    if not needs_df.empty:
        join_cols = ["iso3", "year", "sector"]
        needs_subset = needs_df[
            [c for c in ["iso3", "year", "sector", "people_in_need", "people_targeted",
                         "population", "pin_per_capita"] if c in needs_df.columns]
        ]
        crisis_df = funding_df.merge(needs_subset, on=join_cols, how="left")
    else:
        crisis_df = funding_df.copy()

    # --- Join: ← Severity (iso3 × year) ---
    if not severity_df.empty:
        sev_subset = severity_df[["iso3", "year", "inform_severity"]].drop_duplicates()
        crisis_df = crisis_df.merge(sev_subset, on=["iso3", "year"], how="left")

    # --- Join: ← Universe (iso3) ---
    if not universe_df.empty:
        univ_subset = universe_df[
            [c for c in ["iso3", "region"] if c in universe_df.columns]
        ].drop_duplicates(subset=["iso3"])
        crisis_df = crisis_df.merge(univ_subset, on="iso3", how="left")

    # --- Fill defaults ---
    crisis_df["people_in_need"] = crisis_df.get("people_in_need", pd.Series(dtype=float)).fillna(0).astype(int)
    crisis_df["people_targeted"] = crisis_df.get("people_targeted", pd.Series(dtype=float)).fillna(0).astype(int)
    crisis_df["population"] = crisis_df.get("population", pd.Series(dtype=float)).fillna(0).astype(int)
    crisis_df["inform_severity"] = crisis_df.get("inform_severity", pd.Series(dtype=float)).fillna(5.0)

    # Ensure region is populated
    if "region" not in crisis_df.columns:
        crisis_df["region"] = crisis_df["iso3"].apply(get_region)
    else:
        crisis_df["region"] = crisis_df["region"].fillna(
            crisis_df["iso3"].apply(get_region)
        )

    # Compute coverage ratio
    crisis_df["requirements_usd"] = pd.to_numeric(crisis_df["requirements_usd"], errors="coerce").fillna(0)
    crisis_df["funding_usd"] = pd.to_numeric(crisis_df["funding_usd"], errors="coerce").fillna(0)
    crisis_df["coverage_ratio"] = crisis_df.apply(
        lambda r: min(r["funding_usd"] / r["requirements_usd"], 1.0)
        if r["requirements_usd"] > 0 else 0.0,
        axis=1,
    )

    # Per-capita
    crisis_df["pin_per_capita"] = crisis_df.apply(
        lambda r: r["people_in_need"] / r["population"]
        if r["population"] > 0 else 0.0,
        axis=1,
    )

    # Generate crisis_id
    crisis_df["crisis_id"] = crisis_df.apply(
        lambda r: f"{r['iso3']}_{int(r['year'])}_{r['sector']}", axis=1
    )

    # Initialize score columns (computed in subsequent Gold steps)
    crisis_df["need_weight"] = 0.0
    crisis_df["gap_severity"] = 0.0
    crisis_df["structural_multiplier"] = 1.0
    crisis_df["visibility_penalty"] = 1.0
    crisis_df["urgency_weight"] = 1.0
    crisis_df["mismatch_score"] = 0.0
    crisis_df["is_in_scope"] = True
    crisis_df["crisis_type"] = "ACUTE"
    crisis_df["confidence_score"] = 0.5
    crisis_df["confidence_level"] = "MEDIUM"
    crisis_df["global_rank"] = 0
    crisis_df["updated_at"] = datetime.utcnow().isoformat()

    # --- Write to Gold ---
    table_name = config.gold_table("crisis_index")
    client.write_dataframe(crisis_df, table_name, mode="overwrite")

    logger.info(f"✓ Gold Crisis Index: {len(crisis_df)} records → {table_name}")
    logger.info(f"  Countries: {crisis_df['iso3'].nunique()}")
    logger.info(f"  Years: {int(crisis_df['year'].min())} – {int(crisis_df['year'].max())}")
    logger.info(f"  Sectors: {crisis_df['sector'].nunique()}")
    logger.info(f"  Avg Coverage: {crisis_df['coverage_ratio'].mean():.1%}")

    return crisis_df
