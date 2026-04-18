"""
Bronze Ingestion — ReliefWeb Assessments (Layer 5A).

Dynamically fetches the latest humanitarian assessment PDF from the ReliefWeb API,
passes it to Claude to extract structured data (Country, People in Need, Sectors, Funding),
and writes it to the Bronze layer.
"""

from __future__ import annotations

import asyncio
import httpx
import pandas as pd
from loguru import logger

from etl.databricks.client import DatabricksClient
from etl.databricks.config import DatabricksConfig
from etl.databricks.intelligence.document_parser import ReliefWebParser

async def _get_latest_assessment_pdf() -> str | None:
    """Fetch the URL of the most recent PDF assessment from ReliefWeb API."""
    # Query for recent reports that are "Assessments" or "Appeals" with a PDF format
    url = (
        "https://api.reliefweb.int/v2/reports"
        "?appname=lighthouse"
        "&query[value]=(format.name:\"Appeal\" OR format.name:\"Assessment\")"
        "&filter[field]=file.format&filter[value]=pdf"
        "&sort[]=date:desc"
        "&limit=1"
        "&fields[include][]=file.url"
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()
            
        if data.get("data") and "file" in data["data"][0]["fields"]:
            pdf_url = data["data"][0]["fields"]["file"][0]["url"]
            return pdf_url
    except Exception as e:
        logger.error(f"Failed to fetch from ReliefWeb API: {e}")
    return None

async def _parse_pdf() -> dict:
    pdf_url = await _get_latest_assessment_pdf()
    if not pdf_url:
        return {"error": "No recent PDF found on ReliefWeb."}
        
    logger.info(f"  Found recent ReliefWeb PDF: {pdf_url}")
    parser = ReliefWebParser()
    result = await parser.parse_assessment(pdf_url)
    return result

def ingest_reliefweb(client: DatabricksClient, config: DatabricksConfig) -> pd.DataFrame:
    """Ingest the latest ReliefWeb assessment via Claude extraction."""
    logger.info("─" * 50)
    logger.info("BRONZE: Ingesting ReliefWeb Assessments (Layer 5A - Claude)")
    logger.info("─" * 50)
    
    result = asyncio.run(_parse_pdf())
    
    if "error" in result:
        logger.error(f"  ✗ Failed to parse assessment: {result['error']}")
        return pd.DataFrame()
        
    # Convert structured dictionary to DataFrame
    df = pd.DataFrame([result])
    
    # Ensure it's not totally empty (e.g. Claude returned nothing)
    if df.empty or len(df.columns) == 0:
        logger.warning("  ⚠ Claude returned empty structured data.")
        return pd.DataFrame()
        
    # Write to Bronze
    table_name = config.bronze_table("reliefweb_parsed_raw")
    client.write_dataframe(df, table_name, mode="overwrite")
    
    logger.info(f"✓ Bronze ReliefWeb: 1 assessment parsed → {table_name}")
    logger.info(f"  Extracted Country: {result.get('country_region')}")
    logger.info(f"  Extracted PIN: {result.get('estimated_people_in_need')}")
    
    return df
