"""
Timeline router — Multi-year structural trend data + Kumo 6-month projections.
"""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep

router = APIRouter(prefix="/api/timeline", tags=["Timeline"])


@router.get("")
async def get_structural_timeline(
    iso3: str = Query(..., description="3-letter country code"),
    sector: str = Query(..., description="Sector name"),
    client: ClientDep = None,
    config: ConfigDep = None,
):
    """
    Multi-Year Structural Timeline for a specific iso3 + sector pair.
    Returns full historical series (all years), Kumo 6-month projection,
    and structural classification (CHRONIC vs ACUTE vs RECOVERING).
    """
    try:
        from tools.query_kumo_predictions import query_kumo_predictions_impl

        table = config.gold_table("crisis_index")
        q = f"""
            SELECT year,
                   CAST(requirements_usd AS DOUBLE) as requirements_usd,
                   CAST(funding_usd AS DOUBLE) as funding_usd,
                   CAST(coverage_ratio AS DOUBLE) as coverage_ratio,
                   CAST(people_in_need AS DOUBLE) as people_in_need,
                   crisis_type, confidence_level
            FROM {table}
            WHERE iso3 = '{iso3.upper()}' AND sector = '{sector}'
            ORDER BY year ASC
        """
        df = client.query(q)

        historical = df.fillna(0).to_dict(orient="records") if not df.empty else []

        latest_year = str(df["year"].max()) if not df.empty else "2025"
        crisis_id = f"{iso3.upper()}_{latest_year}_{sector}"

        preds_raw = query_kumo_predictions_impl(client, config, crisis_id)
        predictions = json.loads(preds_raw)

        # Classify the structural pattern
        classification = "UNKNOWN"
        if historical and len(historical) >= 3:
            recent = [float(h["coverage_ratio"]) for h in historical[-3:]]
            avg_recent = sum(recent) / len(recent)
            if all(r < 0.5 for r in recent):
                if recent[-1] < recent[0]:
                    classification = "CHRONIC_DECLINING"
                elif recent[-1] > recent[0] + 0.05:
                    classification = "RECOVERING"
                else:
                    classification = "CHRONIC_STABLE"
            elif recent[-1] < recent[-2] - 0.1:
                classification = "ACUTE_DECLINE"
            else:
                classification = "ADEQUATE"

        return {
            "status": "success",
            "crisis_id": crisis_id,
            "iso3": iso3.upper(),
            "sector": sector,
            "structural_classification": classification,
            "historical_trend": historical,
            "projection": predictions.get("gap", {}),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/global")
async def get_global_funding_trend(
    client: ClientDep,
    config: ConfigDep,
    region: Optional[str] = Query(None),
):
    """
    Global or regional aggregate funding trend across all years in the data.
    Used for the macro context panel on the dashboard.
    """
    try:
        table = config.gold_table("crisis_index")
        region_filter = f"AND region = '{region}'" if region else ""
        q = f"""
            SELECT year,
                   SUM(CAST(requirements_usd AS DOUBLE)) as total_requirements_usd,
                   SUM(CAST(funding_usd AS DOUBLE)) as total_funding_usd,
                   COUNT(DISTINCT iso3) as active_countries,
                   SUM(CAST(people_in_need AS DOUBLE)) as total_people_in_need,
                   AVG(CAST(coverage_ratio AS DOUBLE)) as avg_coverage_ratio
            FROM {table}
            WHERE is_in_scope = True {region_filter}
            GROUP BY year
            ORDER BY year ASC
        """
        df = client.query(q)
        trend = df.fillna(0).to_dict(orient="records") if not df.empty else []

        for row in trend:
            reqs = float(row.get("total_requirements_usd") or 0)
            fund = float(row.get("total_funding_usd") or 0)
            row["total_funding_gap_usd"] = max(0, reqs - fund)

        return {"status": "success", "region": region, "trend": trend}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
