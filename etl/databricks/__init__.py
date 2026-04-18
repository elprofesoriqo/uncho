"""
Lighthouse OS — Databricks Data Foundation Layer

This package implements the medallion architecture (Bronze → Silver → Gold)
for ingesting, normalizing, and computing humanitarian gap analysis data.
"""

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

__all__ = ["DatabricksConfig", "DatabricksClient"]
