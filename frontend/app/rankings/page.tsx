"use client";
import { useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Download, ChevronUp, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Crisis, RankingFilters } from "@/lib/types";
import { CoveragePct, MismatchScore, Skeleton, ErrorBanner, PageHeader } from "@/components/ui/Primitives";
import { ConfidenceBadge, CrisisTypeBadge } from "@/components/ui/Badge";
import { clsx } from "clsx";

const DEFAULT_FILTERS: RankingFilters = {
  region: "", sector: "", year: "", maxCoverage: "", crisisType: "",
  confidence: "", sortBy: "mismatch_score_lower_bound", sortOrder: "DESC", limit: 50,
};

function SortBtn({ col, current, order, onClick }: {
  col: string; current: string; order: "ASC" | "DESC"; onClick: (c: string) => void;
}) {
  const active = current === col;
  return (
    <button onClick={() => onClick(col)} className="inline-flex items-center gap-0.5 hover:text-accent transition-colors">
      {active && order === "DESC" ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
    </button>
  );
}

function FilterPanel({ filters, options, onChange, onClear }: {
  filters: RankingFilters;
  options: { regions: string[]; sectors: string[]; years: (string | number)[]; crisis_types: string[]; confidence_levels: string[] } | undefined;
  onChange: (k: keyof RankingFilters, v: string | number) => void;
  onClear: () => void;
}) {
  const sel = "w-full bg-surface-2 border border-border text-text text-[12px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent";
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Filters</span>
        <button onClick={onClear} className="text-[10px] text-faint hover:text-accent flex items-center gap-1"><X size={10} /> Clear</button>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Region</label>
        <select className={sel} value={filters.region} onChange={e => onChange("region", e.target.value)}>
          <option value="">All regions</option>
          {options?.regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Sector</label>
        <select className={sel} value={filters.sector} onChange={e => onChange("sector", e.target.value)}>
          <option value="">All sectors</option>
          {options?.sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Year</label>
        <select className={sel} value={filters.year} onChange={e => onChange("year", e.target.value)}>
          <option value="">All years</option>
          {options?.years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Crisis Type</label>
        <select className={sel} value={filters.crisisType} onChange={e => onChange("crisisType", e.target.value)}>
          <option value="">All types</option>
          {options?.crisis_types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Confidence</label>
        <select className={sel} value={filters.confidence} onChange={e => onChange("confidence", e.target.value)}>
          <option value="">All levels</option>
          {options?.confidence_levels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Max Coverage</label>
        <select className={sel} value={filters.maxCoverage} onChange={e => onChange("maxCoverage", e.target.value)}>
          <option value="">No limit</option>
          <option value="0.2">Under 20%</option>
          <option value="0.4">Under 40%</option>
          <option value="0.6">Under 60%</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted mb-1 block">Results per page</label>
        <select className={sel} value={filters.limit} onChange={e => onChange("limit", parseInt(e.target.value))}>
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function RankingsPage() {
  const [filters, setFilters] = useState<RankingFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(true);

  const { data: options } = useSWR("filter-options", api.rankingsMeta);
  const { data: rankings, error, isLoading } = useSWR(
    ["rankings", filters],
    () => api.rankings(filters),
    { keepPreviousData: true }
  );

  const handleSort = useCallback((col: string) => {
    setFilters(f => ({
      ...f, sortBy: col,
      sortOrder: f.sortBy === col && f.sortOrder === "DESC" ? "ASC" : "DESC",
    }));
  }, []);

  const handleFilter = useCallback((k: keyof RankingFilters, v: string | number) => {
    setFilters(f => ({ ...f, [k]: v }));
  }, []);

  const cols: { key: string; label: string; sortable: boolean }[] = [
    { key: "global_rank", label: "#", sortable: true },
    { key: "country", label: "Country / Sector", sortable: false },
    { key: "mismatch_score_lower_bound", label: "MismatchScore", sortable: true },
    { key: "coverage_ratio", label: "Coverage", sortable: true },
    { key: "requirements_usd", label: "Required", sortable: true },
    { key: "inform_severity", label: "Severity", sortable: true },
    { key: "crisis_type", label: "Type", sortable: false },
    { key: "confidence_level", label: "Confidence", sortable: false },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Crisis Rankings"
        subtitle={rankings ? `${rankings.total.toLocaleString()} crises matching current filters` : "Loading…"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(s => !s)}
              className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition-colors",
                showFilters ? "border-accent/40 text-accent bg-accent/10" : "border-border text-muted hover:text-text")}
            >
              <SlidersHorizontal size={12} /> Filters
            </button>
            <a
              href={api.exportRankingsCsv(filters)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted hover:text-text hover:border-border-2 transition-colors"
            >
              <Download size={12} /> Export CSV
            </a>
          </div>
        }
      />

      <div className="flex gap-4">
        {showFilters && (
          <div className="w-[200px] flex-shrink-0">
            <FilterPanel filters={filters} options={options} onChange={handleFilter} onClear={() => setFilters(DEFAULT_FILTERS)} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {error ? <ErrorBanner error={`Failed to load rankings: ${error.message}`} /> : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {cols.map(c => (
                        <th key={c.key} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted font-semibold whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            {c.label}
                            {c.sortable && <SortBtn col={c.key} current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && !rankings ? (
                      Array.from({ length: 12 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          {cols.map(c => (
                            <td key={c.key} className="px-3 py-2.5">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : rankings?.crises.map((c: Crisis, i: number) => (
                      <tr
                        key={c.crisis_id}
                        className="border-b border-border tr-hover transition-opacity"
                        style={{ opacity: isLoading ? 0.5 : 1 }}
                      >
                        <td className="px-3 py-2.5">
                          <span className="mono text-[12px] text-faint">{c.global_rank || i + 1}</span>
                        </td>
                        <td className="px-3 py-2.5 min-w-[160px]">
                          <Link href={`/crisis/${c.crisis_id}`} className="block group">
                            <span className="font-medium text-[13px] text-text group-hover:text-accent">{c.country}</span>
                            <span className="block text-[11px] text-faint">{c.sector} · {c.year}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <MismatchScore value={c.mismatch_score} lower={c.mismatch_score_lower_bound} upper={c.mismatch_score_upper_bound} />
                        </td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <CoveragePct value={c.coverage_ratio} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="mono tabular text-[12px] text-muted">
                            {+c.requirements_usd >= 1e9 ? `$${(+c.requirements_usd / 1e9).toFixed(1)}B` : +c.requirements_usd >= 1e6 ? `$${(+c.requirements_usd / 1e6).toFixed(0)}M` : `$${(+c.requirements_usd)?.toLocaleString() ?? "—"}`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="mono tabular text-[12px]" style={{
                            color: +c.inform_severity >= 4 ? "#dc2626" : +c.inform_severity >= 3 ? "#ea580c" : +c.inform_severity >= 2 ? "#ca8a04" : "#94a3b8"
                          }}>
                            {+c.inform_severity > 0 ? (+c.inform_severity).toFixed(1) : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><CrisisTypeBadge type={c.crisis_type} /></td>
                        <td className="px-3 py-2.5"><ConfidenceBadge level={c.confidence_level} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rankings && rankings.total === 0 && (
                <div className="py-12 text-center text-muted text-[13px]">No crises match the current filters.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
