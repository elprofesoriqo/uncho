"""
Narrative router — Human-centric metrics, Insight Cards, AI Tutor.
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.deps import ClientDep, ConfigDep
from backend.models import InsightCardRequest

router = APIRouter(prefix="/api/narrative", tags=["Narrative"])

_FUNDING_MECHANISMS = {
    "CERF": (
        "The Central Emergency Response Fund (CERF) is a UN pooled fund that provides "
        "rapid initial funding for life-saving humanitarian action in emergencies worldwide. "
        "CERF has two grant windows: a Rapid Response window for sudden-onset crises, and an "
        "Underfunded Emergencies (UFE) window for neglected, chronic crises."
    ),
    "CBPF": (
        "Country-Based Pooled Funds (CBPFs) are emergency funds managed by OCHA in specific "
        "crisis-affected countries. They pool contributions from donors and allocate them to "
        "NGOs and UN agencies for targeted humanitarian response."
    ),
    "HRP": (
        "A Humanitarian Response Plan (HRP) is the annual funding appeal document produced by "
        "the humanitarian community in a country. It defines priority needs, response strategies, "
        "and funding requirements by sector. The coverage ratio measures how much of this plan is funded."
    ),
    "MismatchScore": (
        "The MismatchScore is Lighthouse OS's composite ranking metric. It is computed as: "
        "NeedWeight * GapSeverity * StructuralMultiplier * VisibilityPenalty * UrgencyWeight. "
        "A higher score indicates a more overlooked crisis — severe need combined with minimal funding."
    ),
    "HHI": (
        "The Herfindahl-Hirschman Index (HHI) measures donor concentration. An HHI above 0.25 "
        "signals dangerous single-donor dependency, where a crisis's funding collapses if one "
        "donor withdraws. An HHI below 0.15 indicates a resilient, diversified donor base."
    ),
}


@router.get("/{crisis_id}")
async def get_crisis_narrative(crisis_id: str, client: ClientDep, config: ConfigDep):
    """
    Human-centric narrative metrics for a crisis.
    Translates technical ratios into plain-language impact statements.
    E.g. "For every $1 needed to save lives in Chad, only $0.14 has arrived."
    """
    try:
        table = config.gold_table("crisis_index")
        df = client.query(f"SELECT * FROM {table} WHERE crisis_id = '{crisis_id}'")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Crisis not found: {crisis_id}")

        row = df.iloc[0].fillna(0).to_dict()
        country = row.get("country", crisis_id)
        cov = float(row.get("coverage_ratio") or 0)
        reqs = float(row.get("requirements_usd") or 0)
        fund = float(row.get("funding_usd") or 0)
        pin = float(row.get("people_in_need") or 0)
        score = float(row.get("mismatch_score") or 0)
        inform = float(row.get("inform_severity") or 0)

        gap_usd = max(0, reqs - fund)
        cents_per_dollar = round(cov * 100, 1)
        cost_per_person = round(reqs / pin, 0) if pin > 0 else None

        narratives = [
            f"For every dollar needed to save lives in {country}, only {cents_per_dollar} cents has arrived.",
            f"An estimated {int(pin):,} people are in need of humanitarian assistance in {country}.",
        ]
        if gap_usd > 0:
            narratives.append(
                f"A funding gap of ${gap_usd:,.0f} USD remains unfilled in {country}'s current appeal."
            )
        if cost_per_person:
            narratives.append(
                f"Based on historical cost data, filling the gap could reach an additional "
                f"{int(gap_usd / cost_per_person):,} people."
            )
        if inform >= 4.5:
            narratives.append(
                f"{country} has a maximum INFORM severity rating of {inform:.1f}/5.0, placing it among "
                f"the world's most severe humanitarian emergencies."
            )
        if score > 1.0:
            narratives.append(
                f"With a MismatchScore of {score:.2f}, {country} is classified as structurally neglected — "
                f"severe need persists year after year with insufficient international response."
            )

        return {
            "crisis_id": crisis_id,
            "country": country,
            "summary_metrics": {
                "coverage_ratio": cov,
                "funding_gap_usd": gap_usd,
                "people_in_need": int(pin),
                "cents_per_dollar_needed": cents_per_dollar,
                "mismatch_score": score,
            },
            "human_narratives": narratives,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insight-card")
async def generate_insight_card(body: InsightCardRequest, client: ClientDep, config: ConfigDep):
    """
    Generate structured data for a shareable insight card infographic.
    The frontend renders this as a PNG/SVG using D3 for social media export.
    Card types: FUNDING_GAP | MISMATCH_RANK | SECTOR_BREAKDOWN | DONOR_RISK
    """
    try:
        table = config.gold_table("crisis_index")
        df = client.query(f"SELECT * FROM {table} WHERE crisis_id = '{body.crisis_id}'")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Crisis not found: {body.crisis_id}")

        row = df.iloc[0].fillna(0).to_dict()
        country = row.get("country", body.crisis_id)
        cov = float(row.get("coverage_ratio") or 0)
        reqs = float(row.get("requirements_usd") or 0)
        fund = float(row.get("funding_usd") or 0)
        pin = float(row.get("people_in_need") or 0)
        score = float(row.get("mismatch_score") or 0)
        rank = int(row.get("global_rank") or 0)

        if body.card_type == "FUNDING_GAP":
            return {
                "card_type": "FUNDING_GAP",
                "title": f"{country} — Funding Gap",
                "headline": f"Only {round(cov * 100, 1)}% funded",
                "subtext": f"${max(0, reqs - fund):,.0f} USD gap remains",
                "chart_data": [
                    {"label": "Funded", "value": fund, "color": "#22c55e"},
                    {"label": "Gap", "value": max(0, reqs - fund), "color": "#ef4444"},
                ],
                "attribution": "Data: UN OCHA FTS / Lighthouse OS",
            }
        elif body.card_type == "MISMATCH_RANK":
            return {
                "card_type": "MISMATCH_RANK",
                "title": f"{country} — Most Overlooked Crisis",
                "headline": f"Ranked #{rank} globally",
                "subtext": f"MismatchScore: {score:.3f}",
                "factors": {
                    "need_weight": float(row.get("need_weight") or 0),
                    "gap_severity": float(row.get("gap_severity") or 0),
                    "structural_multiplier": float(row.get("structural_multiplier") or 1),
                    "urgency_weight": float(row.get("urgency_weight") or 1),
                    "visibility_penalty": float(row.get("visibility_penalty") or 1),
                },
                "attribution": "Data: UN OCHA / INFORM / Lighthouse OS",
            }
        elif body.card_type == "SECTOR_BREAKDOWN":
            iso3, year = body.crisis_id.split("_")[0], body.crisis_id.split("_")[1] if "_" in body.crisis_id else "2025"
            sector_df = client.query(
                f"SELECT sector, CAST(coverage_ratio AS DOUBLE) as cov, "
                f"CAST(requirements_usd AS DOUBLE) as reqs FROM {table} "
                f"WHERE iso3 = '{iso3}' AND year = '{year}' ORDER BY cov ASC LIMIT 8"
            )
            return {
                "card_type": "SECTOR_BREAKDOWN",
                "title": f"{country} — Sector Funding Coverage",
                "sectors": sector_df.fillna(0).to_dict(orient="records") if not sector_df.empty else [],
                "attribution": "Data: UN OCHA FTS / Lighthouse OS",
            }
        elif body.card_type == "DONOR_RISK":
            donor_table = config.gold_table("donor_concentration")
            donor_data = {}
            if client.table_exists(donor_table):
                d_df = client.query(f"SELECT * FROM {donor_table} WHERE crisis_id = '{body.crisis_id}'")
                if not d_df.empty:
                    donor_data = d_df.iloc[0].fillna(0).to_dict()
            return {
                "card_type": "DONOR_RISK",
                "title": f"{country} — Donor Dependency Risk",
                "hhi_index": donor_data.get("hhi_index"),
                "top_donor": donor_data.get("top_donor"),
                "top_donor_share": donor_data.get("top_donor_share"),
                "risk_level": "HIGH" if float(donor_data.get("hhi_index") or 0) > 0.25 else "MEDIUM",
                "attribution": "Data: UN OCHA CBPF / Lighthouse OS",
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unknown card type: {body.card_type}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tutor/{topic}")
async def ai_tutor(topic: str, client: ClientDep, config: ConfigDep):
    """
    AI Tutor — explains UN funding mechanisms to non-expert users.
    Topics: CERF, CBPF, HRP, MismatchScore, HHI (or a free-text crisis_id for contextual explanation).
    """
    try:
        topic_upper = topic.upper()

        # Static knowledge base for known terms
        if topic_upper in _FUNDING_MECHANISMS:
            return {
                "topic": topic_upper,
                "explanation": _FUNDING_MECHANISMS[topic_upper],
                "source": "Lighthouse OS Knowledge Base",
            }

        # For unknown topics or crisis IDs, ask Claude
        from anthropic import Anthropic

        anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
        prompt = (
            f"A non-expert user asked: 'What is {topic} in the context of UN humanitarian funding?'\n\n"
            "Provide a clear, accessible explanation in 2-3 sentences. "
            "Avoid jargon. No emojis. Be factually precise."
        )
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        explanation = response.content[0].text if response.content else "No explanation available."
        return {
            "topic": topic,
            "explanation": explanation,
            "source": "Claude AI (Lighthouse OS Intelligence Layer)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
