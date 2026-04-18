"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { PriorityBadge } from "@/app/components/ui/PriorityBadge";
import { SystemStatusCard } from "@/app/components/ui/SystemStatusCard";
import { SidebarNavLink } from "@/app/components/ui/SidebarNavLink";
import {
  Globe,
  BarChart3,
  AlertTriangle,
  Activity,
  Bot,
  Layers,
  ShieldAlert,
  TrendingDown,
  Users,
  DollarSign,
} from "lucide-react";
import { LighthouseBrand } from "./components/ui/LighthouseBrand";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CountryData {
  id: string;
  name: string;
  priority: "CRITICAL" | "HIGH" | "MODERATE";
  fundingGap: string;
  pin: string;
  gini: number;
  aiInsight: string;
}

interface PortalState {
  visible: boolean;
  x: number;
  y: number;
  country: CountryData | null;
}

// ─── Static country data ───────────────────────────────────────────────────────

const COUNTRIES: Record<string, CountryData> = {
  SD: {
    id: "SD",
    name: "Sudan",
    priority: "CRITICAL",
    fundingGap: "$2.4B",
    pin: "17.7M",
    gini: 0.71,
    aiInsight: "Displacement surge detected — 340% above 6-mo baseline.",
  },
  YE: {
    id: "YE",
    name: "Yemen",
    priority: "CRITICAL",
    fundingGap: "$3.1B",
    pin: "21.6M",
    gini: 0.68,
    aiInsight: "Supply corridor collapse imminent — port access at 12%.",
  },
  CD: {
    id: "CD",
    name: "DR Congo",
    priority: "CRITICAL",
    fundingGap: "$1.8B",
    pin: "25.4M",
    gini: 0.65,
    aiInsight: "Cholera outbreak risk index elevated to 0.92.",
  },
  AF: {
    id: "AF",
    name: "Afghanistan",
    priority: "HIGH",
    fundingGap: "$1.2B",
    pin: "15.3M",
    gini: 0.6,
    aiInsight: "Female-headed household exclusion rate rising 18% MoM.",
  },
  ET: {
    id: "ET",
    name: "Ethiopia",
    priority: "HIGH",
    fundingGap: "$890M",
    pin: "20.1M",
    gini: 0.55,
    aiInsight:
      "Drought overlap with conflict zone — compound risk score: HIGH.",
  },
  SO: {
    id: "SO",
    name: "Somalia",
    priority: "HIGH",
    fundingGap: "$740M",
    pin: "7.8M",
    gini: 0.58,
    aiInsight:
      "Remittance flow disruption correlates with acute food insecurity.",
  },
  SY: {
    id: "SY",
    name: "Syria",
    priority: "MODERATE",
    fundingGap: "$620M",
    pin: "12.9M",
    gini: 0.52,
    aiInsight:
      "Reconstruction funding asymmetry creating urban-rural equity gap.",
  },
  UA: {
    id: "UA",
    name: "Ukraine",
    priority: "MODERATE",
    fundingGap: "$1.1B",
    pin: "14.6M",
    gini: 0.48,
    aiInsight:
      "Winter energy infrastructure damage extends humanitarian timeline.",
  },
};

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_NAME_ALIASES: Record<string, CountryData["id"]> = {
  Sudan: "SD",
  Yemen: "YE",
  "Democratic Republic of the Congo": "CD",
  "Dem. Rep. Congo": "CD",
  "Congo, the Democratic Republic of the": "CD",
  Afghanistan: "AF",
  Ethiopia: "ET",
  Somalia: "SO",
  Syria: "SY",
  "Syrian Arab Republic": "SY",
  Ukraine: "UA",
};

function getCountryByGeoName(name: string): CountryData | null {
  const id = COUNTRY_NAME_ALIASES[name];
  if (!id) return null;
  return COUNTRIES[id] ?? null;
}

function getCountryHeat(country: CountryData): string {
  const priorityWeight =
    country.priority === "CRITICAL"
      ? 0.38
      : country.priority === "HIGH"
        ? 0.26
        : 0.16;
  const intensity = Math.min(1, country.gini + priorityWeight);
  const hue = 44 - intensity * 40;
  const saturation = 92;
  const lightness = 92 - intensity * 50;
  return `hsl(${Math.round(hue)} ${saturation}% ${Math.round(lightness)}%)`;
}

function darkenColor(color: string, amount: number): string {
  const hslMatch = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/i);
  if (hslMatch) {
    const h = Number(hslMatch[1]);
    const s = Number(hslMatch[2]);
    const l = Number(hslMatch[3]);
    return `hsl(${h} ${s}% ${Math.max(0, l - amount)}%)`;
  }

  const hexMatch = color.match(/^#([\da-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const ratio = Math.max(0, Math.min(1, (100 - amount) / 100));
    const darken = (v: number) => Math.round(v * ratio);
    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }

  return color;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GiniBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value > 0.65 ? "#D32F2F" : value > 0.55 ? "#F59E0B" : "#008CFF";
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative h-1.5 flex-1 
      hidden rounded-full bg-slate-100"
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-600">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ─── Context Portal ───────────────────────────────────────────────────────────

function ContextPortal({ portal }: { portal: PortalState }) {
  if (!portal.visible || !portal.country) return null;
  const c = portal.country;

  return (
    <div
      className="portal-card fixed z-50 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
      style={{
        left: portal.x + 18,
        top: portal.y - 10,
        opacity: portal.visible ? 1 : 0,
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Active Zone
          </p>
          <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
        </div>
        <PriorityBadge level={c.priority} />
      </div>

      {/* Stats grid */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            <DollarSign size={9} /> Funding Gap
          </div>
          <p className="text-sm font-bold text-emergency-red">{c.fundingGap}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            <Users size={9} /> Target PiN
          </div>
          <p className="text-sm font-bold text-slate-800">{c.pin}</p>
        </div>
      </div>

      {/* Gini */}
      <div className="mb-3">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <TrendingDown size={9} /> Gini Coefficient
        </div>
        <GiniBar value={c.gini} />
      </div>

      {/* AI Insight badge */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <ShieldAlert size={13} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-600">
            AI Insight
          </p>
          <p className="text-[11px] leading-snug text-amber-800">
            {c.aiInsight}
          </p>
        </div>
      </div>
    </div>
  );
}

function CenterStage({
  onMouseMove,
  onCountryEnter,
  onCountryLeave,
  onCountryClick,
}: {
  onMouseMove: (e: React.MouseEvent) => void;
  onCountryEnter: (id: string, e: React.MouseEvent<SVGPathElement>) => void;
  onCountryLeave: () => void;
  onCountryClick: (id: string) => void;
}) {
  return (
    <main
      className="relative flex flex-1 flex-col overflow-hidden p-5"
      onMouseMove={onMouseMove}
    >
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LighthouseBrand />
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Global Crisis Command
            </h1>
            <p className="text-[11px] text-slate-400">
              OCHA Ops · FY 2026 · 8 active crisis zones · hover for brief ·
              click to open crisis page
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600 border border-red-100">
            <AlertTriangle size={10} /> 3 Critical Zones
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
            <Activity size={10} /> Live
          </span>
        </div>
      </div>

      {/* Map card */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* World projection map with crisis heat */}
        <div className="absolute inset-0">
          <ComposableMap
            width={800}
            height={600}
            projection="geoMercator"
            projectionConfig={{
              scale: 125,
              center: [0, 40],
            }}
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full"
          >
            <Geographies geography={GEO_URL}>
              {({
                geographies,
              }: {
                geographies: Array<{
                  rsmKey: string;
                  properties: { name?: string };
                }>;
              }) =>
                geographies
                  .filter((geo) => geo.properties?.name !== "Antarctica")
                  .map(
                    (geo: {
                      rsmKey: string;
                      properties: { name?: string };
                    }) => {
                      const geoName =
                        (geo.properties as { name?: string }).name ?? "";
                      const crisisCountry = getCountryByGeoName(geoName);
                      const baseFill = crisisCountry
                        ? getCountryHeat(crisisCountry)
                        : "#E8EDF3";

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={(
                            e: React.MouseEvent<SVGPathElement>,
                          ) => {
                            if (!crisisCountry) return;
                            onCountryEnter(crisisCountry.id, e);
                          }}
                          onMouseLeave={onCountryLeave}
                          onClick={() =>
                            crisisCountry && onCountryClick(crisisCountry.id)
                          }
                          style={{
                            default: {
                              fill: baseFill,
                              stroke: "#D6DEE8",
                              strokeWidth: 0.45,
                              outline: "none",
                            },
                            hover: {
                              fill: darkenColor(baseFill, 5),
                              stroke: "#D6DEE8",
                              strokeWidth: 0.45,
                              outline: "none",
                              cursor: crisisCountry ? "pointer" : "default",
                            },
                            pressed: {
                              fill: darkenColor(baseFill, 5),
                              stroke: "#D6DEE8",
                              strokeWidth: 0.45,
                              outline: "none",
                            },
                          }}
                        />
                      );
                    },
                  )
              }
            </Geographies>
          </ComposableMap>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur-sm shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Legend
          </span>
          {[
            { color: "#008CFF", label: "Active Zone" },
            { color: "#D32F2F", label: "Critical" },
            { color: "#f1f5f9", label: "Region" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: l.color }}
              />
              <span className="text-[10px] text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export default function LighthouseOS() {
  const router = useRouter();
  const [portal, setPortal] = useState<PortalState>({
    visible: false,
    x: 0,
    y: 0,
    country: null,
  });

  const hoveredCountryRef = useRef<string | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hoveredCountryRef.current) return;
    setPortal((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
  }, []);

  const handleCountryEnter = useCallback(
    (id: string, e: React.MouseEvent<SVGPathElement>) => {
      hoveredCountryRef.current = id;
      setPortal((prev) => ({
        ...prev,
        visible: true,
        x: e.clientX,
        y: e.clientY,
        country: COUNTRIES[id] ?? null,
      }));
    },
    [],
  );

  const handleCountryLeave = useCallback(() => {
    hoveredCountryRef.current = null;
    setPortal((prev) => ({ ...prev, visible: false, country: null }));
  }, []);

  const handleCountryClick = useCallback(
    (id: string) => {
      router.push(`/crisis/${id}`);
    },
    [router],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      {/* <LeftPane /> */}
      <CenterStage
        onMouseMove={handleMouseMove}
        onCountryEnter={handleCountryEnter}
        onCountryLeave={handleCountryLeave}
        onCountryClick={handleCountryClick}
      />
      {/* <AICopilot
        seedMessages={SEED_MESSAGES}
        quickPrompts={[
          "$500K → Sudan",
          "$1M → Yemen",
          "DRC situation",
          "Access brief",
        ]}
      /> */}

      {/* Context Portal — follows cursor */}
      <ContextPortal portal={portal} />
    </div>
  );
}
