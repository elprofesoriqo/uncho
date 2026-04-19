"use client";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowRight,
  AlertTriangle,
  TrendingDown,
  Users,
  DollarSign,
  BarChart3,
  Globe2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Crisis } from "@/lib/types";
import {
  CoveragePct,
  MismatchScore,
  Skeleton,
  ErrorBanner,
} from "@/components/ui/Primitives";
import { ConfidenceBadge, CrisisTypeBadge } from "@/components/ui/Badge";
import WorldMap from "@/components/charts/WorldMap";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-accent",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-2 border border-border`}
      >
        <Icon size={16} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted uppercase tracking-widest font-medium">
          {label}
        </p>
        <p
          className={`mono tabular font-bold text-[22px] leading-tight mt-0.5 ${color}`}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-faint mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CrisisRow({ c, rank }: { c: Crisis; rank: number }) {
  return (
    <Link
      href={`/crisis/${c.crisis_id}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors group"
    >
      <span className="mono text-[12px] text-faint w-5 text-right flex-shrink-0">
        #{rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[13px] text-text truncate">
            {c.country}
          </span>
          <span className="text-faint text-[11px] hidden sm:block">
            · {c.sector}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CrisisTypeBadge type={c.crisis_type} />
          <ConfidenceBadge level={c.confidence_level} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <MismatchScore
          value={c.mismatch_score}
          lower={c.mismatch_score_lower_bound}
          upper={c.mismatch_score_upper_bound}
        />
        <CoveragePct value={c.coverage_ratio} showBar={false} />
      </div>
      <ArrowRight
        size={13}
        className="text-faint group-hover:text-accent transition-colors"
      />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: summary, error: sumErr } = useSWR("summary", api.summary, {
    refreshInterval: 120_000,
  });
  const { data: rankings, error: rankErr } = useSWR(
    "top5",
    () =>
      api.rankings({
        limit: 8,
        sortBy: "mismatch_score_lower_bound",
        sortOrder: "DESC",
      }),
    { refreshInterval: 120_000 },
  );
  const { data: mapData } = useSWR(
    "map-choropleth",
    () => api.mapData("CHOROPLETH_COVERAGE"),
    { refreshInterval: 300_000 },
  );

  const fmt = (n?: number, decimals = 1) =>
    n == null
      ? "—"
      : n >= 1e9
        ? `$${(n / 1e9).toFixed(decimals)}B`
        : n >= 1e6
          ? `$${(n / 1e6).toFixed(decimals)}M`
          : `$${n.toLocaleString()}`;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-text">
          <span className="gradient-text">Lighthouse OS</span>
        </h1>
        <p className="text-muted text-[13px] mt-1">
          Humanitarian Crisis Intelligence Platform · UN OCHA Data
        </p>
      </div>

      {/* KPI cards */}
      {sumErr ? (
        <ErrorBanner error="Could not load summary statistics." />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_380px] gap-3 mb-6">
          {!summary ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-12 w-full" />
              </div>
            ))
          ) : (
            <>
              <KpiCard
                icon={Globe2}
                label="Active Crises"
                value={summary.total_active_crises.toLocaleString()}
                sub="currently tracked"
                color="text-accent"
              />
              <KpiCard
                icon={DollarSign}
                label="Funding Gap"
                value={fmt(summary.total_funding_gap_usd)}
                sub={`of ${fmt(summary.total_requirements_usd)} required`}
                color="text-severe"
              />
              <KpiCard
                icon={BarChart3}
                label="Avg Coverage"
                value={`${(summary.average_global_coverage_ratio * 100).toFixed(1)}%`}
                sub="global average"
                color="text-[#ca8a04]"
              />
              {/* <KpiCard
                icon={Users}
                label="People in Need"
                value={
                  summary.total_people_in_need >= 1e6
                    ? `${(summary.total_people_in_need / 1e6).toFixed(1)}M`
                    : summary.total_people_in_need.toLocaleString()
                }
                sub={`${summary.critically_underfunded_count} critically underfunded`}
                color="text-orange-400"
              /> */}
            </>
          )}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        {/* World Map */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-[14px]">Global Coverage Map</h2>
              <p className="text-[11px] text-muted">
                Coverage ratio by country — red = severely underfunded
              </p>
            </div>
            <Link
              href="/map"
              className="text-[11px] text-accent hover:text-sky flex items-center gap-1"
            >
              Full map <ArrowRight size={11} />
            </Link>
          </div>
          <div className="w-full relative h-full p-2">
            <WorldMap
              features={mapData?.features ?? []}
              encodingField="coverage_ratio"
            />
            <div className="absolute left-0 bottom-12 flex items-center gap-3 text-[10px] text-muted">
              {[
                ["#dc2626", "0–20%"],
                ["#ea580c", "20–40%"],
                ["#ca8a04", "40–60%"],
                ["#65a30d", "60–80%"],
                ["#16a34a", "80–100%"],
              ].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: c }}
                  />
                  {l}
                </span>
              ))}
            </div>
          </div>
          {/* Legend */}
        </div>

        {/* Top crises */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div>
              <h2 className="font-semibold text-[14px]">
                Most Overlooked Crises
              </h2>
              <p className="text-[11px] text-muted">
                Ranked by MismatchScore (lower bound)
              </p>
            </div>
            <Link
              href="/rankings"
              className="text-[11px] text-accent hover:text-sky flex items-center gap-1"
            >
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rankErr ? (
              <div className="p-4 text-severe text-[12px]">
                <AlertTriangle size={12} className="inline mr-1" />
                Failed to load rankings
              </div>
            ) : !rankings ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border"
                >
                  <Skeleton className="h-8 w-full" />
                </div>
              ))
            ) : (
              rankings.crises.map((c, i) => (
                <CrisisRow key={c.crisis_id} c={c} rank={i + 1} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
