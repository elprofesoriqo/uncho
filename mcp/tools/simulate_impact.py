import json
from typing import Optional
import pandas as pd
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

def simulate_impact_impl(client: DatabricksClient, config: DatabricksConfig, crisis_id: str, additional_funding_usd: float) -> str:
    table_name = config.gold_table("crisis_index")
    try:
        if not client.table_exists(table_name):
            return json.dumps({"error": f"Table {table_name} does not exist."})
            
        # Get the specific crisis
        df = client.query(f"SELECT * FROM {table_name} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            return json.dumps({"error": f"Crisis ID {crisis_id} not found."})
            
        record = df.iloc[0].to_dict()
        
        # Current values
        funding = float(record.get("funding_usd") or 0.0)
        reqs = float(record.get("requirements_usd") or 1.0)
        if reqs == 0: reqs = 1.0
        
        pin = float(record.get("people_in_need") or 0.0)
        current_rank = int(record.get("global_rank") or 0)
        old_score = float(record.get("mismatch_score") or 0.0)
        
        old_coverage = min(funding / reqs, 1.0)
        
        # New values
        new_funding = funding + additional_funding_usd
        new_coverage = min(new_funding / reqs, 1.0)
        
        # Recalculate Gap Severity
        # GapSeverity = (1 - coverage_ratio) ^ 1.3
        new_gap = max(0.0, 1.0 - new_coverage)
        new_gap_severity = new_gap ** 1.3
        
        # Retrieve other factors (or approximate if not stored explicitly)
        need_weight = float(record.get("need_weight") or 0.0)
        structural_multiplier = float(record.get("structural_multiplier") or 1.0)
        visibility_penalty = float(record.get("visibility_penalty") or 1.0)
        urgency_weight = float(record.get("urgency_weight") or 1.0)
        efficiency_discount = float(record.get("efficiency_discount") or 1.0) # NEW
        confidence_score = float(record.get("confidence_score") or 0.5) # NEW
        
        if need_weight > 0:
            new_score = need_weight * new_gap_severity * structural_multiplier * visibility_penalty * urgency_weight * efficiency_discount
        else:
            # Fallback if factors aren't directly available
            old_gap_severity = max(0.0, 1.0 - old_coverage) ** 1.3
            if old_gap_severity > 0:
                new_score = old_score * (new_gap_severity / old_gap_severity)
            else:
                new_score = old_score

        # Calculate new Bayesian bounds for defensible ranking
        margin_of_error = 1.0 - confidence_score
        new_score_lower_bound = new_score * (1.0 - (margin_of_error * 0.30))
        new_score_upper_bound = new_score * (1.0 + (margin_of_error * 0.30))

        # Find new rank (Sort by lower bound!)
        all_scores_df = client.query(f"SELECT crisis_id, mismatch_score_lower_bound FROM {table_name} WHERE CAST(requirements_usd AS DOUBLE) > 0 OR CAST(people_in_need AS DOUBLE) > 0")
        
        # Update score in dataframe for ranking
        all_scores_df['mismatch_score_lower_bound'] = pd.to_numeric(all_scores_df['mismatch_score_lower_bound'], errors="coerce").fillna(0.0)
        all_scores_df.loc[all_scores_df['crisis_id'] == crisis_id, 'mismatch_score_lower_bound'] = new_score_lower_bound
        
        # Re-rank
        all_scores_df = all_scores_df.sort_values("mismatch_score_lower_bound", ascending=False).reset_index(drop=True)
        all_scores_df['new_rank'] = all_scores_df.index + 1
        
        new_rank_row = all_scores_df[all_scores_df['crisis_id'] == crisis_id]
        new_rank = int(new_rank_row['new_rank'].values[0]) if not new_rank_row.empty else current_rank
        
        # Cost per beneficiary heuristic
        cost_per_beneficiary = reqs / pin if pin > 0 else 50.0
        people_reached = additional_funding_usd / cost_per_beneficiary if cost_per_beneficiary > 0 else 0
        
        # Global Equity Impact: We use the Gini Coefficient of Coverage Ratios across all active crises.
        # A lower Gini coefficient means more equitable (fair) distribution of funding globally.
        # Let's calculate the Gini coefficient before and after the simulated allocation.
        active_crises = all_scores_df.copy()
        
        # Function to calculate Gini coefficient
        def calculate_gini(array):
            array = array.values.flatten()
            if any(array < 0):
                # Shift values to be non-negative for Gini
                array -= array.min()
            array += 1e-15 # Avoid divide by zero
            array = sorted(array)
            index = range(1, len(array) + 1)
            n = len(array)
            return ((2 * sum(i * val for i, val in zip(index, array))) / (n * sum(array))) - (n + 1) / n
            
        # We need the current coverage ratios for all crises. Since all_scores_df only has mismatch_score,
        # we need to fetch coverage_ratio from the main table.
        equity_df = client.query(f"SELECT crisis_id, coverage_ratio FROM {table_name} WHERE CAST(requirements_usd AS DOUBLE) > 0")
        
        if not equity_df.empty:
            old_coverages = equity_df["coverage_ratio"].astype(float).clip(0, 1)
            old_gini = calculate_gini(old_coverages)
            
            # Update the simulated crisis
            equity_df.loc[equity_df['crisis_id'] == crisis_id, 'coverage_ratio'] = new_coverage
            new_coverages = equity_df["coverage_ratio"].astype(float).clip(0, 1)
            new_gini = calculate_gini(new_coverages)
            
            equity_shift = old_gini - new_gini  # Positive means Gini decreased (funding became MORE equitable)
        else:
            old_gini = 0.0
            new_gini = 0.0
            equity_shift = 0.0
            
        return json.dumps({
            "crisis_id": crisis_id,
            "financials": {
                "requirements_usd": reqs,
                "old_funding_usd": funding,
                "new_funding_usd": new_funding,
                "additional_funding_usd": additional_funding_usd
            },
            "impact": {
                "old_coverage_ratio": old_coverage,
                "new_coverage_ratio": new_coverage,
                "coverage_change": f"{old_coverage:.1%} → {new_coverage:.1%}",
                "estimated_additional_people_reached": int(people_reached),
                "cost_per_beneficiary_assumption": cost_per_beneficiary
            },
            "ranking": {
                "old_mismatch_score": old_score,
                "new_mismatch_score_lower_bound": new_score_lower_bound,
                "current_rank": current_rank,
                "new_rank": new_rank,
                "global_equity_impact_score": equity_shift
            }
        }, indent=2)
    except Exception as e:
        import traceback
        return json.dumps({"error": str(e), "trace": traceback.format_exc()})
