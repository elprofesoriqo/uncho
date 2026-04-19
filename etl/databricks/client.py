"""
Databricks SQL Client — Unified interface for all warehouse operations.

Provides both Databricks SQL Connector (for remote warehouse) and DuckDB
(for local development) backends. The rest of the codebase doesn't need
to know which backend is active.
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

import pandas as pd
from loguru import logger

from etl.databricks.config import DatabricksConfig


class DatabricksClient:
    """Unified SQL client that works against Databricks or local DuckDB.

    Usage:
        config = DatabricksConfig()
        client = DatabricksClient(config)
        client.initialize_schemas()
        df = client.query("SELECT * FROM gold.crisis_index LIMIT 10")
    """

    def __init__(self, config: DatabricksConfig) -> None:
        self.config = config
        self._connection: Any = None
        self._backend: str = "none"

    def connect(self) -> None:
        """Establish connection to the appropriate backend."""
        if self.config.is_connected:
            self._connect_databricks()
        else:
            self._connect_duckdb()

    def _connect_databricks(self) -> None:
        """Connect to Databricks SQL Warehouse."""
        try:
            import os
            from databricks import sql as databricks_sql

            # Prevent any browser-based interactive auth fallback.
            os.environ["DATABRICKS_NO_INTERACTIVE"] = "true"

            auth_params = {
                "server_hostname": self.config.host.replace("https://", ""),
                "http_path": self.config.http_path,
            }

            # Prefer OAuth M2M when credentials are present — skips PAT entirely
            # so the SDK never opens a browser for OIDC.
            if self.config.client_id and self.config.client_secret:
                os.environ["DATABRICKS_AUTH_TYPE"] = "oauth-m2m"
                auth_params["auth_type"] = "oauth-m2m"
                auth_params["client_id"] = self.config.client_id
                auth_params["client_secret"] = self.config.client_secret
                self._connection = databricks_sql.connect(**auth_params)
                self._backend = "databricks"
                logger.info(f"Connected to Databricks (OAuth M2M): {self.config.host}")
                return

            # Fall back to PAT only when no M2M credentials are configured.
            if self.config.token:
                os.environ["DATABRICKS_AUTH_TYPE"] = "pat"
                auth_params["auth_type"] = "pat"
                auth_params["access_token"] = self.config.token
                self._connection = databricks_sql.connect(**auth_params)
                self._backend = "databricks"
                logger.info(f"Connected to Databricks (PAT): {self.config.host}")
                return

            raise ValueError("No Databricks credentials configured (need client_id+client_secret or token).")

        except Exception as e:
            logger.warning(f"Databricks connection failed: {e}. Falling back to DuckDB.")
            self._connect_duckdb()

    def _connect_duckdb(self) -> None:
        """Fall back to local DuckDB for development."""
        import duckdb

        db_path = str(self.config.data_dir / "lighthouse_os.duckdb")
        self._connection = duckdb.connect(db_path)
        self._backend = "duckdb"
        logger.info(f"Connected to local DuckDB: {db_path}")

    @contextmanager
    def cursor(self) -> Generator[Any, None, None]:
        """Get a database cursor with automatic cleanup."""
        if self._connection is None:
            self.connect()

        if self._backend == "databricks":
            cur = self._connection.cursor()
            try:
                yield cur
            finally:
                cur.close()
        else:
            # DuckDB uses the connection directly as cursor
            yield self._connection

    def execute(self, sql: str, parameters: dict[str, Any] | None = None) -> None:
        """Execute a SQL statement (no return value)."""
        if self._backend == "duckdb" and self.config.catalog:
            sql = sql.replace(f"{self.config.catalog}.", "")
        with self.cursor() as cur:
            logger.debug(f"SQL [{self._backend}]: {sql[:200]}...")
            if parameters and self._backend == "databricks":
                cur.execute(sql, parameters)
            else:
                cur.execute(sql)

    def query(self, sql: str) -> pd.DataFrame:
        """Execute a SQL query and return results as a DataFrame."""
        if self._backend == "duckdb" and self.config.catalog:
            sql = sql.replace(f"{self.config.catalog}.", "")
        with self.cursor() as cur:
            logger.debug(f"QUERY [{self._backend}]: {sql[:200]}...")
            if self._backend == "databricks":
                cur.execute(sql)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                return pd.DataFrame(rows, columns=columns)
            else:
                return cur.execute(sql).fetchdf()

    def query_scalar(self, sql: str) -> Any:
        """Execute a query and return a single scalar value."""
        df = self.query(sql)
        if df.empty:
            return None
        return df.iloc[0, 0]

    def table_exists(self, full_table_name: str) -> bool:
        """Check if a table exists."""
        if self._connection is None:
            self.connect()
            
        try:
            if self._backend == "databricks":
                self.execute(f"DESCRIBE TABLE {full_table_name}")
            else:
                # For DuckDB, parse schema.table format
                parts = full_table_name.split(".")
                schema = parts[-2] if len(parts) >= 2 else "main"
                table = parts[-1]
                result = self.query(
                    f"SELECT count(*) as cnt FROM information_schema.tables "
                    f"WHERE table_schema = '{schema}' AND table_name = '{table}'"
                )
                return int(result.iloc[0, 0]) > 0
            return True
        except Exception:
            return False

    def write_dataframe(
        self,
        df: pd.DataFrame,
        table_name: str,
        mode: str = "overwrite",
    ) -> None:
        """Write a pandas DataFrame to a table.

        Args:
            df: Data to write
            table_name: Fully qualified table name (catalog.schema.table)
            mode: 'overwrite' replaces the table, 'append' adds rows
        """
        if df.empty:
            logger.warning(f"Empty DataFrame — skipping write to {table_name}")
            return

        if self._backend == "databricks":
            self._write_databricks(df, table_name, mode)
        else:
            self._write_duckdb(df, table_name, mode)

        logger.info(f"Wrote {len(df)} rows to {table_name} (mode={mode})")

    def _write_databricks(self, df: pd.DataFrame, table_name: str, mode: str) -> None:
        """Write DataFrame to Databricks via SQL INSERT or temporary view."""
        # For production: Use databricks-connect with Spark DataFrames
        # For now: batch INSERT via SQL connector
        if mode == "overwrite":
            cols = ", ".join(df.columns)
            col_defs = ", ".join(
                f"{col} STRING" for col in df.columns  # Auto-typed by Databricks
            )
            self.execute(f"CREATE OR REPLACE TABLE {table_name} ({col_defs})")

        # Batch insert
        for start in range(0, len(df), self.config.batch_size):
            batch = df.iloc[start : start + self.config.batch_size]
            values_list = []
            for _, row in batch.iterrows():
                vals = ", ".join(
                    f"'{str(v).replace(chr(39), chr(39)+chr(39))}'" if pd.notna(v) else "NULL"
                    for v in row
                )
                values_list.append(f"({vals})")

            values_str = ",\n".join(values_list)
            cols = ", ".join(df.columns)
            self.execute(f"INSERT INTO {table_name} ({cols}) VALUES {values_str}")

    def _write_duckdb(self, df: pd.DataFrame, table_name: str, mode: str) -> None:
        """Write DataFrame to local DuckDB."""
        # Parse schema from table name (skip catalog for DuckDB)
        parts = table_name.split(".")
        schema = parts[-2] if len(parts) >= 2 else "main"
        table = parts[-1]

        # Ensure schema exists
        self._connection.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")

        qualified = f"{schema}.{table}"

        if mode == "overwrite":
            self._connection.execute(f"DROP TABLE IF EXISTS {qualified}")
            self._connection.execute(
                f"CREATE TABLE {qualified} AS SELECT * FROM df"
            )
        else:
            if self.table_exists(table_name):
                self._connection.execute(
                    f"INSERT INTO {qualified} SELECT * FROM df"
                )
            else:
                self._connection.execute(
                    f"CREATE TABLE {qualified} AS SELECT * FROM df"
                )

    def initialize_schemas(self) -> None:
        """Create the medallion architecture schemas (Bronze/Silver/Gold).

        On Databricks with Unity Catalog: creates catalog + schemas.
        On DuckDB: creates schemas only (no catalog concept).
        """
        if self._connection is None:
            self.connect()

        if self._backend == "databricks":
            try:
                self.execute(f"CREATE CATALOG IF NOT EXISTS {self.config.catalog}")
                logger.info(f"Catalog '{self.config.catalog}' ready")
            except Exception as e:
                logger.warning(
                    f"Could not create catalog (may need Unity Catalog): {e}. "
                    f"Using default catalog."
                )

            self.execute(f"USE CATALOG {self.config.catalog}")
            for schema in [
                self.config.bronze_schema,
                self.config.silver_schema,
                self.config.gold_schema,
            ]:
                self.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
                logger.info(f"Schema '{self.config.catalog}.{schema}' ready")
        else:
            for schema in [
                self.config.bronze_schema,
                self.config.silver_schema,
                self.config.gold_schema,
            ]:
                self.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
                logger.info(f"DuckDB schema '{schema}' ready")

    def close(self) -> None:
        """Close the database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
            logger.info(f"Closed {self._backend} connection")

    def __enter__(self) -> DatabricksClient:
        self.connect()
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    @property
    def backend(self) -> str:
        """Currently active backend: 'databricks' or 'duckdb'."""
        return self._backend
