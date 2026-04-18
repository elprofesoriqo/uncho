"""
Data Health router — Transparency Matrix and per-country data quality.
"""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep

router = APIRouter(prefix="/api/data-health", tags=["Data Health"])


@router.get("")
async def get_data_health(
    client: ClientDep,
    config: ConfigDep,
    iso3: Optional[str] = Query(None, description="Filter to a single country"),
):
    """
    Data Health & Transparency Matrix.
    Returns freshness, completeness, and data source quality for every active crisis.
    Used to color the health matrix on the dashboard — same data that powers Claude's confidence guardrails.
    """
    try:
        from tools.check_data_health import check_data_health_impl

        raw = check_data_health_impl(client, config, iso3)
        data = json.loads(raw)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{iso3}")
async def get_country_data_health(iso3: str, client: ClientDep, config: ConfigDep):
    """
    Country-specific data health deep-dive.
    Shows which data sources are present, stale, or missing for a specific country.
    """
    try:
        from tools.check_data_health import check_data_health_impl

        raw = check_data_health_impl(client, config, iso3.upper())
        data = json.loads(raw)
        if "error" in data:
            raise HTTPException(status_code=404, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/coverage")
async def get_source_coverage(client: ClientDep, config: ConfigDep):
    """
    Returns a matrix of data source coverage across all countries.
    Columns: HNO, FTS, INFORM, CBPF, ReliefWeb, ACLED.
    Used to render the Data Source Coverage grid on the frontend.
    """
    try:
        table = config.gold_table("crisis_index")
        q = f"""
            SELECT DISTINCT iso3, country,
                   CASE WHEN CAST(people_in_need AS DOUBLE) > 0 THEN 1 ELSE 0 END as has_hno,
                   CASE WHEN CAST(requirements_usd AS DOUBLE) > 0 THEN 1 ELSE 0 END as has_fts,
                   CASE WHEN CAST(inform_severity AS DOUBLE) > 0 THEN 1 ELSE 0 END as has_inform,
                   CASE WHEN CAST(confidence_score AS DOUBLE) >= 0.7 THEN 'HIGH'
                        WHEN CAST(confidence_score AS DOUBLE) >= 0.4 THEN 'MEDIUM'
                        ELSE 'LOW' END as data_completeness
            FROM {table}
            WHERE is_in_scope = True
            ORDER BY iso3
        """
        df = client.query(q)
        return {
            "status": "success",
            "source_matrix": df.fillna(0).to_dict(orient="records") if not df.empty else [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
