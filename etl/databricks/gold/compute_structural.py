"""
Gold Layer — Structural Multiplier Computation.

Computes the chronic neglect penalty for each crisis based on multi-year
funding history. This is what separates "newly underfunded" from
"structurally neglected" crises.

StructuralMultiplier = 1 + (consecutive_years_below_50pct × 0.15) + trend_penalty
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

# Thresholds
UNDERFUNDED_THRESHOLD = 0.50  # Below 50% = "severely underfunded" (OCHA standard)
PENALTY_PER_YEAR = 0.15       # 15% score increase per consecutive year below threshold
DECLINING_TREND_BONUS = 0.10  # Extra penalty if trend is worsening
STABLE_LOW_BONUS = 0.05       # Extra penalty if persistently low without improvement
INCREASING_GAP_BONUS = 0.15   # Extra penalty if the absolute funding gap (USD) is widening
STRUCTURAL_YEAR_THRESHOLD = 3  # 3+ consecutive years = "structural"


def compute_structural_profiles(
    client: DatabricksClient, config: DatabricksConfig
) -> pd.DataFrame:
    """Compute the Structural Multiplier for each crisis.

    Uses a 5-year lookback from the most recent year to detect chronic underfunding.

    Returns:
        Updated crisis index with structural_multiplier and crisis_type
    """
    logger.info("═" * 60)
    logger.info("GOLD: Computing Structural Multiplier (Chronic Neglect Penalty)")
    logger.info("═" * 60)

    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        logger.error(f"Crisis index not found: {table_name}")
        return pd.DataFrame()

    df = client.query(f"SELECT * FROM {table_name}")

    # Ensure numeric
    df["coverage_ratio"] = pd.to_numeric(df["coverage_ratio"], errors="coerce").fillna(0)
    df["requirements_usd"] = pd.to_numeric(df["requirements_usd"], errors="coerce").fillna(0)
    df["funding_usd"] = pd.to_numeric(df["funding_usd"], errors="coerce").fillna(0)
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df["absolute_gap_usd"] = (df["requirements_usd"] - df["funding_usd"]).clip(lower=0)

    # Get the most recent year in data
    # max_year = int(df["year"].max())

    # For each country × sector, analyze multi-year funding history
    structural_records: list[dict] = []

    for (iso3, sector), group in df.groupby(["iso3", "sector"]):
        group = group.sort_values("year")
        years = group["year"].astype(int).tolist()
        coverages = group["coverage_ratio"].astype(float).tolist()
        absolute_gaps = group["absolute_gap_usd"].astype(float).tolist()

        # Count consecutive years below threshold (counting backward from most recent)
        consecutive_below = 0
        for cov in reversed(coverages):
            if cov < UNDERFUNDED_THRESHOLD:
                consecutive_below += 1
            else:
                break

        # Trend analysis (most recent 3 years)
        recent_coverages = coverages[-3:] if len(coverages) >= 3 else coverages
        recent_gaps = absolute_gaps[-3:] if len(absolute_gaps) >= 3 else absolute_gaps
        
        trend_penalty = 0.0
        if len(recent_coverages) >= 2:
            # Linear trend direction
            avg_early = sum(recent_coverages[:len(recent_coverages)//2]) / max(len(recent_coverages)//2, 1)
            avg_late = sum(recent_coverages[len(recent_coverages)//2:]) / max(len(recent_coverages) - len(recent_coverages)//2, 1)

            if avg_late < avg_early - 0.05:  # Declining by >5%
                trend_penalty += DECLINING_TREND_BONUS
            elif avg_late < UNDERFUNDED_THRESHOLD * 0.8:  # Persistently very low
                trend_penalty += STABLE_LOW_BONUS

            # Absolute gap trend
            avg_gap_early = sum(recent_gaps[:len(recent_gaps)//2]) / max(len(recent_gaps)//2, 1)
            avg_gap_late = sum(recent_gaps[len(recent_gaps)//2:]) / max(len(recent_gaps) - len(recent_gaps)//2, 1)
            
            # If the absolute gap is significantly widening (e.g. > 10% increase in dollar gap)
            if avg_gap_early > 0 and (avg_gap_late / avg_gap_early) > 1.10:
                trend_penalty += INCREASING_GAP_BONUS

        # Compute multiplier
        multiplier = 1.0 + (consecutive_below * PENALTY_PER_YEAR) + trend_penalty

        # Classify
        if consecutive_below >= STRUCTURAL_YEAR_THRESHOLD:
            crisis_type = "STRUCTURAL"
        elif consecutive_below >= 1:
            crisis_type = "ACUTE"
        else:
            crisis_type = "RECOVERING" if len(coverages) > 1 else "ACUTE"

        # Apply to all years for this country/sector
        for year in years:
            structural_records.append({
                "iso3": iso3,
                "sector": sector,
                "year": year,
                "structural_multiplier": multiplier,
                "crisis_type": crisis_type,
                "consecutive_years_underfunded": consecutive_below,
                "trend_penalty": trend_penalty,
            })

    struct_df = pd.DataFrame(structural_records)

    if not struct_df.empty:
        # Merge back into crisis index
        df = df.merge(
            struct_df[["iso3", "sector", "year", "structural_multiplier", "crisis_type"]].rename(
                columns={"structural_multiplier": "sm_new", "crisis_type": "ct_new"}
            ),
            on=["iso3", "sector", "year"],
            how="left",
        )
        df["structural_multiplier"] = df["sm_new"].fillna(1.0)
        df["crisis_type"] = df["ct_new"].fillna("ACUTE")
        df = df.drop(columns=["sm_new", "ct_new"])

    # --- Write updated multiplier ---
    client.write_dataframe(df, table_name, mode="overwrite")

    # Summary
    structural_count = len(struct_df[struct_df["crisis_type"] == "STRUCTURAL"]) if not struct_df.empty else 0
    acute_count = len(struct_df[struct_df["crisis_type"] == "ACUTE"]) if not struct_df.empty else 0

    logger.info("✓ Structural profiles computed")
    logger.info(f"  🔴 STRUCTURAL (3+ years underfunded): {structural_count} crisis-sector pairs")
    logger.info(f"  🟡 ACUTE: {acute_count} crisis-sector pairs")
    if not struct_df.empty:
        max_mult = struct_df["structural_multiplier"].max()
        logger.info(f"  Max Structural Multiplier: {max_mult:.2f}x")

    return df
