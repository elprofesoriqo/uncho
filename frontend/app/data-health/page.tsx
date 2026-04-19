"use client";
import { useState } from "react";
import useSWR from "swr";
import { Search, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { HealthMatrixRow } from "@/lib/types";
import { PageHeader, Skeleton, ErrorBanner } from "@/components/ui/Primitives";

function HealthBadge({ score }: { score: number }) {
  if (score >= 0.7) return <span className="flex items-center gap-1 text-covered text-[11px]"><CheckCircle size={11} /> HIGH</span>;
  if (score >= 0.4) return <span className="flex items-center gap-1 text-[#ca8a04] text-[11px]"><AlertTriangle size={11} /> MEDIUM</span>;
  return <span className="flex items-center gap-1 text-severe text-[11px]"><XCircle size={11} /> LOW</span>;
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score * 100, 0), 100);
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#ca8a04" : "#dc2626";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border-2 rounded-full overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="mono text-[11px] w-8 text-right" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function DataHealthPage() {
  const [search, setSearch] = useState("");

  const { data, error, isLoading } = useSWR("data-health", () => api.dataHealth(), { refreshInterval: 300_000 });

  const rows: HealthMatrixRow[] = (data?.transparency_matrix ?? []).filter(r =>
    !search || r.country.toLowerCase().includes(search.toLowerCase()) || r.iso3.toLowerCase().includes(search.toLowerCase())
  );

  const s = data?.global_health_summary;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Data Health & Transparency Matrix"
        subtitle="Completeness, freshness, and confidence scores by country — the basis for all Claude guardrails"
      />

      {/* Global stats */}
      {s && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4">
            <p className="text-[10px] text-muted uppercase tracking-widest">Crises Analyzed</p>
            <p className="mono font-bold text-[22px] text-accent">{s.total_active_crises_analyzed.toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-muted uppercase tracking-widest">Avg Confidence</p>
            <p className="mono font-bold text-[22px]" style={{
              color: s.global_average_confidence_score >= 0.7 ? "#16a34a" : s.global_average_confidence_score >= 0.4 ? "#ca8a04" : "#dc2626"
            }}>
              {(s.global_average_confidence_score * 100).toFixed(1)}%
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] text-muted uppercase tracking-widest">Missing Financial Data</p>
            <p className="mono font-bold text-[22px] text-severe">{s.crises_missing_financial_requirements.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="text" placeholder="Search country or ISO3…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface border border-border text-text text-[12px] rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      {error ? <ErrorBanner error={`Failed to load data health: ${error.message}`} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted">Country</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted">ISO3</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted w-[160px]">Confidence Score</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted">Level</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : rows.map(r => (
                  <tr key={r.iso3 + r.country} className="border-b border-border tr-hover">
                    <td className="px-4 py-2.5 text-[13px] text-text font-medium">{r.country}</td>
                    <td className="px-4 py-2.5 mono text-[12px] text-muted">{r.iso3}</td>
                    <td className="px-4 py-2.5">
                      <ConfidenceBar score={r.confidence_score} />
                    </td>
                    <td className="px-4 py-2.5">
                      <HealthBadge score={r.confidence_score} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(r.transparency_warnings ?? []).slice(0, 3).map((w, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-[#ca8a04]/10 border border-[#ca8a04]/20 text-[#ca8a04] rounded">
                            {w}
                          </span>
                        ))}
                        {(r.transparency_warnings ?? []).length > 3 && (
                          <span className="text-[10px] text-faint">+{r.transparency_warnings.length - 3} more</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && rows.length === 0 && (
            <div className="py-12 text-center text-muted text-[13px]">No countries match the current filter.</div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="mt-4 card p-4 flex items-start gap-3">
        <Shield size={14} className="text-accent mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-text mb-1">About Confidence Scores</p>
          <p className="text-[11px] text-muted leading-relaxed">
            Confidence scores integrate data freshness (exponential temporal decay), completeness (presence of HNO/FTS/CBPF data),
            and source reliability. Claude uses these scores to flag data staleness warnings when answering queries.
            Countries with LOW confidence should be interpreted with caution — underlying needs may be underreported.
          </p>
        </div>
      </div>
    </div>
  );
}
