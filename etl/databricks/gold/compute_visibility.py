"""
Gold Layer — Media Visibility Computation (Layer 5B).

Computes the media visibility penalty for all active crises in the crisis_index
using open news APIs (e.g. NewsAPI/GDELT).
"""

from __future__ import annotations

import asyncio
import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.intelligence.visibility_scorer import VisibilityScorer

async def _score_all(df: pd.DataFrame) -> pd.DataFrame:
    scorer = VisibilityScorer()
    
    # We only want to score unique countries
    countries = df["country"].dropna().unique()
    scores = {}
    
    logger.info(f"  Scoring media visibility for {len(countries)} countries. This may take a moment...")
    
    # Create concurrent tasks (up to 5 at a time to avoid rate limiting)
    sem = asyncio.Semaphore(5)
    
    async def fetch_score(country: str):
        async with sem:
            # We don't have crisis_id directly tied to country cleanly here, but scorer only uses country anyway
            score = await scorer.score_crisis_visibility(f"id_{country}", country)
            return country, score
            
    tasks = [fetch_score(c) for c in countries]
    results = await asyncio.gather(*tasks)
    
    for country, score in results:
        scores[country] = score
        
    df["media_visibility"] = df["country"].map(scores).fillna(0.5)
    return df

def compute_visibility_scores(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Fetch visibility scores and update gold.crisis_index."""
    logger.info("═" * 60)
    logger.info("GOLD: Computing Media Visibility Scores (Layer 5B)")
    logger.info("═" * 60)
    
    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        logger.error(f"Crisis index table not found: {table_name}")
        return pd.DataFrame()
        
    df = client.query(f"SELECT * FROM {table_name}")
    if df.empty:
        return df
        
    # Add media_visibility column asynchronously
    try:
        df = asyncio.run(_score_all(df))
    except Exception as e:
        logger.error(f"Failed to score media visibility: {e}")
        # Default to 0.5 so we don't break pipeline
        df["media_visibility"] = 0.5
        
    client.write_dataframe(df, table_name, mode="overwrite")
    
    # Log summary
    avg_vis = df["media_visibility"].mean()
    logger.info(f"✓ Visibility scores computed and written to {table_name}")
    logger.info(f"  Average Global Visibility: {avg_vis:.2f}")
    
    return df
