"""
Databricks workspace configuration and connection settings.

Reads from environment variables (.env file) and provides a validated
configuration object used by all Databricks operations.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

# Load .env from project root
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")


@dataclass(frozen=True)
class DatabricksConfig:
    """Immutable configuration for Databricks connectivity.

    Reads from environment variables with sensible defaults.
    Frozen dataclass ensures config cannot be accidentally mutated at runtime.
    """

    # Connection
    host: str = field(default_factory=lambda: os.environ.get("DATABRICKS_HOST", ""))
    token: str = field(default_factory=lambda: os.environ.get("DATABRICKS_TOKEN", ""))
    client_id: str = field(default_factory=lambda: os.environ.get("DATABRICKS_CLIENT_ID", ""))
    client_secret: str = field(default_factory=lambda: os.environ.get("DATABRICKS_CLIENT_SECRET", ""))
    http_path: str = field(
        default_factory=lambda: os.environ.get("DATABRICKS_HTTP_PATH", "")
    )

    # Catalog & Schema (Medallion Architecture)
    catalog: str = field(
        default_factory=lambda: os.environ.get("DATABRICKS_CATALOG", "lighthouse_os")
    )
    bronze_schema: str = "bronze"
    silver_schema: str = "silver"
    gold_schema: str = "gold"

    # Data directories (local cache for downloaded CSVs)
    data_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("DATA_DIR", str(_project_root / "data")))
    )

    # Pipeline settings
    stale_threshold_hours: int = 24  # Re-download data if older than this
    batch_size: int = 10000  # Rows per batch insert

    def __post_init__(self) -> None:
        """Validate configuration on creation."""
        if not self.host:
            logger.warning(
                "DATABRICKS_HOST not set. Running in local-only mode. "
                "Set DATABRICKS_HOST in .env for Databricks connectivity."
            )
        if self.host and not self.token and not (self.client_id and self.client_secret):
            raise ValueError(
                "DATABRICKS_TOKEN or both DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET "
                "are required when DATABRICKS_HOST is set. "
                "Generate a PAT in Databricks User Settings → Developer → Access Tokens or use a Service Principal."
            )

    @property
    def raw_dir(self) -> Path:
        """Local directory for raw downloaded data files."""
        path = self.data_dir / "raw"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def processed_dir(self) -> Path:
        """Local directory for processed data outputs."""
        path = self.data_dir / "processed"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def geo_dir(self) -> Path:
        """Local directory for GeoJSON files."""
        path = self.data_dir / "geo"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def is_connected(self) -> bool:
        """Whether a Databricks workspace connection is configured."""
        has_auth = bool(self.token) or bool(self.client_id and self.client_secret)
        return bool(self.host and has_auth)

    def table_name(self, schema: str, table: str) -> str:
        """Returns fully qualified table name: catalog.schema.table (or schema.table for DuckDB)"""
        if not self.is_connected:
            return f"{schema}.{table}"
        return f"{self.catalog}.{schema}.{table}"

    def bronze_table(self, table: str) -> str:
        """Shortcut for bronze layer table names."""
        return self.table_name(self.bronze_schema, table)

    def silver_table(self, table: str) -> str:
        """Shortcut for silver layer table names."""
        return self.table_name(self.silver_schema, table)

    def gold_table(self, table: str) -> str:
        """Shortcut for gold layer table names."""
        return self.table_name(self.gold_schema, table)

    def log_config(self) -> None:
        """Log the current configuration (masking sensitive values)."""
        logger.info("Databricks Configuration:")
        logger.info(f"  Host:           {self.host or '(not set — local mode)'}")
        logger.info(f"  Catalog:        {self.catalog}")
        logger.info(f"  Schemas:        {self.bronze_schema} / {self.silver_schema} / {self.gold_schema}")
        logger.info(f"  Data Dir:       {self.data_dir}")
        logger.info(f"  Token:          {'****' + self.token[-4:] if self.token else '(not set)'}")
        logger.info(f"  Client ID:      {self.client_id if self.client_id else '(not set)'}")
        logger.info(f"  HTTP Path:      {self.http_path or '(not set)'}")
        logger.info(f"  Connected:      {self.is_connected}")
