"""
Gold Layer — Donor Concentration Analysis.

Computes the Herfindahl-Hirschman Index (HHI) for donor concentration
per crisis using Country-Based Pooled Funds (CBPF) data as a proxy proxy
for donor dependence. High concentration = dangerous single-donor dependency.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig


def _classify_dependency_risk(hhi: float, top_share: float) -> str:
    """Classify donor dependency risk based on HHI and top donor share.

    HHI > 0.25 with top donor > 50% = HIGH risk
    HHI > 0.15 = MEDIUM risk
    Otherwise = LOW risk
    """
    if hhi > 0.25 and top_share > 0.50:
        return "HIGH"
    elif hhi > 0.15:
        return "MEDIUM"
    else:
        return "LOW"


def compute_donor_concentration(
    client: DatabricksClient, config: DatabricksConfig
) -> pd.DataFrame:
    """Compute donor concentration metrics using CBPF data.

    Calculates the HHI index based on the share of contributions 
    from different donors to the country's pooled fund.

    Returns:
        DataFrame with donor concentration metrics
    """
    logger.info("═" * 60)
    logger.info("GOLD: Computing Donor Concentration Index")
    logger.info("═" * 60)

    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        logger.error(f"Crisis index not found: {table_name}")
        return pd.DataFrame()

    # Get the unique crisis dimensions we need to enrich
    crisis_df = client.query(f"SELECT DISTINCT crisis_id, iso3, year, sector FROM {table_name}")

    cbpf_table = config.bronze_table("cbpf_allocations_raw")
    if not client.table_exists(cbpf_table):
        logger.warning(f"CBPF allocations table not found: {cbpf_table}. Using defaults.")
        cbpf_df = pd.DataFrame()
    else:
        cbpf_df = client.query(f"SELECT country as iso3, fiscal_year as year, donor_name, paid_amt_u_s_d as paid_amt_usd FROM {cbpf_table} WHERE country IS NOT NULL AND donor_name IS NOT NULL")

    results = []

    if not cbpf_df.empty:
        # Ensure correct types
        cbpf_df["paid_amt_usd"] = pd.to_numeric(cbpf_df["paid_amt_usd"], errors="coerce").fillna(0)
        
        # Group by country, year, and donor to get total given by each donor per country per year
        donor_sums = cbpf_df.groupby(["iso3", "year", "donor_name"])["paid_amt_usd"].sum().reset_index()
        
        # Group by country and year to get the total pooled fund size
        total_sums = donor_sums.groupby(["iso3", "year"])["paid_amt_usd"].sum().reset_index()
        total_sums = total_sums.rename(columns={"paid_amt_usd": "total_fund"})
        
        merged = donor_sums.merge(total_sums, on=["iso3", "year"], how="left")
        
        # Filter out 0 total funds
        merged = merged[merged["total_fund"] > 0].copy()
        merged["share"] = merged["paid_amt_usd"] / merged["total_fund"]
        merged["share_sq"] = merged["share"] ** 2
        
        # Compute HHI and top donor per country/year
        for (iso3, year), group in merged.groupby(["iso3", "year"]):
            hhi = group["share_sq"].sum()
            donor_count = len(group)
            
            top_donor_row = group.loc[group["share"].idxmax()]
            top_donor_name = top_donor_row["donor_name"]
            top_donor_share = top_donor_row["share"]
            
            risk = _classify_dependency_risk(hhi, top_donor_share)
            
            results.append({
                "iso3": iso3,
                "year": str(year),
                "hhi_index": float(hhi),
                "top_donor_name": str(top_donor_name),
                "top_donor_share": float(top_donor_share),
                "donor_count": int(donor_count),
                "dependency_risk": risk
            })

    metrics_df = pd.DataFrame(results)

    # Merge computed metrics back into the crisis_index structure
    if not metrics_df.empty:
        donor_df = crisis_df.merge(metrics_df, on=["iso3", "year"], how="left")
    else:
        donor_df = crisis_df.copy()
        
    # Fill defaults for crises with no CBPF data
    donor_df["hhi_index"] = donor_df.get("hhi_index", pd.Series(dtype=float)).fillna(0.0)
    donor_df["top_donor_name"] = donor_df.get("top_donor_name", pd.Series(dtype=str)).fillna("Unknown")
    donor_df["top_donor_share"] = donor_df.get("top_donor_share", pd.Series(dtype=float)).fillna(0.0)
    donor_df["donor_count"] = donor_df.get("donor_count", pd.Series(dtype=int)).fillna(0).astype(int)
    donor_df["dependency_risk"] = donor_df.get("dependency_risk", pd.Series(dtype=str)).fillna("UNKNOWN")

    # Write to Gold
    donor_table = config.gold_table("donor_concentration")
    client.write_dataframe(donor_df, donor_table, mode="overwrite")

    logger.info(f"✓ Donor Concentration table created: {len(donor_df)} records → {donor_table}")
    
    # Log summary of high risk countries
    high_risk = donor_df[donor_df["dependency_risk"] == "HIGH"]["iso3"].nunique()
    logger.info(f"  🔴 {high_risk} countries flagged with HIGH single-donor dependency risk (>50% share, HHI > 0.25).")

    return donor_df
