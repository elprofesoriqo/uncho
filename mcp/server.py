from typing import Optional
from mcp.server.fastmcp import FastMCP
from etl.databricks.config import DatabricksConfig
from etl.databricks.client import DatabricksClient
import json

from tools.query_rankings import query_rankings_impl
from tools.simulate_impact import simulate_impact_impl
from tools.generate_dossier import generate_dossier_impl
from tools.check_data_health import check_data_health_impl
from tools.query_kumo_predictions import query_kumo_predictions_impl

# Initialize FastMCP Server
mcp = FastMCP("lighthouse-os")

# Databricks context
config = DatabricksConfig()
client = DatabricksClient(config)

@mcp.tool()
def query_crisis_rankings(
    region: str | None = None,
    min_people_in_need: int | None = None,
    max_coverage_ratio: float | None = None,
    sector: str | None = None,
    year: int | None = None,
    limit: int = 10,
    include_predictions: bool = True
) -> str:
    """
    Query the ranked crisis index with optional filters.
    Returns crises ordered by MismatchScore with confidence scores.
    """
    return query_rankings_impl(client, config, region, min_people_in_need, max_coverage_ratio, sector, year, limit, include_predictions)

@mcp.tool()
def simulate_funding_impact(
    crisis_id: str,
    additional_funding_usd: float
) -> str:
    """
    Simulate the impact of a hypothetical funding allocation.
    Returns new coverage ratio, new global rank, estimated additional people reached.
    """
    return simulate_impact_impl(client, config, crisis_id, additional_funding_usd)

@mcp.tool()
def generate_cerf_dossier(crisis_id: str) -> str:
    """
    Generate a complete CERF Underfunded Emergencies candidate dossier data.
    Includes: severity data, funding gaps, sector breakdown, structural profile, Kumo predictions.
    """
    return generate_dossier_impl(client, config, crisis_id)

@mcp.tool()
def check_data_health(iso3: str | None = None) -> str:
    """
    Returns data freshness, completeness, and quality metrics for a given country or globally.
    """
    return check_data_health_impl(client, config, iso3)

@mcp.tool()
def query_kumo_predictions(crisis_id: str) -> str:
    """
    Query Kumo RFM predictions (Velocity, Cascading Risk, Gap Projection, Donor Behavior) for a crisis.
    """
    return query_kumo_predictions_impl(client, config, crisis_id)

if __name__ == "__main__":
    mcp.run()
