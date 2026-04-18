import json
import pandas as pd
import numpy as np
from loguru import logger
from etl.databricks.config import DatabricksConfig
from etl.databricks.client import DatabricksClient

def optimize_allocation_impl(
    client: DatabricksClient, config: DatabricksConfig, total_budget_usd: float
) -> str:
    """
    Simulates the mathematically optimal allocation of a set budget across all
    underfunded crises to maximize global equity (minimize the Gini coefficient
    of coverage ratios).
    """
    logger.info("═" * 60)
    logger.info(f"SIMULATOR: Optimizing Allocation for ${total_budget_usd:,.2f}")
    logger.info("═" * 60)

    table_name = config.gold_table("crisis_index")
    # Fetch all eligible crises
    df = client.query(f"SELECT * FROM {table_name} WHERE is_in_scope = True")

    # Ensure numeric columns
    df["reqs"] = pd.to_numeric(df["requirements_usd"], errors="coerce").fillna(0.0)
    df["fund"] = pd.to_numeric(df["funding_usd"], errors="coerce").fillna(0.0)
    df["cov"] = pd.to_numeric(df["coverage_ratio"], errors="coerce").fillna(0.0)
    df["gap"] = df["reqs"] - df["fund"]

    # Filter to only those that have a funding gap
    eligible = df[df["gap"] > 0].copy()

    # Dictionary to hold the new allocations per crisis
    allocations = {cid: 0.0 for cid in eligible["crisis_id"]}
    remaining_budget = total_budget_usd

    # We use a greedy water-filling algorithm approximation.
    # At each step, we find the crisis with the lowest coverage ratio and fill it
    # up by a small chunk until the budget is depleted or all gaps are filled.
    # To be efficient, we use dynamic chunks.
    chunk_size = max(total_budget_usd / 1000.0, 10000.0)

    while remaining_budget > 0 and len(eligible) > 0:
        # Recalculate current coverage for eligible crises
        eligible["current_cov"] = (
            eligible["fund"] + eligible["crisis_id"].map(allocations)
        ) / eligible["reqs"]

        # Identify the crisis with the lowest current coverage
        min_cov_idx = eligible["current_cov"].idxmin()
        cid = eligible.loc[min_cov_idx, "crisis_id"]

        # Calculate how much gap remains for this specific crisis
        current_alloc = allocations[cid]
        gap_remaining = eligible.loc[min_cov_idx, "reqs"] - (
            eligible.loc[min_cov_idx, "fund"] + current_alloc
        )

        if gap_remaining <= 0:
            # Crisis is fully funded, remove from eligible pool
            eligible = eligible.drop(min_cov_idx)
            continue

        # Allocate the chunk or whatever is left/needed
        alloc_amount = min(chunk_size, remaining_budget, gap_remaining)
        allocations[cid] += alloc_amount
        remaining_budget -= alloc_amount

    # Calculate Gini Coefficients
    def calc_gini(coverage_series):
        cov = np.sort(coverage_series.dropna().values)
        if len(cov) == 0 or np.sum(cov) == 0:
            return 0.0
        n = len(cov)
        index = np.arange(1, n + 1)
        return (np.sum((2 * index - n - 1) * cov)) / (n * np.sum(cov))

    gini_before = calc_gini(df["cov"])

    # Apply the allocations to the main dataframe
    df["new_fund"] = df["fund"] + df["crisis_id"].map(allocations).fillna(0.0)
    df["new_cov"] = np.where(df["reqs"] > 0, df["new_fund"] / df["reqs"], 0)
    df["new_cov"] = df["new_cov"].clip(0, 1.0)

    gini_after = calc_gini(df["new_cov"])

    # Prepare detailed allocation list
    allocated_crises = []
    for cid, amount in allocations.items():
        if amount > 0:
            row = df[df["crisis_id"] == cid].iloc[0]
            allocated_crises.append(
                {
                    "crisis_id": cid,
                    "country": row["country"],
                    "sector": row["sector"],
                    "allocated_usd": amount,
                    "new_coverage_ratio": row["new_cov"],
                }
            )

    # Sort allocations by amount descending
    allocated_crises.sort(key=lambda x: x["allocated_usd"], reverse=True)

    result = {
        "optimization_goal": "Maximize Global Equity (Minimize Gini Coefficient)",
        "total_budget_usd": total_budget_usd,
        "budget_allocated_usd": total_budget_usd - remaining_budget,
        "gini_before": round(gini_before, 5),
        "gini_after": round(gini_after, 5),
        "equity_improvement": round(gini_before - gini_after, 5),
        "top_allocations": allocated_crises[:20],  # Return the top 20 allocations
    }

    return json.dumps(result)
