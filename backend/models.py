"""
Pydantic models for all API request bodies and response shapes.
"""
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Request models ─────────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    crisis_id: str
    additional_funding_usd: float = Field(..., gt=0, description="Amount in USD to add (must be > 0)")
    target_sector: Optional[str] = None


class OptimizeRequest(BaseModel):
    total_budget_usd: float = Field(..., gt=0, description="Total budget to distribute in USD")
    constrain_to_region: Optional[str] = None
    constrain_to_sector: Optional[str] = None


class BatchSimulateRequest(BaseModel):
    scenarios: list[SimulateRequest] = Field(..., min_length=1, max_length=20)


class ChatRequest(BaseModel):
    message: str
    messages: list[dict[str, Any]] = Field(default_factory=list, description="Conversation history")


class InsightCardRequest(BaseModel):
    crisis_id: str
    card_type: str = Field(
        "FUNDING_GAP",
        description="FUNDING_GAP | MISMATCH_RANK | SECTOR_BREAKDOWN | DONOR_RISK"
    )


# ── Filter parameters ──────────────────────────────────────────────────────────

class RankingFilters(BaseModel):
    region: Optional[str] = None
    sector: Optional[str] = None
    year: Optional[int] = None
    min_people_in_need: Optional[int] = None
    max_coverage_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    min_mismatch_score: Optional[float] = None
    crisis_type: Optional[str] = Field(
        None, description="STRUCTURAL | ACUTE | RECOVERING"
    )
    confidence_level: Optional[str] = Field(
        None, description="HIGH | MEDIUM | LOW"
    )
    sort_by: str = Field("mismatch_score_lower_bound", description="Column to sort by")
    sort_order: str = Field("DESC", pattern="^(ASC|DESC)$")
    limit: int = Field(20, ge=1, le=200)
    offset: int = Field(0, ge=0)
