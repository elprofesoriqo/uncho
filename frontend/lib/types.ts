// ── Core entity types ─────────────────────────────────────────────────────────

export interface Crisis {
  crisis_id: string;
  iso3: string;
  country: string;
  region: string;
  sector: string;
  year: string | number;
  global_rank: number;
  mismatch_score: number;
  mismatch_score_lower_bound: number;
  mismatch_score_upper_bound: number;
  need_weight: number;
  gap_severity: number;
  structural_multiplier: number;
  visibility_penalty: number;
  urgency_weight: number;
  efficiency_discount: number;
  coverage_ratio: number;
  requirements_usd: number;
  funding_usd: number;
  people_in_need: number;
  inform_severity: number;
  crisis_type: "STRUCTURAL" | "ACUTE" | "RECOVERING" | string;
  confidence_score: number;
  confidence_level: "HIGH" | "MEDIUM" | "LOW" | string;
  is_in_scope: boolean;
  kumo_predictions?: KumoPredictions;
}

export interface KumoPredictions {
  velocity?: { predicted_disbursement_pct_6m?: number; predicted_disbursement_pct_12m?: number };
  cascade?: { predicted_cascade_risk?: number };
  gap?: { predicted_coverage_6m?: number; confidence_lower?: number; confidence_upper?: number };
  donor?: { predicted_new_contribution_prob?: number; expected_amount?: number };
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface RankingsResponse {
  status: string;
  total: number;
  filters_applied: Record<string, unknown>;
  pagination: { limit: number; offset: number };
  crises: Crisis[];
}

export interface SummaryStats {
  total_active_crises: number;
  total_requirements_usd: number;
  total_funding_usd: number;
  total_funding_gap_usd: number;
  average_global_coverage_ratio: number;
  total_people_in_need: number;
  critically_underfunded_count: number;
}

export interface FilterOptions {
  regions: string[];
  sectors: string[];
  years: (string | number)[];
  crisis_types: string[];
  confidence_levels: string[];
}

// ── Geo types ─────────────────────────────────────────────────────────────────

export interface GeoFeature {
  iso3: string;
  country: string;
  region: string;
  coverage_ratio: number;
  mismatch_score: number;
  mismatch_score_lower_bound: number;
  people_in_need: number;
  requirements_usd: number;
  funding_usd: number;
  crisis_type: string;
}

export interface GeoResponse {
  mode: string;
  encoding_field?: string;
  intensity_field?: string;
  size_field?: string;
  color_field?: string;
  features?: GeoFeature[];
  points?: GeoFeature[];
  bubbles?: GeoFeature[];
  flows?: { recipient_iso3: string; donor_label: string; hhi_index: number; top_donor_share: number }[];
  warning?: string;
}

// ── Crisis detail types ────────────────────────────────────────────────────────

export interface SectorData {
  crisis_id: string;
  sector: string;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  people_in_need: number;
  mismatch_score: number;
  urgency_weight: number;
  confidence_level: string;
  cascade_risk: number | null;
  funding_gap_usd: number;
  gap_pct: number;
}

export interface DonorData {
  crisis_id: string;
  iso3: string;
  year: string;
  hhi_index: number;
  top_donor: string;
  top_donor_share: number;
  donor_count: number;
}

export interface TimelinePoint {
  year: string | number;
  requirements_usd: number;
  funding_usd: number;
  coverage_ratio: number;
  people_in_need: number;
  crisis_type: string;
  confidence_level: string;
}

// ── Simulation types ──────────────────────────────────────────────────────────

export interface SimulationResult {
  crisis_id: string;
  financials: {
    requirements_usd: number;
    old_funding_usd: number;
    new_funding_usd: number;
    additional_funding_usd: number;
  };
  impact: {
    old_coverage_ratio: number;
    new_coverage_ratio: number;
    coverage_change: string;
    estimated_additional_people_reached: number;
    cost_per_beneficiary_assumption: number;
  };
  ranking: {
    old_mismatch_score: number;
    new_mismatch_score_lower_bound: number;
    current_rank: number;
    new_rank: number;
    global_equity_impact_score: number;
  };
}

export interface OptimizationResult {
  budget_allocated_usd: number;
  gini_before: number;
  gini_after: number;
  equity_improvement: number;
  total_crises_benefited: number;
  top_allocations: {
    crisis_id: string;
    country: string;
    sector: string;
    allocated_usd: number;
    current_coverage_ratio: number;
    new_coverage_ratio: number;
  }[];
}

// ── Data health types ─────────────────────────────────────────────────────────

export interface DataHealthSummary {
  total_active_crises_analyzed: number;
  global_average_confidence_score: number;
  crises_missing_financial_requirements: number;
}

export interface HealthMatrixRow {
  iso3: string;
  country: string;
  confidence_score: number;
  confidence_level: string;
  transparency_warnings: string[];
}

export interface DataHealthResponse {
  global_health_summary: DataHealthSummary;
  transparency_matrix: HealthMatrixRow[];
}

// ── Filter state ─────────────────────────────────────────────────────────────

export interface RankingFilters {
  region: string;
  sector: string;
  year: string;
  maxCoverage: string;
  crisisType: string;
  confidence: string;
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  limit: number;
}
