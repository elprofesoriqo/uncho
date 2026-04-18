"""
Mock Kumo SDK implementation for Lighthouse OS.
This allows the pipeline to run without an active Kumo API connection,
while still validating the connection parameters provided in the .env file.
"""
from loguru import logger
import pandas as pd
from typing import Any, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Verify Kumo keys are present
KUMO_API_KEY = os.getenv("KUMO_API_KEY")
KUMO_API_URL = os.getenv("KUMO_API_URL")

if not KUMO_API_KEY or not KUMO_API_URL:
    logger.warning("⚠️ KUMO_API_KEY or KUMO_API_URL missing from .env. Mock will run but a real implementation would fail.")
else:
    logger.info(f"✓ Kumo API authentication detected (URL: {KUMO_API_URL})")

class Graph:
    def __init__(self, catalog: str, schema: str, tables: List[str]):
        self.catalog = catalog
        self.schema = schema
        self.tables = tables
        logger.info(f"Initialized Kumo Graph connecting to {catalog}.{schema}")
        logger.info(f"Registered tables: {', '.join(tables)}")

    @classmethod
    def from_databricks(cls, catalog: str, schema: str, tables: List[str]) -> "Graph":
        return cls(catalog, schema, tables)

class PredictionTask:
    def __init__(self, target_table: str, target_column: str, task_type: str, time_column: str = None, prediction_horizon: str = None):
        self.target_table = target_table
        self.target_column = target_column
        self.task_type = task_type
        self.time_column = time_column
        self.prediction_horizon = prediction_horizon
        logger.info(f"Configured Kumo {task_type} PredictionTask on {target_table}.{target_column} (horizon: {prediction_horizon})")

class Model:
    def __init__(self, graph: Graph, task: PredictionTask):
        self.graph = graph
        self.task = task
        self.is_trained = False

    def predict_and_write(self, output_table: str, batch_schedule: str = "daily", client: Any = None) -> None:
        """Mocks the write back to Databricks."""
        logger.info(f"Writing Kumo predictions to {output_table} (Schedule: {batch_schedule})")
        
        # We generate a dummy dataframe and use the provided DatabricksClient to write it
        if client:
            df = pd.DataFrame([
                {"crisis_id": "AFG", "sector": "ALL", "predicted_velocity": 0.85},
                {"crisis_id": "YEM", "sector": "ALL", "predicted_velocity": 0.45},
            ])
            client.write_dataframe(df, output_table, mode="overwrite")

def train(graph: Graph, task: PredictionTask) -> Model:
    """Mock RFM training process."""
    logger.info("Training Kumo Relational Foundation Model on Databricks schema...")
    model = Model(graph, task)
    model.is_trained = True
    logger.info("✓ RFM Training complete")
    return model
