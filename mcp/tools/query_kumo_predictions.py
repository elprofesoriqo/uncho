from typing import Optional
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
import json

def query_kumo_predictions_impl(client: DatabricksClient, config: DatabricksConfig, crisis_id: str) -> str:
    preds = {}
    tasks = {
        "velocity": "kumo_predictions_velocity",
        "cascade": "kumo_predictions_cascade",
        "gap": "kumo_predictions_gap",
        "donor": "kumo_predictions_donor"
    }
    
    for task_key, suffix in tasks.items():
        table_name = config.gold_table(suffix)
        try:
            if client.table_exists(table_name):
                df = client.query(f"SELECT * FROM {table_name} WHERE crisis_id = '{crisis_id}'")
                if not df.empty:
                    preds[task_key] = df.iloc[0].to_dict()
        except Exception as e:
            pass # Skip if table not there or error
            
    return json.dumps(preds)
