"""
Crisis router — Single-crisis deep-dive: detail, sector breakdown, donors, related crises.
"""
from fastapi import APIRouter, HTTPException
from cachetools import cached

from backend.deps import ClientDep, ConfigDep, get_crisis_cache

router = APIRouter(prefix="/api/crisis", tags=["Crisis Detail"])


@router.get("/{crisis_id}")
@cached(cache=get_crisis_cache())
async def get_crisis_detail(crisis_id: str, client: ClientDep, config: ConfigDep):
    """
    Full detail panel for a single crisis_id. Used when user clicks a row or a globe country.
    Returns all scored dimensions, all confidence metadata, and Kumo prediction summary.
    """
    try:
        from tools.query_kumo_predictions import query_kumo_predictions_impl
        import json

        table = config.gold_table("crisis_index")
        df = client.query(f"SELECT * FROM {table} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Crisis not found: {crisis_id}")

        crisis = df.iloc[0].fillna(0).to_dict()

        preds_raw = query_kumo_predictions_impl(client, config, crisis_id)
        crisis["kumo_predictions"] = json.loads(preds_raw)

        return {"status": "success", "crisis": crisis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{crisis_id}/sectors")
async def get_crisis_sectors(crisis_id: str, client: ClientDep, config: ConfigDep):
    """
    Sector-level gap decomposition for a crisis.
    Returns per-sector requirements, funding, gap %, and cascade risk from Kumo.
    """
    try:
        import json
        from tools.query_kumo_predictions import query_kumo_predictions_impl

        iso3, year = crisis_id.split("_")[0], crisis_id.split("_")[1] if "_" in crisis_id else None
        table = config.gold_table("crisis_index")

        filters = f"iso3 = '{iso3}'"
        if year:
            filters += f" AND year = '{year}'"

        q = f"""
            SELECT sector,
                   CAST(requirements_usd AS DOUBLE) as requirements_usd,
                   CAST(funding_usd AS DOUBLE) as funding_usd,
                   CAST(coverage_ratio AS DOUBLE) as coverage_ratio,
                   CAST(people_in_need AS DOUBLE) as people_in_need,
                   CAST(mismatch_score AS DOUBLE) as mismatch_score,
                   urgency_weight, confidence_level, crisis_id
            FROM {table}
            WHERE {filters}
            ORDER BY CAST(mismatch_score AS DOUBLE) DESC
        """
        df = client.query(q)
        if df.empty:
            return {"sectors": []}

        sectors = df.fillna(0).to_dict(orient="records")

        # Attach Kumo cascade risk predictions per sector
        preds_raw = query_kumo_predictions_impl(client, config, crisis_id)
        kumo = json.loads(preds_raw)
        cascade = kumo.get("cascade", {})

        for s in sectors:
            s["cascade_risk"] = cascade.get("predicted_cascade_risk")
            s["funding_gap_usd"] = max(0, s["requirements_usd"] - s["funding_usd"])
            s["gap_pct"] = round(1.0 - s["coverage_ratio"], 4) if s["requirements_usd"] > 0 else 0

        return {"crisis_id": crisis_id, "sectors": sectors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{crisis_id}/donors")
async def get_crisis_donors(crisis_id: str, client: ClientDep, config: ConfigDep):
    """
    Donor concentration analysis: HHI index, top donor share, dependency risk.
    """
    try:
        donor_table = config.gold_table("donor_concentration")
        if not client.table_exists(donor_table):
            return {"crisis_id": crisis_id, "donor_data": None, "warning": "Donor concentration not yet computed."}

        df = client.query(f"SELECT * FROM {donor_table} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            return {"crisis_id": crisis_id, "donor_data": None}

        return {"crisis_id": crisis_id, "donor_data": df.fillna(0).to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{crisis_id}/predictions")
async def get_crisis_predictions(crisis_id: str, client: ClientDep, config: ConfigDep):
    """
    All four Kumo RFM prediction outputs for a single crisis:
    velocity, cascade risk, 6-month gap projection, donor behavior.
    """
    try:
        import json
        from tools.query_kumo_predictions import query_kumo_predictions_impl

        raw = query_kumo_predictions_impl(client, config, crisis_id)
        predictions = json.loads(raw)

        if not predictions:
            return {
                "crisis_id": crisis_id,
                "predictions": None,
                "warning": "No Kumo predictions found. Run Kumo inference pipeline first.",
            }
        return {"crisis_id": crisis_id, "predictions": predictions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{crisis_id}/related")
async def get_related_crises(crisis_id: str, client: ClientDep, config: ConfigDep, limit: int = 5):
    """
    Find structurally similar crises (same region, similar coverage ratio, same crisis type).
    Used for the "See similar crises" panel on the detail view.
    """
    try:
        table = config.gold_table("crisis_index")
        base_df = client.query(f"SELECT region, coverage_ratio, crisis_type FROM {table} WHERE crisis_id = '{crisis_id}'")
        if base_df.empty:
            raise HTTPException(status_code=404, detail=f"Crisis not found: {crisis_id}")

        row = base_df.iloc[0]
        region = row.get("region", "")
        cov = float(row.get("coverage_ratio") or 0)
        ctype = row.get("crisis_type", "")

        q = f"""
            SELECT crisis_id, country, sector, year,
                   CAST(mismatch_score AS DOUBLE) as mismatch_score,
                   CAST(coverage_ratio AS DOUBLE) as coverage_ratio,
                   crisis_type, confidence_level
            FROM {table}
            WHERE crisis_id != '{crisis_id}'
              AND is_in_scope = True
              AND region = '{region}'
              AND crisis_type = '{ctype}'
              AND ABS(CAST(coverage_ratio AS DOUBLE) - {cov}) < 0.15
            ORDER BY CAST(mismatch_score AS DOUBLE) DESC
            LIMIT {limit}
        """
        df = client.query(q)
        return {"crisis_id": crisis_id, "related": df.fillna(0).to_dict(orient="records") if not df.empty else []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
