"""
Dossier router — CERF Underfunded Emergencies Auto-Dossier Generator.
"""
import json
import os

from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep
from tools.generate_dossier import generate_dossier_impl

router = APIRouter(prefix="/api/dossier", tags=["Dossier"])


@router.get("")
async def generate_dossier(
    crisis_id: str = Query(..., description="Crisis ID, e.g. MOZ_2025_Total"),
    client: ClientDep = None,
    config: ConfigDep = None,
):
    """
    Generate a complete structured CERF UFE Candidate Dossier.
    Includes: crisis summary, funding gap, sector breakdown, donor concentration,
    Kumo AI predictions, data confidence metadata.
    """
    try:
        raw = generate_dossier_impl(client, config, crisis_id)
        data = json.loads(raw)
        if "error" in data:
            raise HTTPException(status_code=404, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/narrative")
async def generate_dossier_narrative(
    crisis_id: str = Query(...),
    client: ClientDep = None,
    config: ConfigDep = None,
):
    """
    Calls Claude to generate the UN-formatted narrative section of the dossier.
    Returns a structured draft: background paragraph, severity analysis, and funding gap justification.
    """
    try:
        from anthropic import Anthropic

        raw = generate_dossier_impl(client, config, crisis_id)
        dossier_data = json.loads(raw)
        if "error" in dossier_data:
            raise HTTPException(status_code=404, detail=dossier_data["error"])

        crisis = dossier_data.get("crisis_summary", {})
        kumo = dossier_data.get("kumo_ai_advanced_predictions", {})
        donors = dossier_data.get("donor_concentration_and_dependency_risk", {})
        confidence = dossier_data.get("data_health_and_confidence", {})

        prompt = f"""You are a senior humanitarian analyst drafting a formal UN CERF Underfunded Emergencies justification.

Write exactly 3 paragraphs:
1. Background: Describe the structural nature of the crisis in {crisis.get('country', crisis_id)}.
2. Severity Analysis: Justify the MismatchScore of {crisis.get('mismatch_score', 'N/A')} using the decomposition factors. Coverage is {crisis.get('coverage_ratio', 'N/A')}.
3. Funding Gap Justification: Explain the absolute funding gap of ${float(crisis.get('requirements_usd', 0) or 0) - float(crisis.get('funding_usd', 0) or 0):,.0f} USD. Include donor concentration risk (HHI: {donors.get('hhi_index', 'N/A')}). Note data confidence: {confidence.get('level', 'UNKNOWN')}.

Rules: No emojis. No markdown headers. Formal UN language only. Cite all numbers."""

        anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")

        response = anthropic_client.messages.create(
            model=model,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        narrative = response.content[0].text if response.content else ""
        return {
            "crisis_id": crisis_id,
            "narrative": narrative,
            "data_basis": {
                "mismatch_score": crisis.get("mismatch_score"),
                "coverage_ratio": crisis.get("coverage_ratio"),
                "confidence_level": confidence.get("level"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
