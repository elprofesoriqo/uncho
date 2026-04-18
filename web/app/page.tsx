'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  Globe,
  BarChart3,
  AlertTriangle,
  Activity,
  Wifi,
  SendHorizontal,
  Bot,
  User,
  ChevronRight,
  Layers,
  ShieldAlert,
  TrendingDown,
  Users,
  DollarSign,
  X,
} from 'lucide-react';

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

// ─── SVG Map paths (simplified schematic country shapes) ─────────────────────
// Each path is a rough schematic blob — not geo-accurate, purely illustrative.

const MAP_PATHS: Array<{ id: string; d: string }> = [
  // Sudan — center-north Africa
  {
    id: 'SD',
    d: 'M 305 145 L 345 140 L 360 155 L 355 200 L 340 215 L 310 210 L 295 190 L 295 165 Z',
  },
  // Yemen — Arabian Peninsula south
  {
    id: 'YE',
    d: 'M 390 175 L 430 168 L 445 180 L 435 200 L 400 205 L 385 192 Z',
  },
  // DR Congo — central Africa
  {
    id: 'CD',
    d: 'M 290 220 L 335 215 L 350 240 L 340 275 L 305 280 L 278 260 L 280 235 Z',
  },
  // Afghanistan — central Asia
  {
    id: 'AF',
    d: 'M 445 130 L 490 120 L 510 135 L 505 158 L 470 165 L 445 155 Z',
  },
  // Ethiopia — east Africa
  {
    id: 'ET',
    d: 'M 340 220 L 375 215 L 390 235 L 378 260 L 350 262 L 335 245 Z',
  },
  // Somalia — horn of Africa
  {
    id: 'SO',
    d: 'M 380 222 L 405 218 L 420 240 L 410 268 L 388 265 L 378 245 Z',
  },
  // Syria — Levant
  {
    id: 'SY',
    d: 'M 355 118 L 390 114 L 398 130 L 385 145 L 355 142 L 348 128 Z',
  },
  // Ukraine — eastern Europe
  {
    id: 'UA',
    d: 'M 305 72 L 355 65 L 370 80 L 360 100 L 320 104 L 298 90 Z',
  },
];

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
  onCountryEnter: (id: string) => void;
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

        {/* Ocean fill */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50" />

        {/* SVG Map */}
        <svg
          viewBox="0 0 700 420"
          className="relative h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Continent silhouettes (decorative, non-interactive) */}
          {/* Africa */}
          <path
            d="M 240 95 L 420 88 L 445 110 L 455 180 L 440 280 L 395 360 L 340 375 L 280 355 L 240 290 L 220 200 L 225 130 Z"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          {/* Europe */}
          <path
            d="M 240 40 L 400 35 L 420 70 L 380 100 L 290 105 L 230 85 Z"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          {/* Middle East / Asia */}
          <path
            d="M 400 60 L 580 50 L 610 100 L 580 170 L 500 185 L 420 165 L 395 110 Z"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          {/* Asia far east */}
          <path
            d="M 575 45 L 670 40 L 680 130 L 620 160 L 578 140 L 568 80 Z"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* Interactive crisis zone paths */}
          {MAP_PATHS.map((p) => (
            <path
              key={p.id}
              d={p.d}
              className="country-path"
              onMouseEnter={() => onCountryEnter(p.id)}
              onMouseLeave={onCountryLeave}
              onClick={() => onCountryClick(p.id)}
            />
          ))}

          {/* Labels */}
          {MAP_PATHS.map((p) => {
            const c = COUNTRIES[p.id];
            if (!c) return null;
            // Rough centroid — just use a fixed offset per country
            const labelMap: Record<string, [number, number]> = {
              SD: [328, 185],
              YE: [415, 190],
              CD: [313, 250],
              AF: [477, 145],
              ET: [363, 243],
              SO: [399, 245],
              SY: [373, 132],
              UA: [333, 88],
            };
            const [lx, ly] = labelMap[p.id] ?? [0, 0];
            return (
              <text
                key={`lbl-${p.id}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="white"
                className="pointer-events-none select-none"
                style={{ letterSpacing: '0.08em' }}
              >
                {p.id}
              </text>
            );
          })}
        </svg>

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

// ─── Right Pane (AI Co-Pilot) ────────────────────────────────────────────────

function RightPane() {
  const { messages, sendMessage, status } = useChat({
    messages: SEED_MESSAGES,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || status === 'streaming') return;
    sendMessage({ text });
    setDraft('');
  }, [draft, status, sendMessage]);

  const formatContent = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**') ? (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const getMessageText = (m: UIMessage): string => {
    const textPart = m.parts.find((p) => p.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    return textPart?.text ?? '';
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#008CFF] to-[#0070CC] shadow-sm">
          <Bot size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-wide text-slate-800">AI Co-Pilot</p>
          <p className="text-[9px] text-slate-400">OCHA Crisis Intelligence</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          const text = getMessageText(m);
          return (
            <div
              key={m.id}
              className={`msg-in flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                  ${m.role === 'assistant' ? 'bg-[#008CFF]/10' : 'bg-slate-100'}`}
              >
                {m.role === 'assistant' ? (
                  <Bot size={11} className="text-[#008CFF]" />
                ) : (
                  <User size={11} className="text-slate-500" />
                )}
              </div>
              <div
                className={`max-w-[210px] rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed
                  ${m.role === 'assistant'
                    ? 'rounded-tl-sm bg-slate-50 text-slate-700 border border-slate-100'
                    : 'rounded-tr-sm bg-[#008CFF] text-white'
                  }`}
              >
                {m.role === 'assistant' ? formatContent(text) : text}
              </div>
            </div>
          );
        })}
        {status === 'streaming' && (
          <div className="flex gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#008CFF]/10">
              <Bot size={11} className="text-[#008CFF]" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-slate-400"
                  style={{ animation: 'pulse 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="border-t border-slate-100 px-4 py-2">
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          Quick Pledges
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['$500K → Sudan', '$1M → Yemen', 'DRC situation', 'Access brief'].map((chip) => (
            <button
              key={chip}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 transition-all duration-150 hover:border-[#008CFF]/40 hover:bg-[#008CFF]/5 hover:text-[#008CFF]"
              onClick={() => setDraft(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Pledge, query situation, or request brief…"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition-all duration-150 focus:border-[#008CFF]/40 focus:bg-white focus:ring-2 focus:ring-[#008CFF]/10"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || status === 'streaming'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008CFF] text-white shadow-sm transition-all duration-150 hover:bg-[#0070CC] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendHorizontal size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </aside>
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

  const handleCountryEnter = useCallback((id: string) => {
    hoveredCountryRef.current = id;
    setPortal((prev) => ({
      ...prev,
      visible: true,
      country: COUNTRIES[id] ?? null,
    }));
  }, []);

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
      <RightPane />

      {/* Context Portal — follows cursor */}
      <ContextPortal portal={portal} />
    </div>
  );
}
