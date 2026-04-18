"""
Silver Layer — Country Normalization & ISO3 Standardization.

Humanitarian datasets use inconsistent country names across sources.
This module normalizes everything to ISO 3166-1 alpha-3 codes and assigns
UN regional groupings.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.schemas import get_region

# =============================================================================
# Country Name → ISO3 Mapping
# Covers all countries that appear in HNO/FTS/HRP humanitarian data.
# This is manually curated because automated matching is unreliable for
# contested territories and UN-specific naming conventions.
# =============================================================================

COUNTRY_TO_ISO3: dict[str, str] = {
    # Standard names
    "Afghanistan": "AFG",
    "Bangladesh": "BGD",
    "Burkina Faso": "BFA",
    "Burundi": "BDI",
    "Cameroon": "CMR",
    "Central African Republic": "CAF",
    "Chad": "TCD",
    "Colombia": "COL",
    "Democratic Republic of the Congo": "COD",
    "El Salvador": "SLV",
    "Ethiopia": "ETH",
    "Guatemala": "GTM",
    "Haiti": "HTI",
    "Honduras": "HND",
    "Iraq": "IRQ",
    "Kenya": "KEN",
    "Lebanon": "LBN",
    "Libya": "LBY",
    "Madagascar": "MDG",
    "Mali": "MLI",
    "Mozambique": "MOZ",
    "Myanmar": "MMR",
    "Niger": "NER",
    "Nigeria": "NGA",
    "Pakistan": "PAK",
    "Philippines": "PHL",
    "Somalia": "SOM",
    "South Sudan": "SSD",
    "Sudan": "SDN",
    "Syrian Arab Republic": "SYR",
    "Ukraine": "UKR",
    "Venezuela (Bolivarian Republic of)": "VEN",
    "Yemen": "YEM",
    "Zimbabwe": "ZWE",

    # Common alternative names in UN data
    "DRC": "COD",
    "DR Congo": "COD",
    "Dem. Rep. Congo": "COD",
    "Congo, Dem. Rep.": "COD",
    "Congo (the Democratic Republic of the)": "COD",
    "Syria": "SYR",
    "Venezuela": "VEN",
    "Bolivia": "BOL",
    "Bolivia (Plurinational State of)": "BOL",
    "Iran": "IRN",
    "Iran (Islamic Republic of)": "IRN",
    "North Korea": "PRK",
    "Korea (Democratic People's Republic of)": "PRK",
    "occupied Palestinian territory": "PSE",
    "State of Palestine": "PSE",
    "Palestine": "PSE",
    "oPt": "PSE",
    "Türkiye": "TUR",
    "Turkey": "TUR",
    "Ivory Coast": "CIV",
    "Côte d'Ivoire": "CIV",
    "Eswatini": "SWZ",
    "Swaziland": "SWZ",
    "Tanzania": "TZA",
    "United Republic of Tanzania": "TZA",
    "Lao People's Democratic Republic": "LAO",
    "Laos": "LAO",
}


def _resolve_iso3(country_name: str, existing_iso3: str | None = None) -> str | None:
    """Resolve a country name to its ISO3 code.

    First checks if an ISO3 is already provided in the data.
    Falls back to the curated lookup table.
    """
    # If ISO3 already provided and valid (3 uppercase letters)
    if existing_iso3 and isinstance(existing_iso3, str) and len(existing_iso3) == 3:
        return existing_iso3.upper()

    # Look up in our mapping
    if country_name in COUNTRY_TO_ISO3:
        return COUNTRY_TO_ISO3[country_name]

    # Try case-insensitive match
    name_lower = country_name.strip().lower()
    for key, val in COUNTRY_TO_ISO3.items():
        if key.lower() == name_lower:
            return val

    # Try partial match (last resort)
    for key, val in COUNTRY_TO_ISO3.items():
        if name_lower in key.lower() or key.lower() in name_lower:
            return val

    return None


def normalize_countries(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Build the Silver crisis_universe table — deduplicated list of all crises with ISO3.

    Reads from Bronze HNO, FTS, and HRP tables to compile a master list of
    all countries with humanitarian activity, enriched with ISO3 codes and regions.

    Returns:
        DataFrame of the crisis universe
    """
    logger.info("─" * 50)
    logger.info("SILVER: Normalizing country identifiers")
    logger.info("─" * 50)

    all_countries: set[str] = set()

    # Collect country names from all Bronze sources
    for table_suffix in ["hno_raw", "fts_global_raw", "fts_cluster_raw"]:
        table_name = config.bronze_table(table_suffix)
        if client.table_exists(table_name):
            try:
                df = client.query(f"SELECT DISTINCT country FROM {table_name} WHERE country IS NOT NULL")
                for c in df["country"].dropna().unique():
                    for split_c in str(c).split("|"):
                        all_countries.add(split_c.strip())
            except Exception as e:
                logger.warning(f"  Could not read {table_name}: {e}")

    logger.info(f"  Found {len(all_countries)} unique country names across all sources")

    # Resolve ISO3 codes
    records = []
    unresolved = []

    for country in sorted(all_countries):
        iso3 = _resolve_iso3(country)
        if iso3:
            records.append({
                "iso3": iso3,
                "country": country,
                "region": get_region(iso3),
            })
        else:
            unresolved.append(country)

    if unresolved:
        logger.warning(f"  ⚠ {len(unresolved)} countries could not be resolved to ISO3:")
        for name in unresolved[:10]:
            logger.warning(f"    - {name}")
        if len(unresolved) > 10:
            logger.warning(f"    ... and {len(unresolved) - 10} more")

    # Deduplicate by ISO3 (keep first country name encountered)
    universe_df = pd.DataFrame(records)
    if not universe_df.empty:
        universe_df = universe_df.drop_duplicates(subset=["iso3"], keep="first")

    # Write to Silver
    table_name = config.silver_table("crisis_universe")
    client.write_dataframe(universe_df, table_name, mode="overwrite")

    logger.info(f"✓ Silver Crisis Universe: {len(universe_df)} countries → {table_name}")
    return universe_df
