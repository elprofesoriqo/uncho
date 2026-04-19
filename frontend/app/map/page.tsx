"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { GeoFeature } from "@/lib/types";
import { Skeleton, ErrorBanner } from "@/components/ui/Primitives";
import { clsx } from "clsx";

const WorldMap = dynamic(() => import("@/components/charts/WorldMap"), { ssr: false, loading: () => <div className="skeleton flex-1 rounded-xl" /> });

const MAP_MODES = [
  { id: "CHOROPLETH_COVERAGE",  label: "Coverage",        desc: "Funding coverage ratio by country" },
  { id: "CHOROPLETH_MISMATCH",  label: "Mismatch Score",  desc: "Composite neglect score by country" },
  { id: "HEATMAP_SEVERITY",     label: "INFORM Severity", desc: "Crisis severity intensity" },
  { id: "HEATMAP_PIN",          label: "People in Need",  desc: "Population in need density" },
  { id: "BUBBLE_MAP",           label: "Bubble Map",      desc: "PiN size · coverage color" },
  { id: "FLOW_DONORS",          label: "Donor Flows",     desc: "Top donor concentration" },
  { id: "PREDICTIVE_RISK",      label: "Predictive Risk", desc: "Kumo 6-month coverage forecast" },
];

const ENCODING_FIELD: Record<string, string> = {
  CHOROPLETH_COVERAGE: "coverage_ratio",
  CHOROPLETH_MISMATCH: "mismatch_score",
  HEATMAP_SEVERITY: "inform_severity",
  HEATMAP_PIN: "people_in_need",
  BUBBLE_MAP: "coverage_ratio",
  FLOW_DONORS: "hhi_index",
  PREDICTIVE_RISK: "predicted_change",
};

const LEGENDS: Record<string, { color: string; label: string }[]> = {
  CHOROPLETH_COVERAGE: [["#dc2626","0–20%"],["#ea580c","20–40%"],["#ca8a04","40–60%"],["#65a30d","60–80%"],["#16a34a","80–100%"]].map(([c,l]) => ({ color: c, label: l })),
  CHOROPLETH_MISMATCH: [["#16a34a","Low"],["#ca8a04","Medium"],["#ea580c","High"],["#dc2626","Critical"]].map(([c,l]) => ({ color: c, label: l })),
  HEATMAP_SEVERITY: [["#65a30d","1–2"],["#ca8a04","2–3"],["#ea580c","3–4"],["#dc2626","4–5 (Max)"]].map(([c,l]) => ({ color: c, label: l })),
  HEATMAP_PIN: [["#65a30d","< 500K"],["#ca8a04","0.5–2M"],["#ea580c","2–5M"],["#dc2626","> 5M"]].map(([c,l]) => ({ color: c, label: l })),
  BUBBLE_MAP: [["#dc2626","< 20%"],["#ca8a04","40–60%"],["#16a34a","> 80%"]].map(([c,l]) => ({ color: c, label: l })),
  FLOW_DONORS: [["#16a34a","Diversified (HHI < 0.15)"],["#ca8a04","Moderate"],["#dc2626","High concentration (HHI > 0.25)"]].map(([c,l]) => ({ color: c, label: l })),
  PREDICTIVE_RISK: [["#dc2626","Declining"],["#ca8a04","Stable"],["#16a34a","Improving"]].map(([c,l]) => ({ color: c, label: l })),
};

function CountryPanel({ iso3, onClose }: { iso3: string; onClose: () => void }) {
  const { data, error } = useSWR(`country-${iso3}`, () => api.countryDetail(iso3));
  return (
    <div className="absolute right-0 top-0 bottom-0 w-[320px] bg-surface border-l border-border overflow-y-auto z-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface z-10">
        <span className="font-semibold text-[14px]">{iso3.toUpperCase()}</span>
        <button onClick={onClose} className="text-muted hover:text-text text-[11px] px-2 py-1 rounded border border-border hover:border-border-2">✕ Close</button>
      </div>
      {error ? <div className="p-4 text-severe text-[12px]">Failed to load country data.</div> : !data ? (
        <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : (
        <div className="p-4 space-y-2">
          {data.crises.map(c => (
            <a key={c.crisis_id} href={`/crisis/${c.crisis_id}`} className="block card p-3 hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-text">{c.sector}</span>
                <span className="mono text-[11px] text-muted">{c.year}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-border-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(c.coverage_ratio * 100, 100)}%`,
                    backgroundColor: c.coverage_ratio >= 0.6 ? "#16a34a" : c.coverage_ratio >= 0.4 ? "#ca8a04" : "#dc2626"
                  }} />
                </div>
                <span className="mono text-[11px]" style={{
                  color: c.coverage_ratio >= 0.6 ? "#16a34a" : c.coverage_ratio >= 0.4 ? "#ca8a04" : "#dc2626"
                }}>{(c.coverage_ratio * 100).toFixed(1)}%</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  const [mode, setMode] = useState("CHOROPLETH_COVERAGE");
  const [year, setYear] = useState("");
  const [sector, setSector] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, error } = useSWR(
    ["map", mode, year, sector],
    () => api.mapData(mode, year || undefined, sector || undefined),
    { refreshInterval: 300_000 }
  );

  const modeInfo = MAP_MODES.find(m => m.id === mode);
  const features = (data?.features ?? data?.points ?? data?.bubbles ?? []) as GeoFeature[];
  const encField = ENCODING_FIELD[mode] ?? "coverage_ratio";

  return (
    <div className="flex flex-col h-screen relative">
      {/* Top controls bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-border z-10 flex-shrink-0 overflow-x-auto">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-faint mr-2 whitespace-nowrap">Map Mode</span>
        {MAP_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
              mode === m.id
                ? "bg-accent/10 text-accent border border-accent/30"
                : "text-muted hover:text-text border border-transparent hover:border-border"
            )}
          >
            {m.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text" placeholder="Filter sector…" value={sector} onChange={e => setSector(e.target.value)}
            className="bg-surface-2 border border-border text-text text-[11px] rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="p-6"><ErrorBanner error={`Failed to load map data: ${error.message}`} /></div>
        ) : !data ? (
          <div className="flex items-center justify-center h-full text-muted text-[13px]">Loading map data…</div>
        ) : (
          <WorldMap
            features={features}
            encodingField={encField}
            height={undefined as unknown as number}
            onCountryClick={setSelected}
          />
        )}

        {/* Mode info chip */}
        <div className="absolute top-3 left-3 bg-surface/90 border border-border rounded-lg px-3 py-2 text-[11px]">
          <p className="font-semibold text-text">{modeInfo?.label}</p>
          <p className="text-muted mt-0.5">{modeInfo?.desc}</p>
          {data?.warning && <p className="text-[#ca8a04] mt-0.5">{data.warning}</p>}
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-surface/90 border border-border rounded-lg px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-faint mb-1.5">Legend</p>
          <div className="flex flex-col gap-1">
            {(LEGENDS[mode] ?? []).map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Country panel */}
        {selected && <CountryPanel iso3={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
