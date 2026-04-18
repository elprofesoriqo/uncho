"""
Export router — Streaming CSV export for rankings, timeline, and sector data.
"""
import csv
import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from backend.deps import ClientDep, ConfigDep

router = APIRouter(prefix="/api/export", tags=["Export"])


def _df_to_csv_stream(df):
    buf = io.StringIO()
    df.fillna("").to_csv(buf, index=False, quoting=csv.QUOTE_NONNUMERIC)
    buf.seek(0)
    return buf.getvalue()


@router.get("/rankings.csv")
async def export_rankings_csv(
    client: ClientDep,
    config: ConfigDep,
    region: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    max_coverage_ratio: Optional[float] = Query(None, alias="maxCoverage"),
    limit: int = Query(500, ge=1, le=2000),
):
    """
    Download the crisis rankings as a CSV file. Respects all standard filter parameters.
    Suitable for import into Excel, R, or Python for analyst workflows.
    """
    try:
        table = config.gold_table("crisis_index")
        q = f"SELECT * FROM {table} WHERE is_in_scope = True"
        if region:
            q += f" AND region = '{region}'"
        if sector:
            q += f" AND sector = '{sector}'"
        if year:
            q += f" AND year = '{year}'"
        if max_coverage_ratio is not None:
            q += f" AND CAST(coverage_ratio AS DOUBLE) <= {max_coverage_ratio}"
        q += f" ORDER BY CAST(mismatch_score_lower_bound AS DOUBLE) DESC LIMIT {limit}"

        df = client.query(q)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found for the given filters.")

        csv_data = _df_to_csv_stream(df)
        filename = f"lighthouse_rankings_{region or 'global'}_{year or 'all'}.csv"

        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeline.csv")
async def export_timeline_csv(
    iso3: str = Query(...),
    sector: str = Query(...),
    client: ClientDep = None,
    config: ConfigDep = None,
):
    """Export the structural timeline for a country/sector as CSV."""
    try:
        table = config.gold_table("crisis_index")
        q = f"""
            SELECT year, requirements_usd, funding_usd, coverage_ratio, people_in_need, crisis_type, confidence_level
            FROM {table}
            WHERE iso3 = '{iso3.upper()}' AND sector = '{sector}'
            ORDER BY year ASC
        """
        df = client.query(q)
        if df.empty:
            raise HTTPException(status_code=404, detail="No timeline data found.")

        csv_data = _df_to_csv_stream(df)
        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=lighthouse_timeline_{iso3}_{sector}.csv"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sectors.csv")
async def export_sector_gaps_csv(
    iso3: str = Query(...),
    year: Optional[int] = Query(None),
    client: ClientDep = None,
    config: ConfigDep = None,
):
    """Export the sector-level funding gap breakdown for a country as CSV."""
    try:
        table = config.gold_table("crisis_index")
        year_filter = f" AND year = '{year}'" if year else ""
        q = f"""
            SELECT sector, requirements_usd, funding_usd, coverage_ratio, people_in_need, mismatch_score, urgency_weight
            FROM {table}
            WHERE iso3 = '{iso3.upper()}' {year_filter}
            ORDER BY CAST(mismatch_score AS DOUBLE) DESC
        """
        df = client.query(q)
        if df.empty:
            raise HTTPException(status_code=404, detail="No sector data found.")

        csv_data = _df_to_csv_stream(df)
        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=lighthouse_sectors_{iso3}.csv"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
