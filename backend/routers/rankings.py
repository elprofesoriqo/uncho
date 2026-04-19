"""
Rankings router — Crisis Universe with full filter/sort/pagination.
"""
import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep

router = APIRouter(prefix="/api/rankings", tags=["Rankings"])

# Simple async-safe TTL cache
_rankings_cache: dict = {}
_CACHE_TTL = 60


def _build_ranking_query(config, region, sector, year, min_pin, max_cov,
                          min_score, crisis_type, confidence_level,
                          sort_by, sort_order, limit, offset) -> str:
    table = config.gold_table("crisis_index")

    safe_sort_cols = {
        "mismatch_score_lower_bound", "mismatch_score", "coverage_ratio",
        "people_in_need", "requirements_usd", "funding_usd", "global_rank",
        "inform_severity", "structural_multiplier", "confidence_score"
    }
    col = sort_by if sort_by in safe_sort_cols else "mismatch_score_lower_bound"
    order = "DESC" if sort_order.upper() == "DESC" else "ASC"

    q = f"SELECT * FROM {table} WHERE is_in_scope = True"
    if region:
        q += f" AND region = '{region}'"
    if sector:
        q += f" AND sector = '{sector}'"
    if year:
        q += f" AND year = '{year}'"
    if min_pin is not None:
        q += f" AND CAST(people_in_need AS DOUBLE) >= {min_pin}"
    if max_cov is not None:
        q += f" AND CAST(coverage_ratio AS DOUBLE) <= {max_cov}"
    if min_score is not None:
        q += f" AND CAST(mismatch_score AS DOUBLE) >= {min_score}"
    if crisis_type:
        q += f" AND crisis_type = '{crisis_type}'"
    if confidence_level:
        q += f" AND confidence_level = '{confidence_level}'"

    q += f" ORDER BY CAST({col} AS DOUBLE) {order} LIMIT {limit} OFFSET {offset}"
    return q


@router.get("")
async def get_rankings(
    client: ClientDep,
    config: ConfigDep,
    region: Optional[str] = Query(None, description="e.g. Africa, Middle East"),
    sector: Optional[str] = Query(None, description="e.g. Health, WASH, Food Security"),
    year: Optional[int] = Query(None),
    min_people_in_need: Optional[int] = Query(None, alias="minPin"),
    max_coverage_ratio: Optional[float] = Query(None, alias="maxCoverage", ge=0, le=1),
    min_mismatch_score: Optional[float] = Query(None, alias="minScore"),
    crisis_type: Optional[str] = Query(None, alias="crisisType", description="STRUCTURAL | ACUTE | RECOVERING"),
    confidence_level: Optional[str] = Query(None, alias="confidence", description="HIGH | MEDIUM | LOW"),
    sort_by: str = Query("mismatch_score_lower_bound", alias="sortBy"),
    sort_order: str = Query("DESC", alias="sortOrder", pattern="^(ASC|DESC)$"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Full Crisis Universe with advanced filtering, sorting and pagination.
    Supports 9 independent filter dimensions and any column sort.
    """
    cache_key = f"{region}|{sector}|{year}|{min_people_in_need}|{max_coverage_ratio}|{min_mismatch_score}|{crisis_type}|{confidence_level}|{sort_by}|{sort_order}|{limit}|{offset}"
    now = time.time()
    if cache_key in _rankings_cache and now - _rankings_cache[cache_key]["ts"] < _CACHE_TTL:
        return _rankings_cache[cache_key]["data"]

    try:
        q = _build_ranking_query(
            config, region, sector, year, min_people_in_need, max_coverage_ratio,
            min_mismatch_score, crisis_type, confidence_level,
            sort_by, sort_order, limit, offset
        )
        df = client.query(q)
        if df.empty:
            return {"status": "success", "total": 0, "crises": []}

        df = df.fillna(0)
        result = {
            "status": "success",
            "filters_applied": {
                "region": region, "sector": sector, "year": year,
                "maxCoverage": max_coverage_ratio, "crisisType": crisis_type
            },
            "pagination": {"limit": limit, "offset": offset},
            "total": len(df),
            "crises": df.to_dict(orient="records"),
        }
        _rankings_cache[cache_key] = {"ts": now, "data": result}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meta/filters")
async def get_filter_options(client: ClientDep, config: ConfigDep):
    """
    Returns all distinct values available for each filter dimension.
    Used by the frontend to populate filter dropdowns.
    """
    try:
        table = config.gold_table("crisis_index")
        regions = client.query(f"SELECT DISTINCT region FROM {table} WHERE region IS NOT NULL ORDER BY region")
        sectors = client.query(f"SELECT DISTINCT sector FROM {table} WHERE sector IS NOT NULL ORDER BY sector")
        years = client.query(f"SELECT DISTINCT year FROM {table} WHERE year IS NOT NULL ORDER BY year DESC")
        return {
            "regions": regions["region"].tolist() if not regions.empty else [],
            "sectors": sectors["sector"].tolist() if not sectors.empty else [],
            "years": years["year"].tolist() if not years.empty else [],
            "crisis_types": ["STRUCTURAL", "ACUTE", "RECOVERING"],
            "confidence_levels": ["HIGH", "MEDIUM", "LOW"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meta/summary")
async def get_summary_stats(client: ClientDep, config: ConfigDep):
    """
    Global summary statistics: total crises, total funding gap, average coverage.
    Used for the header KPI cards on the dashboard.
    """
    try:
        table = config.gold_table("crisis_index")
        q = f"""
            SELECT
                COUNT(*) as total_crises,
                SUM(CAST(requirements_usd AS DOUBLE)) as total_requirements_usd,
                SUM(CAST(funding_usd AS DOUBLE)) as total_funding_usd,
                AVG(CAST(coverage_ratio AS DOUBLE)) as avg_coverage_ratio,
                SUM(CAST(people_in_need AS DOUBLE)) as total_people_in_need,
                COUNT(CASE WHEN CAST(coverage_ratio AS DOUBLE) < 0.30 THEN 1 END) as critically_underfunded_count
            FROM {table}
            WHERE is_in_scope = True
        """
        df = client.query(q)
        if df.empty:
            return {}
        row = df.iloc[0].to_dict()
        total_reqs = float(row.get("total_requirements_usd") or 0)
        total_fund = float(row.get("total_funding_usd") or 0)
        return {
            "total_active_crises": int(row.get("total_crises") or 0),
            "total_requirements_usd": total_reqs,
            "total_funding_usd": total_fund,
            "total_funding_gap_usd": total_reqs - total_fund,
            "average_global_coverage_ratio": float(row.get("avg_coverage_ratio") or 0),
            "total_people_in_need": float(row.get("total_people_in_need") or 0),
            "critically_underfunded_count": int(row.get("critically_underfunded_count") or 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
