import type {
  Crisis,
  DataHealthResponse,
  FilterOptions,
  GeoResponse,
  OptimizationResult,
  RankingFilters,
  RankingsResponse,
  SimulationResult,
  SummaryStats,
  TimelinePoint,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Rankings ──────────────────────────────────────────────────────────────────

export function buildRankingsUrl(filters: Partial<RankingFilters>): string {
  const p = new URLSearchParams();
  if (filters.region) p.set("region", filters.region);
  if (filters.sector) p.set("sector", filters.sector);
  if (filters.year) p.set("year", filters.year);
  if (filters.maxCoverage) p.set("maxCoverage", filters.maxCoverage);
  if (filters.crisisType) p.set("crisisType", filters.crisisType);
  if (filters.confidence) p.set("confidence", filters.confidence);
  if (filters.sortBy) p.set("sortBy", filters.sortBy);
  if (filters.sortOrder) p.set("sortOrder", filters.sortOrder);
  p.set("limit", String(filters.limit ?? 50));
  return `/api/rankings?${p}`;
}

export const api = {
  // Rankings
  rankings: (filters: Partial<RankingFilters> = {}) =>
    get<RankingsResponse>(buildRankingsUrl(filters)),
  rankingsMeta: () => get<FilterOptions>("/api/rankings/meta/filters"),
  summary: () => get<SummaryStats>("/api/rankings/meta/summary"),

  // Geo / Map
  mapData: (mode: string, year?: string, sector?: string) => {
    const p = new URLSearchParams({ mode });
    if (year) p.set("year", year);
    if (sector) p.set("sector", sector);
    return get<GeoResponse>(`/api/geo/map-data?${p}`);
  },
  countryDetail: (iso3: string) => get<{ iso3: string; crises: Crisis[] }>(`/api/geo/country/${iso3}`),

  // Crisis
  crisisDetail: (id: string) => get<{ status: string; crisis: Crisis }>(`/api/crisis/${id}`),
  crisisSectors: (id: string) => get<{ crisis_id: string; sectors: import("./types").SectorData[] }>(`/api/crisis/${id}/sectors`),
  crisisDonors: (id: string) => get<{ crisis_id: string; donor_data: import("./types").DonorData[] | null }>(`/api/crisis/${id}/donors`),
  crisisRelated: (id: string) => get<{ crisis_id: string; related: Crisis[] }>(`/api/crisis/${id}/related`),

  // Simulate
  simulate: (crisis_id: string, additional_funding_usd: number) =>
    post<SimulationResult>("/api/simulate", { crisis_id, additional_funding_usd }),
  optimize: (total_budget_usd: number) =>
    post<OptimizationResult>("/api/simulate/optimize", { total_budget_usd }),

  // Dossier
  dossier: (crisis_id: string) => get<Record<string, unknown>>(`/api/dossier?crisis_id=${crisis_id}`),

  // Timeline
  timeline: (iso3: string, sector: string) =>
    get<{ crisis_id: string; structural_classification: string; historical_trend: TimelinePoint[]; projection: unknown }>(
      `/api/timeline?iso3=${iso3}&sector=${encodeURIComponent(sector)}`
    ),
  globalTrend: (region?: string) => get<{ trend: TimelinePoint[] }>(`/api/timeline/global${region ? `?region=${region}` : ""}`),

  // Data Health
  dataHealth: (iso3?: string) => get<DataHealthResponse>(`/api/data-health${iso3 ? `?iso3=${iso3}` : ""}`),

  // Narrative
  narrative: (crisis_id: string) => get<{ human_narratives: string[]; summary_metrics: Record<string, number> }>(`/api/narrative/${crisis_id}`),

  // Export
  exportRankingsCsv: (filters: Partial<RankingFilters> = {}) => {
    const p = new URLSearchParams();
    if (filters.region) p.set("region", filters.region);
    if (filters.sector) p.set("sector", filters.sector);
    if (filters.year) p.set("year", filters.year);
    if (filters.maxCoverage) p.set("maxCoverage", filters.maxCoverage);
    p.set("limit", "500");
    return `${BASE}/api/export/rankings.csv?${p}`;
  },
};

// ── SSE chat stream ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatEvent {
  type: "tool_call" | "status" | "message" | "error" | "done";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
}

export function streamChat(
  message: string,
  history: ChatMessage[],
  onEvent: (event: ChatEvent) => void,
  onDone: () => void
): AbortController {
  const controller = new AbortController();

  const messages = history.map((m) => ({ role: m.role, content: m.content }));

  fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, messages }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        onEvent({ type: "error", content: `HTTP ${res.status}` });
        onDone();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const ev: ChatEvent = JSON.parse(line.slice(6));
              onEvent(ev);
              if (ev.type === "done") { onDone(); return; }
            } catch { /* ignore malformed */ }
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") onEvent({ type: "error", content: String(err) });
      onDone();
    });

  return controller;
}
