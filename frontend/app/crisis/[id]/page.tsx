"use client";
import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell,
} from "recharts";
import { api } from "@/lib/api";
import { Skeleton, ErrorBanner, StatRow } from "@/components/ui/Primitives";
import { CoveragePct, MismatchScore } from "@/components/ui/Primitives";
import { ConfidenceBadge, CrisisTypeBadge } from "@/components/ui/Badge";

function ScoreBar({ label, value, max = 3, color = "#3b82f6" }: {
  label: string; value: number; max?: number; color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="mono text-[11px] text-text">{value.toFixed(3)}</span>
      </div>
      <div className="h-1.5 bg-border-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const SCORE_COLORS: Record<string, string> = {
  need_weight: "#3b82f6",
  gap_severity: "#ef4444",
  structural_multiplier: "#f97316",
  urgency_weight: "#eab308",
  visibility_penalty: "#a855f7",
  efficiency_discount: "#06b6d4",
};

export default function CrisisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);

  const { data: crisisRes, error: crisisErr } = useSWR(`crisis-${decodedId}`, () => api.crisisDetail(decodedId));
  const { data: sectorsRes } = useSWR(`crisis-sectors-${decodedId}`, () => api.crisisSectors(decodedId));
  const { data: donorsRes } = useSWR(`crisis-donors-${decodedId}`, () => api.crisisDonors(decodedId));
  const { data: relatedRes } = useSWR(`crisis-related-${decodedId}`, () => api.crisisRelated(decodedId));
  const { data: narrativeRes } = useSWR(`crisis-narrative-${decodedId}`, () => api.narrative(decodedId));

  if (crisisErr) return (
    <div className="p-6">
      <Link href="/rankings" className="flex items-center gap-1.5 text-muted hover:text-text text-[13px] mb-4"><ArrowLeft size={13} /> Back</Link>
      <ErrorBanner error={`Crisis not found: ${crisisErr.message}`} />
    </div>
  );

  const c = crisisRes?.crisis;

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      {/* Nav */}
      <Link href="/rankings" className="flex items-center gap-1.5 text-muted hover:text-text text-[13px] mb-5 w-fit">
        <ArrowLeft size={13} /> Back to Rankings
      </Link>

      {/* Hero */}
      <div className="card p-5 mb-4">
        {!c ? (
          <div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-48" /></div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-[22px] font-bold text-text">{c.country}</h1>
                <span className="mono text-[13px] text-faint">{c.iso3}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted text-[13px]">{c.sector} · {c.year}</span>
                <CrisisTypeBadge type={c.crisis_type} />
                <ConfidenceBadge level={c.confidence_level} />
              </div>
              {narrativeRes?.human_narratives?.[0] && (
                <p className="mt-3 text-[13px] text-muted italic max-w-[600px] leading-relaxed">
                  "{narrativeRes.human_narratives[0]}"
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] text-faint uppercase tracking-widest">Global Rank</p>
                <p className="mono font-bold text-[28px] text-accent">#{c.global_rank || "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-faint uppercase tracking-widest">MismatchScore</p>
                <MismatchScore value={c.mismatch_score} lower={c.mismatch_score_lower_bound} upper={c.mismatch_score_upper_bound} />
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/simulator?crisis=${decodedId}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent rounded-lg text-[12px] hover:bg-accent/20">
                  <ExternalLink size={12} /> Simulate Impact
                </Link>
                <a href={`/api/dossier?crisis_id=${decodedId}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border text-muted rounded-lg text-[12px] hover:text-text hover:border-border-2">
                  <FileText size={12} /> Generate Dossier
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score decomposition */}
        <div className="card p-4">
          <h2 className="font-semibold text-[13px] mb-3 pb-2 border-b border-border">Score Decomposition</h2>
          {!c ? <Skeleton className="h-40 w-full" /> : (
            <div>
              {[
                { label: "Need Weight", key: "need_weight", max: 2 },
                { label: "Gap Severity", key: "gap_severity", max: 2 },
                { label: "Structural Multiplier", key: "structural_multiplier", max: 3 },
                { label: "Urgency Weight", key: "urgency_weight", max: 2 },
                { label: "Visibility Penalty", key: "visibility_penalty", max: 2 },
                { label: "Efficiency Discount", key: "efficiency_discount", max: 1 },
              ].map(({ label, key, max }) => (
                <ScoreBar key={key} label={label} value={+(c as unknown as Record<string, number>)[key] || 0} max={max} color={SCORE_COLORS[key]} />
              ))}
            </div>
          )}
        </div>

        {/* Financial snapshot */}
        <div className="card p-4">
          <h2 className="font-semibold text-[13px] mb-3 pb-2 border-b border-border">Financial Snapshot</h2>
          {!c ? <Skeleton className="h-40 w-full" /> : (
            <>
              <StatRow label="Requirements" value={`$${(+c.requirements_usd / 1e6).toFixed(1)}M`} />
              <StatRow label="Funded" value={`$${(+c.funding_usd / 1e6).toFixed(1)}M`} />
              <StatRow label="Gap" value={`$${Math.max(0, (+c.requirements_usd - +c.funding_usd) / 1e6).toFixed(1)}M`} />
              <StatRow label="Coverage" value={<CoveragePct value={+c.coverage_ratio} />} mono={false} />
              <StatRow label="People in Need" value={+c.people_in_need >= 1e6 ? `${(+c.people_in_need / 1e6).toFixed(2)}M` : (+c.people_in_need)?.toLocaleString()} />
              <StatRow label="INFORM Severity" value={+c.inform_severity > 0 ? `${(+c.inform_severity).toFixed(1)} / 5.0` : "—"} />
              {donorsRes?.donor_data?.[0] && (
                <>
                  <StatRow label="Top Donor" value={String(donorsRes.donor_data[0].top_donor ?? "—")} mono={false} />
                  <StatRow label="HHI Index" value={(+donorsRes.donor_data[0].hhi_index).toFixed(3)} />
                </>
              )}
            </>
          )}
        </div>

        {/* Kumo predictions */}
        <div className="card p-4">
          <h2 className="font-semibold text-[13px] mb-3 pb-2 border-b border-border">Kumo.AI Forecast</h2>
          {!c ? <Skeleton className="h-40 w-full" /> : c.kumo_predictions && Object.keys(c.kumo_predictions).length > 0 ? (
            <>
              {c.kumo_predictions.velocity && (
                <StatRow label="Disbursement 6M" value={`${(+(c.kumo_predictions.velocity.predicted_disbursement_pct_6m ?? 0) * 100).toFixed(1)}%`} />
              )}
              {c.kumo_predictions.gap && (
                <>
                  <StatRow label="Predicted Coverage 6M" value={`${(+(c.kumo_predictions.gap.predicted_coverage_6m ?? 0) * 100).toFixed(1)}%`} />
                  <StatRow label="Confidence Interval" value={`[${(+(c.kumo_predictions.gap.confidence_lower ?? 0) * 100).toFixed(1)}%, ${(+(c.kumo_predictions.gap.confidence_upper ?? 0) * 100).toFixed(1)}%]`} />
                </>
              )}
              {c.kumo_predictions.cascade && (
                <StatRow label="Cascade Risk" value={`${(+(c.kumo_predictions.cascade.predicted_cascade_risk ?? 0) * 100).toFixed(1)}%`} />
              )}
            </>
          ) : (
            <p className="text-[12px] text-faint py-4">No Kumo predictions available. Run the Kumo inference pipeline to generate forecasts.</p>
          )}
        </div>
      </div>

      {/* Sector breakdown chart */}
      {sectorsRes?.sectors && sectorsRes.sectors.length > 0 && (
        <div className="card p-4 mt-4">
          <h2 className="font-semibold text-[13px] mb-4">Sector Funding Coverage</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sectorsRes.sectors} layout="vertical" margin={{ left: 100, right: 40 }}>
              <CartesianGrid horizontal={false} stroke="#1a2538" />
              <XAxis type="number" domain={[0, 1]} tickFormatter={v => `${(+v * 100).toFixed(0)}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="sector" width={95} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Coverage"]}
                contentStyle={{ backgroundColor: "#0d1424", border: "1px solid #1a2538", borderRadius: "8px", fontSize: 12 }}
              />
              <Bar dataKey="coverage_ratio" radius={[0, 3, 3, 0]}>
                {sectorsRes.sectors.map((entry, i) => (
                  <Cell key={i} fill={+entry.coverage_ratio >= 0.6 ? "#16a34a" : +entry.coverage_ratio >= 0.3 ? "#ca8a04" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Related crises */}
      {relatedRes?.related && relatedRes.related.length > 0 && (
        <div className="card p-4 mt-4">
          <h2 className="font-semibold text-[13px] mb-3">Structurally Similar Crises</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {relatedRes.related.map(r => (
              <Link key={r.crisis_id} href={`/crisis/${r.crisis_id}`} className="card p-3 hover:bg-surface-2 transition-colors border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-text">{r.country}</span>
                  <span className="mono text-[11px] text-faint">{r.year}</span>
                </div>
                <span className="text-[11px] text-muted">{r.sector}</span>
                <div className="mt-2">
                  <CoveragePct value={r.coverage_ratio} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
