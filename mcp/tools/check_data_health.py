from typing import Optional
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
import json
import pandas as pd
from typing import Optional
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

def check_data_health_impl(client: DatabricksClient, config: DatabricksConfig, iso3: Optional[str] = None) -> str:
    """
    Component 5: Data Health & Transparency Matrix
    Outputs a detailed grid of data completeness and freshness for all active crises.
    """
    table_name = config.gold_table("crisis_index")
    try:
        if not client.table_exists(table_name):
            return json.dumps({"error": f"Table {table_name} not found"})
            
        # Select all the critical indicators that make up the Transparency Matrix
        query = f"""
            SELECT 
                iso3, country, sector, year, 
                people_in_need, requirements_usd, funding_usd, 
                inform_severity, population,
                confidence_score, confidence_level, crisis_type
            FROM {table_name}
            WHERE is_in_scope = True
        """
        
        if iso3:
            query += f" AND iso3 = '{iso3}'"
            
        df = client.query(query)
        if df.empty:
            return json.dumps({"error": "No data found for health check."})
            
        # Ensure numeric
        for col in ["people_in_need", "requirements_usd", "funding_usd", "inform_severity", "population", "confidence_score"]:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # Compute transparency matrix per crisis
        matrix_rows = []
        for _, row in df.iterrows():
            matrix_rows.append({
                "crisis_id": f"{row['iso3']}_{row['year']}_{row['sector']}",
                "country": row['country'],
                "iso3": row['iso3'],
                "sector": row['sector'],
                "confidence_level": row['confidence_level'],
                "confidence_score": round(float(row['confidence_score']), 3),
                "data_points_present": {
                    "has_people_in_need": float(row['people_in_need']) > 0,
                    "has_financial_requirements": float(row['requirements_usd']) > 0,
                    "has_funding_data": float(row['funding_usd']) > 0,
                    "has_inform_severity_index": float(row['inform_severity']) > 0 and float(row['inform_severity']) != 5.0,
                    "has_population_baseline": float(row['population']) > 0
                },
                "transparency_warnings": []
            })
            
            # Populate warnings
            if float(row['requirements_usd']) > 0 and float(row['people_in_need']) == 0:
                matrix_rows[-1]["transparency_warnings"].append("Budget exists but 0 People in Need recorded (Financial Disconnect).")
            if float(row['people_in_need']) > 0 and float(row['requirements_usd']) == 0:
                matrix_rows[-1]["transparency_warnings"].append("People in Need identified but 0 financial requirements (Missing HRP/Appeal).")
            if float(row['inform_severity']) == 5.0 or float(row['inform_severity']) == 0:
                matrix_rows[-1]["transparency_warnings"].append("Missing external INFORM risk severity baseline.")
                
        # Global rollups
        global_avg_confidence = df["confidence_score"].mean()
        total_crises = len(df)
        missing_hrp = len([r for r in matrix_rows if not r["data_points_present"]["has_financial_requirements"]])
        missing_pin = len([r for r in matrix_rows if not r["data_points_present"]["has_people_in_need"]])
        
        return json.dumps({
            "global_health_summary": {
                "total_active_crises_analyzed": total_crises,
                "global_average_confidence_score": round(float(global_avg_confidence), 3),
                "crises_missing_financial_requirements": missing_hrp,
                "crises_missing_people_in_need": missing_pin
            },
            "transparency_matrix": matrix_rows
        }, indent=2)
        
    except Exception as e:
        import traceback
        return json.dumps({"error": str(e), "trace": traceback.format_exc()})
