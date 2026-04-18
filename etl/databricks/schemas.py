"""
Data schemas and validation models for humanitarian datasets.

Uses Pydantic for runtime validation of data flowing through the pipeline.
Each schema maps to a table in the medallion architecture.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

# =============================================================================
# Enums
# =============================================================================


class CrisisType(str, Enum):
    """Classification of crisis funding pattern."""
    STRUCTURAL = "STRUCTURAL"  # Chronically underfunded 3+ years
    ACUTE = "ACUTE"            # Recently emerged gap
    RECOVERING = "RECOVERING"  # Was underfunded, now improving


class HRPStatus(str, Enum):
    """Humanitarian Response Plan status."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVISION = "revision"
    NONE = "none"


class ConfidenceLevel(str, Enum):
    """Data confidence classification."""
    HIGH = "HIGH"       # Fresh data, multiple sources, consistent
    MEDIUM = "MEDIUM"   # Some staleness or missing sectors
    LOW = "LOW"         # Outdated or sparse data


class Sector(str, Enum):
    """UN humanitarian cluster/sector classification."""
    HEALTH = "Health"
    FOOD_SECURITY = "Food Security"
    WASH = "Water Sanitation Hygiene"
    PROTECTION = "Protection"
    SHELTER = "Shelter/NFI"
    EDUCATION = "Education"
    NUTRITION = "Nutrition"
    EARLY_RECOVERY = "Early Recovery"
    LOGISTICS = "Logistics"
    COORDINATION = "Coordination and support services"
    CAMP_MANAGEMENT = "Camp Coordination / Management"
    EMERGENCY_TELECOM = "Emergency Telecommunications"
    MULTI_SECTOR = "Multi-sector"
    TOTAL = "Total"  # Country-level aggregate


# =============================================================================
# Bronze Layer Schemas (Raw Ingestion)
# =============================================================================


class BronzeHNORecord(BaseModel):
    """Raw Humanitarian Needs Overview record as ingested from HDX."""
    country: str
    admin1: str | None = None
    sector: str | None = None
    population: float | None = None
    in_need: float | None = None
    targeted: float | None = None
    affected: float | None = None
    year: int
    source_file: str  # Track provenance

    @field_validator("year")
    @classmethod
    def validate_year(cls, v: int) -> int:
        if v < 2000 or v > 2030:
            raise ValueError(f"Year {v} outside valid range [2000, 2030]")
        return v


class BronzeFTSRecord(BaseModel):
    """Raw FTS requirements/funding record."""
    country: str
    year: int
    requirements_usd: float | None = None
    funding_usd: float | None = None
    coverage: float | None = None
    cluster: str | None = None  # Sector, if cluster-level data
    plan_name: str | None = None
    source_file: str

    @field_validator("requirements_usd", "funding_usd")
    @classmethod
    def validate_positive(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError(f"Financial value cannot be negative: {v}")
        return v


class BronzeHRPRecord(BaseModel):
    """Raw Humanitarian Response Plan record."""
    plan_id: str | None = None
    plan_name: str
    country: str | None = None
    iso3: str | None = None
    status: str | None = None
    year_start: int | None = None
    year_end: int | None = None
    requirements_usd: float | None = None
    funding_usd: float | None = None
    source_file: str


class BronzeINFORMRecord(BaseModel):
    """Raw INFORM Severity Index record."""
    country: str
    iso3: str
    inform_severity: float = Field(ge=0, le=10)
    inform_risk: float | None = Field(default=None, ge=0, le=10)
    year: int
    source_file: str


# =============================================================================
# Silver Layer Schemas (Normalized)
# =============================================================================


class SilverCrisisUniverse(BaseModel):
    """Deduplicated crisis record with standardized identifiers."""
    iso3: str = Field(min_length=3, max_length=3)
    country: str
    region: str
    latitude: float | None = None
    longitude: float | None = None


class SilverNeedsBySector(BaseModel):
    """Normalized people-in-need by country, year, sector."""
    iso3: str = Field(min_length=3, max_length=3)
    country: str
    year: int
    sector: str
    people_in_need: int = Field(ge=0)
    people_targeted: int | None = Field(default=None, ge=0)
    population: int | None = Field(default=None, ge=0)

    @property
    def pin_per_capita(self) -> float | None:
        if self.population and self.population > 0:
            return self.people_in_need / self.population
        return None


class SilverFundingFlow(BaseModel):
    """Normalized funding flow record."""
    iso3: str = Field(min_length=3, max_length=3)
    country: str
    year: int
    sector: str
    requirements_usd: float = Field(ge=0)
    funding_usd: float = Field(ge=0)

    @property
    def coverage_ratio(self) -> float:
        if self.requirements_usd <= 0:
            return 0.0
        return min(self.funding_usd / self.requirements_usd, 1.0)


# =============================================================================
# Gold Layer Schemas (Analytical)
# =============================================================================


class GoldCrisisIndex(BaseModel):
    """Master ranked crisis record — the core output of the platform."""
    crisis_id: str  # {iso3}_{year}_{sector}
    country: str
    iso3: str
    region: str
    year: int
    sector: str

    # Need signals
    people_in_need: int = Field(ge=0)
    people_targeted: int | None = Field(default=None, ge=0)
    population: int | None = Field(default=None, ge=0)
    pin_per_capita: float | None = None
    inform_severity: float | None = Field(default=None, ge=0, le=10)

    # Funding signals
    requirements_usd: float = Field(ge=0)
    funding_usd: float = Field(ge=0)
    coverage_ratio: float = Field(ge=0, le=1.0)
    cost_per_pin: float | None = None # NEW: Efficiency metric

    # Computed scores
    need_weight: float = 0.0
    gap_severity: float = 0.0
    structural_multiplier: float = 1.0
    visibility_penalty: float = 1.0
    urgency_weight: float = 1.0
    efficiency_discount: float = 1.0 # NEW: Penalty for massively inflated cost_per_pin
    mismatch_score: float = 0.0
    mismatch_score_lower_bound: float = 0.0 # NEW: Bayesian lower bound (pessimistic)
    mismatch_score_upper_bound: float = 0.0 # NEW: Bayesian upper bound (optimistic)

    # Explicit threshold filters for challenge evaluation
    is_in_scope: bool = True
    
    # Classification
    crisis_type: CrisisType = CrisisType.ACUTE
    confidence_score: float = Field(default=0.5, ge=0, le=1.0)
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM

    # Ranking
    global_rank: int = 0

    # Metadata
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GoldDonorConcentration(BaseModel):
    """Donor concentration analysis for a crisis."""
    iso3: str
    year: int
    sector: str
    hhi_index: float = Field(ge=0, le=1.0)  # Herfindahl-Hirschman Index
    top_donor_name: str | None = None
    top_donor_share: float = Field(default=0.0, ge=0, le=1.0)
    donor_count: int = Field(default=0, ge=0)
    dependency_risk: str = "UNKNOWN"  # HIGH / MEDIUM / LOW


# =============================================================================
# Region Mapping (ISO3 → UN Region)
# =============================================================================

REGION_MAP: dict[str, str] = {
    # Sub-Saharan Africa
    "AFG": "South Asia", "BFA": "West Africa", "CMR": "Central Africa",
    "CAF": "Central Africa", "TCD": "Central Africa", "COD": "Central Africa",
    "ETH": "East Africa", "MLI": "West Africa", "MOZ": "Southern Africa",
    "NER": "West Africa", "NGA": "West Africa", "SOM": "East Africa",
    "SSD": "East Africa", "SDN": "East Africa",
    # Middle East & North Africa
    "SYR": "Middle East", "YEM": "Middle East", "IRQ": "Middle East",
    "LBY": "North Africa", "PSE": "Middle East", "LBN": "Middle East",
    # Americas
    "COL": "South America", "HTI": "Caribbean", "SLV": "Central America",
    "GTM": "Central America", "HND": "Central America", "VEN": "South America",
    # Asia & Pacific
    "MMR": "Southeast Asia", "PAK": "South Asia", "BGD": "South Asia",
    "PRK": "East Asia", "PHL": "Southeast Asia",
    # Europe
    "UKR": "Eastern Europe",
}


def get_region(iso3: str) -> str:
    """Get UN region for a country ISO3 code."""
    return REGION_MAP.get(iso3, "Other")
