from typing import Optional
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
import json

def generate_dossier_impl(client: DatabricksClient, config: DatabricksConfig, crisis_id: str) -> str:
    table_name = config.gold_table("crisis_index")
    try:
        df = client.query(f"SELECT * FROM {table_name} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            return json.dumps({"error": f"Crisis ID {crisis_id} not found."})
        
        crisis_data = df.iloc[0].to_dict()
        
        from tools.query_kumo_predictions import query_kumo_predictions_impl
        preds_json = query_kumo_predictions_impl(client, config, crisis_id)
        
        # Also fetch donor concentration
        donor_data = {}
        donor_table = config.gold_table("donor_concentration")
        if client.table_exists(donor_table):
            donor_df = client.query(f"SELECT * FROM {donor_table} WHERE crisis_id = '{crisis_id}'")
            if not donor_df.empty:
                donor_data = donor_df.iloc[0].to_dict()
        
        return json.dumps({
            "dossier_metadata": {
                "generated_for_committee": "CERF Secretariat",
                "format": "Underfunded Emergencies Candidate Profile",
                "data_provenance": "Lighthouse OS - Databricks Gold Layer"
            },
            "crisis_summary": crisis_data,
            "donor_concentration_and_dependency_risk": donor_data,
            "kumo_ai_advanced_predictions": json.loads(preds_json),
            "data_health_and_confidence": {
                "score": crisis_data.get("confidence_score", 0),
                "level": crisis_data.get("confidence_level", "UNKNOWN")
            },
            "claude_draft_narrative_prompt": "Using the data above, generate a formal 3-paragraph UN CERF Allocation Justification focusing on structural neglect, urgency, and the Kumo 6-month cascading risk projection."
        }, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})
