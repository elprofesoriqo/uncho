"""
Geo router — All map layer endpoints for 7 distinct visualization modes.

Modes:
  CHOROPLETH_COVERAGE  — Country fill by coverage_ratio (red=underfunded, green=covered)
  CHOROPLETH_MISMATCH  — Country fill by mismatch_score
  HEATMAP_SEVERITY     — INFORM severity heatmap (point intensity)
  HEATMAP_PIN          — People-in-need heatmap
  BUBBLE_MAP           — Bubble: size=people_in_need, color=coverage_ratio
  FLOW_DONORS          — Arc map: top donor country → recipient country
  PREDICTIVE_RISK      — Kumo predicted coverage change (countries declining in next 6 months)
"""
import json
from typing import Optional

from cachetools import cached
from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep, get_geo_cache

router = APIRouter(prefix="/api/geo", tags=["Geo / Maps"])

_MAP_MODES = {
    "CHOROPLETH_COVERAGE", "CHOROPLETH_MISMATCH", "HEATMAP_SEVERITY",
    "HEATMAP_PIN", "BUBBLE_MAP", "FLOW_DONORS", "PREDICTIVE_RISK",
}


@router.get("/map-data")
@cached(cache=get_geo_cache())
async def get_map_data(
    client: ClientDep,
    config: ConfigDep,
    mode: str = Query("CHOROPLETH_COVERAGE", description=" | ".join(_MAP_MODES)),
    year: Optional[int] = Query(None),
    sector: Optional[str] = Query(None),
):
    """
    Returns layer data optimised for the requested map mode.
    The response schema differs per mode — the frontend switches renderers accordingly.
    """
    if mode not in _MAP_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode. Valid: {sorted(_MAP_MODES)}")

    try:
        table = config.gold_table("crisis_index")
        year_filter = f" AND year = '{year}'" if year else ""
        sector_filter = f" AND sector = '{sector}'" if sector else ""

        if mode in ("CHOROPLETH_COVERAGE", "CHOROPLETH_MISMATCH"):
            q = f"""
                SELECT iso3, country, region,
                       AVG(CAST(coverage_ratio AS DOUBLE)) as coverage_ratio,
                       AVG(CAST(mismatch_score AS DOUBLE)) as mismatch_score,
                       AVG(CAST(mismatch_score_lower_bound AS DOUBLE)) as mismatch_score_lower_bound,
                       SUM(CAST(people_in_need AS DOUBLE)) as people_in_need,
                       SUM(CAST(requirements_usd AS DOUBLE)) as requirements_usd,
                       SUM(CAST(funding_usd AS DOUBLE)) as funding_usd,
                       MAX(crisis_type) as crisis_type
                FROM {table}
                WHERE is_in_scope = True {year_filter} {sector_filter}
                GROUP BY iso3, country, region
            """
            df = client.query(q)
            key = "coverage_ratio" if mode == "CHOROPLETH_COVERAGE" else "mismatch_score"
            return {
                "mode": mode,
                "encoding_field": key,
                "features": df.fillna(0).to_dict(orient="records"),
            }

        elif mode in ("HEATMAP_SEVERITY", "HEATMAP_PIN"):
            q = f"""
                SELECT iso3, country, region,
                       AVG(CAST(inform_severity AS DOUBLE)) as inform_severity,
                       SUM(CAST(people_in_need AS DOUBLE)) as people_in_need,
                       AVG(CAST(coverage_ratio AS DOUBLE)) as coverage_ratio
                FROM {table}
                WHERE is_in_scope = True {year_filter} {sector_filter}
                GROUP BY iso3, country, region
            """
            df = client.query(q)
            intensity_field = "inform_severity" if mode == "HEATMAP_SEVERITY" else "people_in_need"
            return {
                "mode": mode,
                "intensity_field": intensity_field,
                "points": df.fillna(0).to_dict(orient="records"),
            }

        elif mode == "BUBBLE_MAP":
            q = f"""
                SELECT iso3, country, region,
                       SUM(CAST(people_in_need AS DOUBLE)) as people_in_need,
                       AVG(CAST(coverage_ratio AS DOUBLE)) as coverage_ratio,
                       AVG(CAST(mismatch_score AS DOUBLE)) as mismatch_score,
                       MAX(crisis_type) as crisis_type,
                       COUNT(*) as sector_count
                FROM {table}
                WHERE is_in_scope = True {year_filter}
                GROUP BY iso3, country, region
            """
            df = client.query(q)
            return {
                "mode": mode,
                "size_field": "people_in_need",
                "color_field": "coverage_ratio",
                "bubbles": df.fillna(0).to_dict(orient="records"),
            }

        elif mode == "FLOW_DONORS":
            donor_table = config.gold_table("donor_concentration")
            if not client.table_exists(donor_table):
                return {"mode": mode, "flows": [], "warning": "Donor data not yet computed."}
            q = f"""
                SELECT iso3 as recipient_iso3, top_donor as donor_label,
                       CAST(hhi_index AS DOUBLE) as hhi_index,
                       CAST(top_donor_share AS DOUBLE) as top_donor_share
                FROM {donor_table}
                WHERE top_donor IS NOT NULL
                LIMIT 300
            """
            df = client.query(q)
            return {
                "mode": mode,
                "description": "Arc thickness = top donor share. Color = HHI concentration.",
                "flows": df.fillna(0).to_dict(orient="records"),
            }

        elif mode == "PREDICTIVE_RISK":
            gap_table = config.gold_table("kumo_predictions_gap")
            if not client.table_exists(gap_table):
                return {"mode": mode, "features": [], "warning": "Kumo predictions not yet generated."}
            crisis_q = f"""
                SELECT iso3, country, region,
                       AVG(CAST(coverage_ratio AS DOUBLE)) as coverage_ratio
                FROM {table}
                WHERE is_in_scope = True {year_filter}
                GROUP BY iso3, country, region
            """
            crisis_df = client.query(crisis_q)

            kumo_q = f"SELECT crisis_id, predicted_coverage_6m, confidence_lower, confidence_upper FROM {gap_table}"
            kumo_df = client.query(kumo_q)

            if not kumo_df.empty and not crisis_df.empty:
                import pandas as pd
                kumo_df["iso3"] = kumo_df["crisis_id"].str.split("_").str[0]
                merged = crisis_df.merge(
                    kumo_df.groupby("iso3").agg(
                        predicted_coverage_6m=("predicted_coverage_6m", "mean"),
                        confidence_lower=("confidence_lower", "mean"),
                        confidence_upper=("confidence_upper", "mean"),
                    ).reset_index(),
                    on="iso3", how="left"
                )
                merged["predicted_change"] = (
                    merged["predicted_coverage_6m"].fillna(merged["coverage_ratio"]) - merged["coverage_ratio"]
                )
                return {
                    "mode": mode,
                    "description": "predicted_change < 0 means coverage is expected to decline.",
                    "features": merged.fillna(0).to_dict(orient="records"),
                }
            return {"mode": mode, "features": crisis_df.fillna(0).to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/country/{iso3}")
async def get_country_map_detail(iso3: str, client: ClientDep, config: ConfigDep):
    """
    All crisis entries for a specific country — used for the map click-to-drill interaction.
    Returns sector breakdown, timeline data hint, and confidence metadata.
    """
    try:
        table = config.gold_table("crisis_index")
        q = f"""
            SELECT crisis_id, sector, year,
                   CAST(coverage_ratio AS DOUBLE) as coverage_ratio,
                   CAST(mismatch_score AS DOUBLE) as mismatch_score,
                   CAST(people_in_need AS DOUBLE) as people_in_need,
                   CAST(requirements_usd AS DOUBLE) as requirements_usd,
                   CAST(funding_usd AS DOUBLE) as funding_usd,
                   crisis_type, confidence_level, confidence_score
            FROM {table}
            WHERE iso3 = '{iso3.upper()}'
            ORDER BY year DESC, mismatch_score DESC
        """
        df = client.query(q)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for country: {iso3}")
        return {
            "iso3": iso3.upper(),
            "crises": df.fillna(0).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
