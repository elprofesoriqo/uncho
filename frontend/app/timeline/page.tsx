"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api } from "@/lib/api";
import { PageHeader, Skeleton, ErrorBanner } from "@/components/ui/Primitives";

export default function TimelinePage() {
  const [iso3, setIso3] = useState("SYR");
  const [sector, setSector] = useState("Total");
  const [inputIso3, setInputIso3] = useState("SYR");
  const [inputSector, setInputSector] = useState("Total");

  const { data, error, isLoading } = useSWR(
    `timeline-${iso3}-${sector}`,
    () => api.timeline(iso3, sector)
  );

  const { data: globalTrend } = useSWR("global-trend", () => api.globalTrend());

  const chartData = (data?.historical_trend ?? []).map(p => ({
    year: String(p.year),
    requirements: p.requirements_usd / 1e6,
    funding: p.funding_usd / 1e6,
    coverage: p.coverage_ratio * 100,
    pin: p.people_in_need / 1e6,
  }));

  const globalData = (globalTrend?.trend ?? []).map(p => ({
    year: String(p.year),
    requirements: p.requirements_usd / 1e6,
    funding: p.funding_usd / 1e6,
    coverage: p.coverage_ratio * 100,
  }));

  function applyFilters() {
    setIso3(inputIso3.toUpperCase());
    setSector(inputSector);
  }

  const customTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface border border-border rounded-lg p-3 text-[11px] min-w-[160px]">
        <p className="font-semibold text-text mb-2">{label}</p>
        {(payload as { name: string; value: number; color: string }[]).map(p => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="mono text-text">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Multi-Year Structural Timeline"
        subtitle="HRP requirements vs. actual disbursements — identify chronic vs. sudden-onset underfunding"
      />

      {/* Filter bar */}
      <div className="card p-4 mb-6 flex items-end gap-4">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest mb-1 block">Country ISO3</label>
          <input type="text" value={inputIso3} onChange={e => setInputIso3(e.target.value.toUpperCase())} maxLength={3}
            className="bg-surface-2 border border-border text-text text-[13px] mono rounded-lg px-3 py-2 w-24 focus:outline-none focus:border-accent uppercase"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest mb-1 block">Sector</label>
          <input type="text" value={inputSector} onChange={e => setInputSector(e.target.value)}
            className="bg-surface-2 border border-border text-text text-[13px] rounded-lg px-3 py-2 w-40 focus:outline-none focus:border-accent"
          />
        </div>
        <button onClick={applyFilters}
          className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-dim transition-colors">
          Load
        </button>
        <div className="ml-4 flex gap-2 flex-wrap">
          {[["SYR","Total"],["SDN","Total"],["YEM","Total"],["ETH","Food Security"],["COD","WASH"]].map(([c, s]) => (
            <button key={c+s} onClick={() => { setIso3(c); setSector(s); setInputIso3(c); setInputSector(s); }}
              className={`px-2.5 py-1.5 text-[11px] rounded-lg border transition-colors ${iso3 === c && sector === s ? "border-accent text-accent bg-accent/10" : "border-border text-muted hover:text-text"}`}>
              {c} / {s}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBanner error={`Timeline not available: ${error.message}`} /> : (
        <>
          {data && (
            <div className="flex items-center gap-4 mb-4">
              <span className="font-semibold text-[15px] text-text">{iso3} · {sector}</span>
              {data.structural_classification && (
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                  data.structural_classification === "STRUCTURAL" ? "bg-severe/10 text-severe border-severe/30" :
                  data.structural_classification === "ACUTE" ? "bg-orange-900/20 text-orange-400 border-orange-800/30" :
                  "bg-covered/10 text-covered border-covered/25"
                }`}>
                  {data.structural_classification}
                </span>
              )}
              <span className="text-[12px] text-muted">{chartData.length} years of data</span>
            </div>
          )}

          {/* Main chart */}
          <div className="card p-4 mb-4">
            <h2 className="font-semibold text-[13px] mb-4">Requirements vs. Funding (USD M)</h2>
            {isLoading ? <Skeleton className="h-64 w-full" /> : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted text-[13px]">No timeline data found for this combination.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#1a2538" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis yAxisId="usd" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  <Area yAxisId="usd" type="monotone" dataKey="requirements" fill="#1a2538" stroke="#3b82f6" strokeWidth={1.5} name="Requirements $M" />
                  <Bar yAxisId="usd" dataKey="funding" fill="#16a34a" opacity={0.7} name="Funded $M" radius={[2, 2, 0, 0]} />
                  <ReferenceLine yAxisId="pct" y={50} stroke="#ca8a04" strokeDasharray="4 4" label={{ value: "50%", fill: "#ca8a04", fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Coverage ratio chart */}
          {chartData.length > 0 && (
            <div className="card p-4 mb-4">
              <h2 className="font-semibold text-[13px] mb-4">Coverage Ratio Over Time</h2>
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#1a2538" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={customTooltip} />
                  <Area
                    type="monotone" dataKey="coverage" stroke="#3b82f6" fill="url(#covGrad)"
                    strokeWidth={2} name="Coverage %"
                  />
                  <ReferenceLine y={50} stroke="#ca8a04" strokeDasharray="4 4" />
                  <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" />
                  <defs>
                    <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Global trend */}
      {globalData.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-[13px] mb-4">Global Humanitarian Funding Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={globalData}>
              <CartesianGrid stroke="#1a2538" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `$${v}M`} />
              <Tooltip content={customTooltip} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Area type="monotone" dataKey="requirements" fill="#1e2538" stroke="#3b82f6" strokeWidth={1.5} name="Global Requirements $M" />
              <Bar dataKey="funding" fill="#16a34a" opacity={0.6} name="Global Funded $M" radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
