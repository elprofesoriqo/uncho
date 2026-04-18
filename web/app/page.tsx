'use client';

import { useRef, useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { type UIMessage } from "ai";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { AICopilot } from './components/AICopilot';
import {
  Globe,
  BarChart3,
  AlertTriangle,
  Activity,
  Wifi,
  Bot,
  ChevronRight,
  Layers,
  ShieldAlert,
  TrendingDown,
  Users,
  DollarSign,
} from 'lucide-react';
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CountryData {
  id: string;
  name: string;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE';
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
    id: 'SD',
    name: 'Sudan',
    priority: 'CRITICAL',
    fundingGap: '$2.4B',
    pin: '17.7M',
    gini: 0.71,
    aiInsight: 'Displacement surge detected — 340% above 6-mo baseline.',
  },
  YE: {
    id: 'YE',
    name: 'Yemen',
    priority: 'CRITICAL',
    fundingGap: '$3.1B',
    pin: '21.6M',
    gini: 0.68,
    aiInsight: 'Supply corridor collapse imminent — port access at 12%.',
  },
  CD: {
    id: 'CD',
    name: 'DR Congo',
    priority: 'CRITICAL',
    fundingGap: '$1.8B',
    pin: '25.4M',
    gini: 0.65,
    aiInsight: 'Cholera outbreak risk index elevated to 0.92.',
  },
  AF: {
    id: 'AF',
    name: 'Afghanistan',
    priority: 'HIGH',
    fundingGap: '$1.2B',
    pin: '15.3M',
    gini: 0.60,
    aiInsight: 'Female-headed household exclusion rate rising 18% MoM.',
  },
  ET: {
    id: 'ET',
    name: 'Ethiopia',
    priority: 'HIGH',
    fundingGap: '$890M',
    pin: '20.1M',
    gini: 0.55,
    aiInsight: 'Drought overlap with conflict zone — compound risk score: HIGH.',
  },
  SO: {
    id: 'SO',
    name: 'Somalia',
    priority: 'HIGH',
    fundingGap: '$740M',
    pin: '7.8M',
    gini: 0.58,
    aiInsight: 'Remittance flow disruption correlates with acute food insecurity.',
  },
  SY: {
    id: 'SY',
    name: 'Syria',
    priority: 'MODERATE',
    fundingGap: '$620M',
    pin: '12.9M',
    gini: 0.52,
    aiInsight: 'Reconstruction funding asymmetry creating urban-rural equity gap.',
  },
  UA: {
    id: 'UA',
    name: 'Ukraine',
    priority: 'MODERATE',
    fundingGap: '$1.1B',
    pin: '14.6M',
    gini: 0.48,
    aiInsight: 'Winter energy infrastructure damage extends humanitarian timeline.',
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-amber-100 text-amber-700 border-amber-200',
  MODERATE: 'bg-blue-100 text-blue-700 border-blue-200',
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_NAME_ALIASES: Record<string, CountryData['id']> = {
  Sudan: 'SD',
  Yemen: 'YE',
  'Democratic Republic of the Congo': 'CD',
  'Dem. Rep. Congo': 'CD',
  'Congo, the Democratic Republic of the': 'CD',
  Afghanistan: 'AF',
  Ethiopia: 'ET',
  Somalia: 'SO',
  Syria: 'SY',
  'Syrian Arab Republic': 'SY',
  Ukraine: 'UA',
};

// ─── Sample seed messages for the AI pane ────────────────────────────────────

const SEED_MESSAGES: UIMessage[] = [
  {
    id: 'seed-1',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'OCHA Situation Digest — April 2026: **3 critical zones** require immediate response. Sudan displacement is up **340% YoY**; Yemen Hudaydah port access is at **12%** of normal throughput; DRC cholera outbreak risk index has reached **0.92**. Recommend activating Level-3 Emergency Relief Fund and prioritising northern corridor access in the next 72-hour window.',
      },
    ],
  },
];

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({
  icon: Icon,
  label,
  active = false,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
        ${active
          ? 'bg-[#008CFF]/10 text-[#008CFF]'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
    >
      <Icon size={16} strokeWidth={2} />
      <span>{label}</span>
      {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
    </button>
  );
}

function PriorityBadge({ level }: { level: CountryData['priority'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[level]}`}
    >
      {level === 'CRITICAL' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      {level === 'HIGH' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
      {level === 'MODERATE' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
      {level}
    </span>
  );
}

function GiniBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value > 0.65 ? '#D32F2F' : value > 0.55 ? '#F59E0B' : '#008CFF';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 
      hidden rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-600">{value.toFixed(2)}</span>
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
          <p className="text-sm font-bold text-[#D32F2F]">{c.fundingGap}</p>
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
          <p className="text-[11px] leading-snug text-amber-800">{c.aiInsight}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Left Pane ────────────────────────────────────────────────────────────────

function LeftPane() {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#008CFF] shadow-sm">
          <Globe size={16} className="text-white" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-[11px] font-bold leading-none tracking-widest text-[#008CFF] uppercase">
            Lighthouse
          </p>
          <p className="text-[9px] font-medium tracking-widest text-slate-400 uppercase">
            OS · v2.4.1
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          Operations
        </p>
        <NavLink icon={Globe} label="Crisis Overview" active />
        <NavLink icon={BarChart3} label="Funding Gaps" />
        <NavLink icon={TrendingDown} label="Access Corridors" />
        <NavLink icon={Users} label="PiN Registry" />

        <p className="mb-2 mt-5 px-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          Intelligence
        </p>
        <NavLink icon={Bot} label="AI Co-Pilot" />
        <NavLink icon={Layers} label="Cluster Data" />
        <NavLink icon={ShieldAlert} label="Alert Feed" />
      </nav>

      {/* System Health */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-[10px] font-bold text-emerald-700">Backend Linked</p>
            <p className="text-[9px] text-emerald-600">8 feeds · 42ms</p>
          </div>
          <Wifi size={11} className="ml-auto text-emerald-500" />
        </div>
      </div>
    </aside>
  );
}

// ─── Center Stage (Map) ───────────────────────────────────────────────────────

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
    <main className="relative flex flex-1 flex-col overflow-hidden p-5" onMouseMove={onMouseMove}>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Global Crisis Command</h1>
          <p className="text-[11px] text-slate-400">
            OCHA Ops · FY 2026 · 8 active crisis zones · hover for brief · click to open crisis page
          </p>
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
      <div
        className="relative flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
        style={{ boxShadow: '0 8px 40px rgba(0,140,255,0.07), 0 2px 8px rgba(0,0,0,0.05)' }}
      >
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* World projection map with crisis heat */}
        <div className="absolute inset-0">
          <ComposableMap
            width={800}
            height={600}
            projection="geoMercator"
            projectionConfig={{
              scale: 120,
              center: [0, 46],
            }}
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full"
          >
            <Geographies geography={GEO_URL} >
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
                          onClick={() => crisisCountry && onCountryClick(crisisCountry.id)}
                          style={{
                            default: {
                              fill: baseFill,
                              stroke: "#D6DEE8",
                              strokeWidth: 0.45,
                              outline: "none",
                            },
                            hover: {
                              fill: crisisCountry ? "#D32F2F" : "#DDE4EC",
                              stroke: "#BFC9D6",
                              strokeWidth: 0.6,
                              outline: "none",
                              cursor: crisisCountry ? "pointer" : "default",
                            },
                            pressed: {
                              fill: crisisCountry ? "#B71C1C" : "#DDE4EC",
                              stroke: "#BFC9D6",
                              strokeWidth: 0.6,
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
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Legend</span>
          {[
            { color: '#008CFF', label: 'Active Zone' },
            { color: '#D32F2F', label: 'Hovered / Critical' },
            { color: '#f1f5f9', label: 'Region' },
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

  const handleCountryClick = useCallback((id: string) => {
    router.push(`/crisis/${id}`);
  }, [router]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <LeftPane />
      <CenterStage
        onMouseMove={handleMouseMove}
        onCountryEnter={handleCountryEnter}
        onCountryLeave={handleCountryLeave}
        onCountryClick={handleCountryClick}
      />
      <AICopilot
        seedMessages={SEED_MESSAGES}
        quickPrompts={['$500K → Sudan', '$1M → Yemen', 'DRC situation', 'Access brief']}
      />

      {/* Context Portal — follows cursor */}
      <ContextPortal portal={portal} />
    </div>
  );
}
