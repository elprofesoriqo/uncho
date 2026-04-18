from typing import Optional
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
import json
import pandas as pd

def query_rankings_impl(
    client: DatabricksClient,
    config: DatabricksConfig,
    region: Optional[str] = None,
    min_people_in_need: Optional[int] = None,
    max_coverage_ratio: Optional[float] = None,
    sector: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = 10,
    include_predictions: bool = True
) -> str:
    table_name = config.gold_table("crisis_index")
    if not client.table_exists(table_name):
        return json.dumps({"error": f"Table {table_name} does not exist. Run pipeline first."})

    query = f"SELECT * FROM {table_name} WHERE is_in_scope = True"
    
    if region:
        query += f" AND region = '{region}'"
    if min_people_in_need is not None:
        query += f" AND CAST(people_in_need AS DOUBLE) >= {min_people_in_need}"
    if max_coverage_ratio is not None:
        query += f" AND CAST(coverage_ratio AS DOUBLE) <= {max_coverage_ratio}"
    if sector:
        query += f" AND sector = '{sector}'"
    if year:
        query += f" AND year = '{year}'"
        
    query += f" ORDER BY CAST(mismatch_score_lower_bound AS DOUBLE) DESC LIMIT {limit}"
    
    try:
        df = client.query(query)
        if df.empty:
            return json.dumps([])
            
        results = df.to_dict(orient="records")
        
        if include_predictions:
            from tools.query_kumo_predictions import query_kumo_predictions_impl
            for record in results:
                crisis_id = record.get("crisis_id")
                if crisis_id:
                    preds_json = query_kumo_predictions_impl(client, config, crisis_id)
                    try:
                        record["kumo_predictions"] = json.loads(preds_json)
                    except json.JSONDecodeError:
                        record["kumo_predictions"] = {}
                        
        return json.dumps(results, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})
