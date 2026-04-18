"""
Bronze Ingestion — Country-Based Pooled Funds (CBPF).

Reads CBPF allocations from the downloaded CSV and performs required data cleaning.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig

# Basic mapping, normally you would use pycountry
def get_iso3(country_name: str) -> str:
    if not isinstance(country_name, str):
        return "UNK"
    # very simple mapping, add more if necessary or use a library
    mapping = {
        "Afghanistan": "AFG", "Yemen": "YEM", "Syria": "SYR",
        "Ethiopia": "ETH", "Somalia": "SOM", "South Sudan": "SSD",
        "Sudan": "SDN", "DRC": "COD", "Ukraine": "UKR",
        "Nigeria": "NGA", "Niger": "NER", "Mali": "MLI",
        "Burkina Faso": "BFA", "Chad": "TCD", "Cameroon": "CMR",
        "Mozambique": "MOZ", "Myanmar": "MMR", "Bangladesh": "BGD",
        "Pakistan": "PAK", "Haiti": "HTI", "Colombia": "COL",
        "Venezuela": "VEN", "Lebanon": "LBN", "Iraq": "IRQ"
    }
    return mapping.get(country_name, "UNK")

def ingest_cbpf(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Ingest CBPF allocations.
    
    Data cleaning requirements:
    - Country name to ISO3
    - Drop: 'PaidAmtLocal', 'PledgeAmtLocal', 'PaidAmtCurrencyExchangeRate', 
            'PaidAmtLocalCurrency', 'PledgeAmtCurrencyExchangeRate', 
            'PledgeAmtLocalCurrency', 'ExpectedDate'
    - Rename: 'PledgeAmt' -> 'PledgeAmtUSD', 'PaidAmt' -> 'PaidAmtUSD'
    """
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting CBPF Pooled Fund Allocations (CSV)")
    logger.info("─" * 50)

    filepath = config.raw_dir / "cbpf_allocations.csv"
    if not filepath.exists():
        logger.error(f"  ✗ CBPF data not found: {filepath}")
        return pd.DataFrame()

    try:
        df = pd.read_csv(filepath, low_memory=False)
        logger.info(f"  ✓ Loaded {len(df)} records from {filepath.name}")

        # Drop required columns
        cols_to_drop = [
            'PaidAmtLocal', 'PledgeAmtLocal', 'PaidAmtCurrencyExchangeRate', 
            'PaidAmtLocalCurrency', 'PledgeAmtCurrencyExchangeRate', 
            'PledgeAmtLocalCurrency', 'ExpectedDate'
        ]
        df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

        # Rename columns
        rename_map = {
            'PledgeAmt': 'PledgeAmtUSD',
            'PaidAmt': 'PaidAmtUSD',
            'AllocationYear': 'allocation_year',
            'PooledFundName': 'pooled_fund_name',
            'ClusterName': 'cluster_name'
        }
        df = df.rename(columns=rename_map)

        # Normalize column names to snake_case
        import re
        df.columns = [re.sub(r'(?<!^)(?=[A-Z])', '_', c).lower() for c in df.columns]

        # Country name to ISO3
        if "pooled_fund_name" in df.columns:
            # Try to extract country name from pooled fund name e.g. "Afghanistan HF" -> "Afghanistan"
            df["country_name"] = df["pooled_fund_name"].astype(str).str.replace(" HF", "", regex=False).str.replace(" CHF", "", regex=False)
            df["country"] = df["country_name"].apply(get_iso3)
        elif "country" in df.columns:
            df["country"] = df["country"].apply(get_iso3)
        else:
            df["country"] = None

        table_name = config.bronze_table("cbpf_allocations_raw")
        client.write_dataframe(df, table_name, mode="overwrite")

        logger.info(f"✓ Bronze CBPF: {len(df)} allocations → {table_name}")
        return df

    except Exception as e:
        logger.error(f"  ✗ Failed to ingest CBPF data: {e}")
        return pd.DataFrame()
