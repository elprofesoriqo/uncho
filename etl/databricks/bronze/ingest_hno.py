"""
Bronze Ingestion — Humanitarian Needs Overview (HNO) data.

Reads raw HNO CSVs from HDX and loads them into the Bronze layer.
HNO data contains people-in-need figures by country and sector.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

# HNO CSVs use HXL-tagged headers. These are the column mappings we need.
# The actual column names vary by year, so we normalize them here.
HNO_COLUMN_MAP: dict[str, list[str]] = {
    "country": ["country", "adm0_name", "Country", "location", "country_name", "location_name", "country iso3"],
    "iso3": ["iso3", "country_code", "countrycode", "country iso3"],
    "admin1": ["admin1", "adm1_name", "Admin 1 PCode", "Admin 1"],
    "sector": ["sector", "Sector", "cluster"],
    "population": ["population", "Population", "pop"],
    "in_need": ["in need", "inneed", "in_need", "InNeed", "people in need", "people_in_need", "PIN"],
    "targeted": ["targeted", "Targeted", "people targeted", "people_targeted"],
    "affected": ["affected", "Affected", "people affected", "people_affected"],
}


def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Find the first matching column name from a list of candidates."""
    for col in candidates:
        # Case-insensitive match
        matches = [c for c in df.columns if c.lower().strip() == col.lower().strip()]
        if matches:
            return matches[0]
    return None


def _normalize_hno_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize HNO column names to a standard schema."""
    rename_map: dict[str, str] = {}

    for target, candidates in HNO_COLUMN_MAP.items():
        found = _find_column(df, candidates)
        if found:
            rename_map[found] = target

    df = df.rename(columns=rename_map)
    return df


def _read_hno_csv(filepath: Path, year: int) -> pd.DataFrame:
    """Read and normalize a single HNO CSV file.

    HNO CSVs from HDX have HXL tag rows (starting with #) that need to be skipped.
    """
    logger.info(f"  Reading HNO {year}: {filepath.name}")

    # Read with flexible parsing — HNO files have inconsistent formats
    df = pd.read_csv(filepath, encoding="utf-8-sig", on_bad_lines="skip", low_memory=False)

    # Drop HXL tag rows (rows where values start with '#')
    if len(df) > 0:
        first_col = df.columns[0]
        hxl_mask = df[first_col].astype(str).str.startswith("#")
        if hxl_mask.any():
            logger.debug(f"  Dropping {hxl_mask.sum()} HXL header rows")
            df = df[~hxl_mask].reset_index(drop=True)

    # Normalize column names
    df = _normalize_hno_columns(df)

    if "country" not in df.columns and "iso3" in df.columns:
        df["country"] = df["iso3"]

    if "country" not in df.columns:
        df["country"] = "Unknown"

    # Add metadata
    df["year"] = year
    df["source_file"] = filepath.name

    # Convert numeric columns
    for col in ["population", "in_need", "targeted", "affected"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows with no country
    if "country" in df.columns:
        df = df.dropna(subset=["country"])

    row_count = len(df)
    logger.info(f"  ✓ HNO {year}: {row_count} records loaded")
    return df


def ingest_hno(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Ingest all available HNO CSV files into the Bronze layer.

    Reads HNO 2025 and 2026 data, concatenates into a single table,
    and writes to bronze.hno_raw.

    Returns:
        Combined DataFrame of all HNO records
    """
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting Humanitarian Needs Overview (HNO)")
    logger.info("─" * 50)

    frames: list[pd.DataFrame] = []

    # Process each available HNO file
    hno_files = {
        2026: config.raw_dir / "hpc_hno_2026.csv",
        2025: config.raw_dir / "hpc_hno_2025.csv",
    }

    for year, filepath in hno_files.items():
        if filepath.exists():
            try:
                df = _read_hno_csv(filepath, year)
                frames.append(df)
            except Exception as e:
                logger.error(f"  ✗ Failed to read HNO {year}: {e}")
        else:
            logger.warning(f"  ⚠ HNO {year} file not found: {filepath}")

    if not frames:
        logger.error("No HNO data loaded! Check data/raw/ for CSV files.")
        return pd.DataFrame()

    # Combine all years
    combined = pd.concat(frames, ignore_index=True)

    # Standardize columns for Bronze table
    bronze_columns = [
        "country", "iso3", "admin1", "sector", "population",
        "in_need", "targeted", "affected", "year", "source_file",
    ]
    # Keep only columns that exist
    available_cols = [c for c in bronze_columns if c in combined.columns]
    combined = combined[available_cols]

    # Write to Bronze layer
    table_name = config.bronze_table("hno_raw")
    client.write_dataframe(combined, table_name, mode="overwrite")

    logger.info(f"✓ Bronze HNO: {len(combined)} total records → {table_name}")
    return combined
