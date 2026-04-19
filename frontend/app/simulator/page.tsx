"use client";
import { useState } from "react";
import useSWR from "swr";
import { ArrowRight, ArrowDown, TrendingDown, TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { api } from "@/lib/api";
import type { SimulationResult, OptimizationResult } from "@/lib/types";
import { CoveragePct, PageHeader, ErrorBanner, Skeleton } from "@/components/ui/Primitives";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";

type Mode = "single" | "optimize";

function Delta({ old: oldVal, next: nextVal, format = (v: number) => v.toFixed(3) }: {
  old: number; next: number; format?: (v: number) => string;
}) {
  const diff = nextVal - oldVal;
  const positive = diff >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-[20px] font-bold text-text">{format(oldVal)}</span>
      <ArrowRight size={14} className="text-faint" />
      <span className={`mono text-[20px] font-bold ${positive ? "text-covered" : "text-severe"}`}>{format(nextVal)}</span>
      <span className={`text-[11px] mono ${positive ? "text-covered" : "text-severe"}`}>
        ({diff >= 0 ? "+" : ""}{format(diff)})
      </span>
    </div>
  );
}

function ImpactCard({ icon: Icon, label, children, color = "text-accent" }: {
  icon: React.ElementType; label: string; children: React.ReactNode; color?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function SimulatorPage() {
  const [mode, setMode] = useState<Mode>("single");

  // Single mode state
  const [crisisId, setCrisisId] = useState("");
  const [amount, setAmount] = useState("5000000");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimize mode state
  const [budget, setBudget] = useState("100000000");
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  const { data: topCrises } = useSWR("sim-top-crises", () => api.rankings({ limit: 30, sortBy: "mismatch_score_lower_bound", sortOrder: "DESC" }));

  async function runSimulation() {
    if (!crisisId || !amount) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.simulate(crisisId, parseFloat(amount));
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  async function runOptimize() {
    setOptLoading(true); setOptError(null); setOptResult(null);
    try {
      const r = await api.optimize(parseFloat(budget));
      setOptResult(r);
    } catch (e) {
      setOptError((e as Error).message);
    } finally { setOptLoading(false); }
  }

  const fmtUsd = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Decision Impact Simulator"
        subtitle="Model funding scenarios and quantify global equity impact before committing resources"
      />

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(["single", "optimize"] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all border ${
              mode === m
                ? "bg-accent/10 text-accent border-accent/30"
                : "text-muted border-border hover:text-text hover:border-border-2"
            }`}
          >
            {m === "single" ? "Single Scenario" : "Gini Optimizer"}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          {/* Input panel */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-[14px] pb-2 border-b border-border">Configure Scenario</h2>
            <div>
              <label className="text-[11px] text-muted mb-1.5 block">Target Crisis</label>
              <select
                className="w-full bg-surface-2 border border-border text-text text-[12px] rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                value={crisisId}
                onChange={e => setCrisisId(e.target.value)}
              >
                <option value="">Select a crisis…</option>
                {topCrises?.crises.map(c => (
                  <option key={c.crisis_id} value={c.crisis_id}>
                    {c.country} — {c.sector} ({c.year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted mb-1.5 block">Additional Funding (USD)</label>
              <div className="flex items-center gap-2 mb-2">
                {[1e6, 5e6, 10e6, 50e6].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${amount === String(v) ? "border-accent text-accent bg-accent/10" : "border-border text-muted hover:text-text"}`}>
                    {v >= 1e6 ? `$${v / 1e6}M` : `$${v}`}
                  </button>
                ))}
              </div>
              <input
                type="number" min="0" step="500000" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text text-[12px] rounded-lg px-3 py-2 focus:outline-none focus:border-accent mono"
              />
              <p className="text-[10px] text-faint mt-1">{fmtUsd(parseFloat(amount) || 0)}</p>
            </div>
            {error && <ErrorBanner error={error} />}
            <button
              onClick={runSimulation}
              disabled={!crisisId || loading}
              className="w-full py-2.5 bg-accent text-white rounded-lg text-[13px] font-semibold hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Running simulation…" : "Run Simulation"}
            </button>
          </div>

          {/* Results */}
          <div>
            {loading && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4"><Skeleton className="h-16 w-full" /></div>)}
              </div>
            )}
            {result && (
              <div className="animate-fade-in space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <ImpactCard icon={TrendingDown} label="Coverage Change" color="text-covered">
                    <Delta
                      old={result.impact.old_coverage_ratio}
                      next={result.impact.new_coverage_ratio}
                      format={fmtPct}
                    />
                    <p className="text-[11px] text-muted mt-1">{result.impact.coverage_change}</p>
                  </ImpactCard>
                  <ImpactCard icon={Users} label="Additional People Reached" color="text-sky">
                    <span className="mono text-[24px] font-bold text-sky">
                      +{result.impact.estimated_additional_people_reached.toLocaleString()}
                    </span>
                    <p className="text-[11px] text-muted mt-1">
                      @ ${result.impact.cost_per_beneficiary_assumption}/person assumption
                    </p>
                  </ImpactCard>
                  <ImpactCard icon={Target} label="Rank Change" color="text-accent">
                    <Delta
                      old={result.ranking.current_rank}
                      next={result.ranking.new_rank}
                      format={v => `#${Math.round(v)}`}
                    />
                    <p className="text-[10px] text-muted mt-1">Lower rank = less neglected</p>
                  </ImpactCard>
                  <ImpactCard icon={DollarSign} label="Global Equity Impact (Gini)" color="text-[#ca8a04]">
                    <span className={`mono text-[18px] font-bold ${result.ranking.global_equity_impact_score >= 0 ? "text-covered" : "text-severe"}`}>
                      {result.ranking.global_equity_impact_score >= 0 ? "+" : ""}{result.ranking.global_equity_impact_score.toFixed(5)}
                    </span>
                    <p className="text-[11px] text-muted mt-1">
                      {result.ranking.global_equity_impact_score >= 0 ? "Reduces" : "Increases"} global coverage inequality
                    </p>
                  </ImpactCard>
                </div>
                <div className="card p-4">
                  <h3 className="font-semibold text-[13px] mb-3">Financial Impact Summary</h3>
                  <div className="grid grid-cols-2 gap-x-8">
                    <div>
                      <p className="text-[11px] text-muted">Investment</p>
                      <p className="mono font-bold text-accent text-[16px]">{fmtUsd(result.financials.additional_funding_usd)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">New Total Funding</p>
                      <p className="mono font-bold text-text text-[16px]">{fmtUsd(result.financials.new_funding_usd)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!result && !loading && (
              <div className="flex items-center justify-center h-48 text-muted text-[13px] border border-dashed border-border rounded-xl">
                Select a crisis and funding amount, then run the simulation.
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "optimize" && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-[14px] pb-2 border-b border-border">Gini-Optimized Allocation</h2>
            <p className="text-[12px] text-muted leading-relaxed">
              Given a total budget, this algorithm distributes funds across underfunded crises to mathematically minimize
              the Gini coefficient of global coverage ratios — maximizing equity.
            </p>
            <div>
              <label className="text-[11px] text-muted mb-1.5 block">Total Budget (USD)</label>
              <div className="flex items-center gap-2 mb-2">
                {[10e6, 50e6, 100e6, 500e6].map(v => (
                  <button key={v} onClick={() => setBudget(String(v))}
                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${budget === String(v) ? "border-accent text-accent bg-accent/10" : "border-border text-muted hover:text-text"}`}>
                    {v >= 1e9 ? `$${v / 1e9}B` : `$${v / 1e6}M`}
                  </button>
                ))}
              </div>
              <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text text-[12px] rounded-lg px-3 py-2 focus:outline-none focus:border-accent mono" />
              <p className="text-[10px] text-faint mt-1">{fmtUsd(parseFloat(budget) || 0)}</p>
            </div>
            {optError && <ErrorBanner error={optError} />}
            <button
              onClick={runOptimize} disabled={optLoading}
              className="w-full py-2.5 bg-accent text-white rounded-lg text-[13px] font-semibold hover:bg-accent-dim disabled:opacity-40 transition-colors"
            >
              {optLoading ? "Optimizing…" : "Find Optimal Allocation"}
            </button>
          </div>

          <div>
            {optLoading && <div className="card p-4"><Skeleton className="h-64 w-full" /></div>}
            {optResult && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-4 text-center">
                    <p className="text-[10px] text-muted uppercase tracking-widest">Gini Before</p>
                    <p className="mono font-bold text-[22px] text-severe">{optResult.gini_before.toFixed(4)}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-[10px] text-muted uppercase tracking-widest">Gini After</p>
                    <p className="mono font-bold text-[22px] text-covered">{optResult.gini_after.toFixed(4)}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-[10px] text-muted uppercase tracking-widest">Equity Improvement</p>
                    <p className="mono font-bold text-[22px] text-accent">+{(optResult.equity_improvement * 100).toFixed(2)}%</p>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="font-semibold text-[13px]">Optimal Allocation Plan — {optResult.total_crises_benefited} crises benefited</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-surface-2">
                          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-muted">Country</th>
                          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-muted">Sector</th>
                          <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest text-muted">Allocated</th>
                          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-muted">Coverage Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optResult.top_allocations.map(a => (
                          <tr key={a.crisis_id} className="border-b border-border tr-hover">
                            <td className="px-3 py-2 text-[12px] text-text">{a.country || a.crisis_id.split("_")[0]}</td>
                            <td className="px-3 py-2 text-[12px] text-muted">{a.sector || "—"}</td>
                            <td className="px-3 py-2 text-right mono text-[12px] text-accent">{fmtUsd(a.allocated_usd)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <CoveragePct value={a.current_coverage_ratio} showBar={false} />
                                <ArrowRight size={10} className="text-faint" />
                                <CoveragePct value={a.new_coverage_ratio} showBar={false} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {!optResult && !optLoading && (
              <div className="flex items-center justify-center h-48 text-muted text-[13px] border border-dashed border-border rounded-xl">
                Enter a total budget to compute the equity-maximizing allocation.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
