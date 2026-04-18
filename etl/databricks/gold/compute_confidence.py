"""
Gold Layer — Data Confidence Scoring (Advanced).

Computes a mathematically rigorous confidence score (0–1) for each crisis record 
based on exponential temporal decay (data freshness) and dimensional completeness. 

This powers the "Data Humility" philosophy, driving Bayesian Uncertainty Bounds 
in the main MismatchScore calculation.
"""

from __future__ import annotations

import math
from datetime import datetime

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

# Exponential decay factor for data older than 1 year
# A rate of 0.4 means data 3 years old is worth e^(-1.2) = ~30% confidence
STALENESS_DECAY_RATE = 0.4
CURRENT_YEAR = datetime.now().year


def _freshness_score(data_year: int) -> float:
    """Score data freshness using an exponential decay model."""
    years_old = max(CURRENT_YEAR - data_year, 0)

    if years_old == 0:
        return 1.0
        
    # Exponential decay function
    decayed_score = math.exp(-STALENESS_DECAY_RATE * years_old)
    
    # Floor the score at 0.1 so ancient data isn't completely zeroed out
    return max(decayed_score, 0.1)


def _completeness_score(row: pd.Series) -> float:
    """Score data completeness, heavily penalizing missing core financials."""
    score = 0.0
    max_score = 5.0

    # Critical Core Dimensions (Double Weight)
    if float(row.get("requirements_usd", 0)) > 0:
        score += 1.5
    if float(row.get("people_in_need", 0)) > 0:
        score += 1.5

    # Secondary Dimensions (Standard Weight)
    if float(row.get("funding_usd", 0)) > 0:
        score += 1.0
        
    inform = float(row.get("inform_severity", 0))
    if inform > 0 and inform != 5.0:  # 5.0 is our default/placeholder
        score += 0.5
        
    if float(row.get("population", 0)) > 0:
        score += 0.5

    # If critical dimensions are entirely missing, cap the total score at 0.4
    if float(row.get("requirements_usd", 0)) == 0 and float(row.get("people_in_need", 0)) == 0:
        return min(score / max_score, 0.4)

    return score / max_score


def _classify_confidence(score: float) -> str:
    """Classify a confidence score into HIGH/MEDIUM/LOW."""
    if score >= 0.80:
        return "HIGH"
    elif score >= 0.50:
        return "MEDIUM"
    else:
        return "LOW"


def compute_confidence_scores(
    client: DatabricksClient, config: DatabricksConfig
) -> pd.DataFrame:
    """Compute confidence scores for all crisis index records.

    Confidence = weighted average of freshness (50%) + completeness (50%)

    Returns:
        Updated crisis index with confidence_score and confidence_level
    """
    logger.info("═" * 60)
    logger.info("GOLD: Computing Bayesian Data Confidence Scores")
    logger.info("═" * 60)

    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        logger.error(f"Crisis index not found: {table_name}")
        return pd.DataFrame()

    df = client.query(f"SELECT * FROM {table_name}")

    # Compute freshness via exponential decay
    df["year"] = pd.to_numeric(df["year"], errors="coerce").fillna(CURRENT_YEAR)
    df["_freshness"] = df["year"].apply(lambda y: _freshness_score(int(y)))

    # Compute completeness via weighted dimensional analysis
    df["_completeness"] = df.apply(_completeness_score, axis=1)

    # Composite: Equal weighting
    df["confidence_score"] = (df["_freshness"] * 0.5 + df["_completeness"] * 0.5).round(3)
    df["confidence_level"] = df["confidence_score"].apply(_classify_confidence)

    # Cleanup temp columns
    df = df.drop(columns=["_freshness", "_completeness"])

    # Write back
    client.write_dataframe(df, table_name, mode="overwrite")

    # Summary
    levels = df["confidence_level"].value_counts()
    logger.info(f"✓ Confidence scores computed for {len(df)} records")
    for level in ["HIGH", "MEDIUM", "LOW"]:
        count = levels.get(level, 0)
        logger.info(f"  {'🟢' if level == 'HIGH' else '🟡' if level == 'MEDIUM' else '🔴'} {level}: {count} records")

    avg_confidence = df["confidence_score"].mean()
    logger.info(f"  Average global confidence: {avg_confidence:.2f}")

    return df