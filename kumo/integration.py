"""
Kumo → Databricks Integration.
Runs all Kumo prediction tasks and writes the results back to the Databricks Gold Layer.
"""

from loguru import logger
from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

from kumo.tasks.velocity_prediction import run_velocity_prediction
from kumo.tasks.cascading_risk import run_cascading_risk
from kumo.tasks.gap_projection import run_gap_projection
from kumo.tasks.donor_behavior import run_donor_behavior

def run_all_kumo_tasks(config: DatabricksConfig):
    """Executes the full suite of Kumo RFM predictions."""
    logger.info("============================================================")
    logger.info("KUMO PREDICTIVE LAYER: Starting RFM Tasks")
    logger.info("============================================================")
    
    with DatabricksClient(config) as client:
        # Task 1
        run_velocity_prediction(client)
        
        # Task 2
        run_cascading_risk(client)
        
        # Task 3
        run_gap_projection(client)
        
        # Task 4
        run_donor_behavior(client)
        
    logger.info("============================================================")
    logger.info("✓ All Kumo predictions successfully written to Databricks Gold")
    logger.info("============================================================")

if __name__ == "__main__":
    config = DatabricksConfig()
    run_all_kumo_tasks(config)
