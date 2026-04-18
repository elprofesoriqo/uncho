'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type UIMessage } from 'ai';
import {
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  Users,
  TrendingDown,
  Globe,
  Wifi,
  FileText,
  FlaskConical,
  ChevronDown,
  Download,
  RefreshCw,
  ExternalLink,
  Newspaper,
} from 'lucide-react';
import { AICopilot } from '../../components/AICopilot';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CountryData {
  id: string;
  name: string;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE';
  fundingGap: string;
  pin: string;
  gini: number;
  aiInsight: string;
  region: string;
  conflictType: string;
  responseYear: number;
  totalRequired: string;
  totalReceived: string;
  fundingPct: number;
  sectors: SectorData[];
  allocationMismatch: MismatchItem[];
  reliefwebUpdates: ReliefUpdate[];
  simulationBase: SimulationState;
}

interface SectorData {
  name: string;
  required: number;
  received: number;
  pin: number;
  unit: string;
}

interface MismatchItem {
  sector: string;
  needScore: number;
  fundingScore: number;
  gap: string;
}

interface ReliefUpdate {
  id: string;
  title: string;
  date: string;
  source: string;
  type: 'report' | 'alert' | 'update';
  snippet: string;
}

interface SimulationState {
  fundingBoost: number;
  corridorAccess: number;
  staffSurge: number;
}

// ─── Country dataset ──────────────────────────────────────────────────────────

const COUNTRIES: Record<string, CountryData> = {
  SD: {
    id: 'SD', name: 'Sudan', priority: 'CRITICAL', region: 'East Africa',
    conflictType: 'Armed conflict + mass displacement',
    responseYear: 2024, totalRequired: '$4.1B', totalReceived: '$1.7B',
    fundingGap: '$2.4B', pin: '17.7M', gini: 0.71, fundingPct: 41,
    aiInsight: 'Displacement surge detected — 340% above 6-mo baseline.',
    sectors: [
      { name: 'Food Security', required: 1400, received: 520, pin: 8200, unit: 'K people' },
      { name: 'Health', required: 680, received: 190, pin: 5100, unit: 'K people' },
      { name: 'WASH', required: 520, received: 110, pin: 6400, unit: 'K people' },
      { name: 'Shelter', required: 480, received: 200, pin: 3900, unit: 'K people' },
      { name: 'Protection', required: 360, received: 85, pin: 4200, unit: 'K people' },
      { name: 'Education', required: 210, received: 40, pin: 2800, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'WASH', needScore: 92, fundingScore: 21, gap: 'Severely underfunded vs need' },
      { sector: 'Protection', needScore: 88, fundingScore: 24, gap: 'Critical gap — gender-based violence surge' },
      { sector: 'Health', needScore: 85, fundingScore: 28, gap: 'Cholera risk unaddressed' },
      { sector: 'Food Security', needScore: 78, fundingScore: 37, gap: 'Largest absolute gap' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Sudan: Over 10 million displaced — largest crisis globally', date: '2026-04-15', source: 'UNHCR', type: 'alert', snippet: 'Sudan has surpassed all other crises in total displacement with over 10.7M IDPs recorded as of April 2026.' },
      { id: 'rw2', title: 'Humanitarian access update: Darfur corridors partially reopened', date: '2026-04-12', source: 'OCHA', type: 'update', snippet: 'Armed escort agreements allow limited convoy passage through Wad Madani and El Obeid — capacity 40% of pre-conflict levels.' },
      { id: 'rw3', title: 'Cholera outbreak confirmed in North Kordofan', date: '2026-04-10', source: 'WHO', type: 'alert', snippet: '2,300+ cases confirmed; response hampered by supply chain disruption and insufficient oral rehydration salt stocks.' },
      { id: 'rw4', title: 'Sudan Humanitarian Fund: Emergency allocation of $18M approved', date: '2026-04-08', source: 'SHF', type: 'report', snippet: 'Funds earmarked for health and WASH clusters in White Nile and Kassala states.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 40, staffSurge: 0 },
  },
  YE: {
    id: 'YE', name: 'Yemen', priority: 'CRITICAL', region: 'Arabian Peninsula',
    conflictType: 'Protracted armed conflict + economic collapse',
    responseYear: 2015, totalRequired: '$4.3B', totalReceived: '$1.2B',
    fundingGap: '$3.1B', pin: '21.6M', gini: 0.68, fundingPct: 28,
    aiInsight: 'Supply corridor collapse imminent — port access at 12%.',
    sectors: [
      { name: 'Food Security', required: 1800, received: 420, pin: 13000, unit: 'K people' },
      { name: 'Health', required: 720, received: 180, pin: 7200, unit: 'K people' },
      { name: 'WASH', required: 580, received: 90, pin: 8400, unit: 'K people' },
      { name: 'Shelter', required: 420, received: 80, pin: 4100, unit: 'K people' },
      { name: 'Protection', required: 380, received: 60, pin: 3900, unit: 'K people' },
      { name: 'Education', required: 180, received: 22, pin: 3100, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'Food Security', needScore: 97, fundingScore: 23, gap: 'Famine threshold breached in 3 governorates' },
      { sector: 'WASH', needScore: 90, fundingScore: 16, gap: 'Cholera endemic — water systems destroyed' },
      { sector: 'Education', needScore: 72, fundingScore: 12, gap: 'Lost generation risk — 3M children out of school' },
      { sector: 'Protection', needScore: 85, fundingScore: 16, gap: 'Detention and trafficking spike unaddressed' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Yemen: Hudaydah port throughput at historic low — 12% capacity', date: '2026-04-14', source: 'WFP', type: 'alert', snippet: 'Port damage and access restrictions have reduced import throughput to 12% of baseline, threatening food pipeline for 13M people.' },
      { id: 'rw2', title: 'Famine declared in Al Hudaydah and Taizz governorates', date: '2026-04-11', source: 'IPC', type: 'alert', snippet: 'IPC Phase 5 conditions confirmed for the first time since 2022. Immediate scale-up required.' },
      { id: 'rw3', title: 'Yemen Humanitarian Fund releases $22M for emergency response', date: '2026-04-09', source: 'YHF', type: 'report', snippet: 'Allocation focused on food security and health clusters in southern governorates.' },
      { id: 'rw4', title: 'Airstrikes disrupt humanitarian convoy in Marib', date: '2026-04-06', source: 'OCHA', type: 'update', snippet: 'Three WFP trucks destroyed; staff evacuated. Route suspended pending security assessment.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 12, staffSurge: 0 },
  },
  CD: {
    id: 'CD', name: 'DR Congo', priority: 'CRITICAL', region: 'Central Africa',
    conflictType: 'Multi-actor armed conflict + disease outbreaks',
    responseYear: 2000, totalRequired: '$2.6B', totalReceived: '$0.8B',
    fundingGap: '$1.8B', pin: '25.4M', gini: 0.65, fundingPct: 31,
    aiInsight: 'Cholera outbreak risk index elevated to 0.92.',
    sectors: [
      { name: 'Food Security', required: 980, received: 310, pin: 10200, unit: 'K people' },
      { name: 'Health', required: 560, received: 140, pin: 6800, unit: 'K people' },
      { name: 'WASH', required: 420, received: 80, pin: 7100, unit: 'K people' },
      { name: 'Shelter', required: 320, received: 90, pin: 4600, unit: 'K people' },
      { name: 'Protection', required: 280, received: 55, pin: 5200, unit: 'K people' },
      { name: 'Education', required: 160, received: 28, pin: 3800, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'WASH', needScore: 93, fundingScore: 19, gap: 'Cholera endemic — 0.92 outbreak risk index' },
      { sector: 'Protection', needScore: 89, fundingScore: 20, gap: 'SGBV epidemic in eastern provinces' },
      { sector: 'Health', needScore: 84, fundingScore: 25, gap: 'Mpox + cholera + measles concurrent outbreaks' },
      { sector: 'Education', needScore: 67, fundingScore: 18, gap: 'School destruction in conflict zones' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'DRC: Cholera cases surpass 40,000 in Q1 2026', date: '2026-04-13', source: 'WHO', type: 'alert', snippet: 'Eastern provinces account for 72% of cases. Response capacity overwhelmed; ORS and IV fluids critically depleted.' },
      { id: 'rw2', title: 'M23 advance displaces 500K in North Kivu within two weeks', date: '2026-04-10', source: 'UNHCR', type: 'alert', snippet: 'Displacement camps overwhelmed. Shelter, food, and protection needs critical.' },
      { id: 'rw3', title: 'CERF releases $8M for DRC emergency response', date: '2026-04-07', source: 'CERF', type: 'report', snippet: 'Funds to address acute health and food security needs in Ituri and South Kivu.' },
      { id: 'rw4', title: 'Humanitarian workers arrested in Butembo — access concerns', date: '2026-04-05', source: 'OCHA', type: 'update', snippet: 'Three NGO staff detained for 48 hours; situation resolved but access environment deteriorating.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 55, staffSurge: 0 },
  },
  AF: {
    id: 'AF', name: 'Afghanistan', priority: 'HIGH', region: 'South Asia',
    conflictType: 'Political crisis + economic collapse',
    responseYear: 2021, totalRequired: '$3.1B', totalReceived: '$1.9B',
    fundingGap: '$1.2B', pin: '15.3M', gini: 0.60, fundingPct: 61,
    aiInsight: 'Female-headed household exclusion rate rising 18% MoM.',
    sectors: [
      { name: 'Food Security', required: 1100, received: 680, pin: 7200, unit: 'K people' },
      { name: 'Health', required: 480, received: 290, pin: 4100, unit: 'K people' },
      { name: 'WASH', required: 360, received: 160, pin: 5200, unit: 'K people' },
      { name: 'Shelter', required: 280, received: 190, pin: 2800, unit: 'K people' },
      { name: 'Protection', required: 310, received: 80, pin: 4800, unit: 'K people' },
      { name: 'Education', required: 240, received: 50, pin: 6100, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'Education', needScore: 91, fundingScore: 21, gap: 'Girls education banned — 6M children excluded' },
      { sector: 'Protection', needScore: 88, fundingScore: 26, gap: 'Women exclusion from aid delivery critical' },
      { sector: 'WASH', needScore: 74, fundingScore: 44, gap: 'Urban-rural equity gap widening' },
      { sector: 'Health', needScore: 70, fundingScore: 60, gap: 'Female healthcare workers barred from clinics' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Afghanistan: Female-headed households excluded from 42% of aid programmes', date: '2026-04-14', source: 'UN Women', type: 'alert', snippet: 'Restrictions on female aid workers increasingly blocking last-mile delivery to women-led households.' },
      { id: 'rw2', title: 'Winter assessment: 3.2M face acute food insecurity in rural south', date: '2026-04-11', source: 'WFP', type: 'report', snippet: 'Cumulative drought and economic contraction push rural south into IPC Phase 3–4.' },
      { id: 'rw3', title: 'OCHA calls for $1.2B to fill Afghanistan funding gap', date: '2026-04-08', source: 'OCHA', type: 'update', snippet: 'Mid-year review confirms $1.2B shortfall with donor pledging conferences scheduled for June.' },
      { id: 'rw4', title: 'Health system on verge of collapse — WHO warning', date: '2026-04-06', source: 'WHO', type: 'alert', snippet: 'Only 17% of health facilities fully functional. Staff unpaid for 8 months in 12 provinces.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 70, staffSurge: 0 },
  },
  ET: {
    id: 'ET', name: 'Ethiopia', priority: 'HIGH', region: 'East Africa',
    conflictType: 'Post-conflict transition + drought',
    responseYear: 2021, totalRequired: '$3.2B', totalReceived: '$2.3B',
    fundingGap: '$890M', pin: '20.1M', gini: 0.55, fundingPct: 72,
    aiInsight: 'Drought overlap with conflict zone — compound risk score: HIGH.',
    sectors: [
      { name: 'Food Security', required: 1300, received: 960, pin: 9800, unit: 'K people' },
      { name: 'Health', required: 510, received: 370, pin: 5100, unit: 'K people' },
      { name: 'WASH', required: 400, received: 240, pin: 6200, unit: 'K people' },
      { name: 'Shelter', required: 290, received: 200, pin: 3200, unit: 'K people' },
      { name: 'Protection', required: 270, received: 140, pin: 3900, unit: 'K people' },
      { name: 'Education', required: 180, received: 80, pin: 4100, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'WASH', needScore: 80, fundingScore: 60, gap: 'Drought compound — water scarcity critical in Tigray' },
      { sector: 'Education', needScore: 74, fundingScore: 44, gap: 'Post-conflict school rebuilding underfunded' },
      { sector: 'Protection', needScore: 78, fundingScore: 52, gap: 'Transitional justice gaps fuel re-recruitment risk' },
      { sector: 'Food Security', needScore: 85, fundingScore: 74, gap: 'El Niño tail effects persist in Afar' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Ethiopia: El Niño drought extends into 2026 — 9.8M need food aid', date: '2026-04-13', source: 'WFP', type: 'alert', snippet: 'Below-average belg rains in Afar, Somali, and SNNP regions projected through June 2026.' },
      { id: 'rw2', title: 'Tigray transition update: 2.1M returnees, services still limited', date: '2026-04-10', source: 'UNHCR', type: 'update', snippet: 'Healthcare facilities at 45% operational capacity; school enrollment at 58% of pre-conflict levels.' },
      { id: 'rw3', title: 'Ethiopia HRP revised upward — $890M gap remains', date: '2026-04-07', source: 'OCHA', type: 'report', snippet: 'Revised plan reflects compound drought-conflict needs; donor consultation ongoing.' },
      { id: 'rw4', title: 'Measles outbreak in Oromia — 4,200 cases confirmed', date: '2026-04-04', source: 'WHO', type: 'alert', snippet: 'Vaccination campaign launched targeting 1.2M children under 5.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 75, staffSurge: 0 },
  },
  SO: {
    id: 'SO', name: 'Somalia', priority: 'HIGH', region: 'Horn of Africa',
    conflictType: 'Protracted conflict + recurrent drought',
    responseYear: 2011, totalRequired: '$1.6B', totalReceived: '$0.86B',
    fundingGap: '$740M', pin: '7.8M', gini: 0.58, fundingPct: 54,
    aiInsight: 'Remittance flow disruption correlates with acute food insecurity.',
    sectors: [
      { name: 'Food Security', required: 680, received: 390, pin: 4100, unit: 'K people' },
      { name: 'Health', required: 280, received: 140, pin: 2200, unit: 'K people' },
      { name: 'WASH', required: 210, received: 80, pin: 2800, unit: 'K people' },
      { name: 'Shelter', required: 160, received: 90, pin: 1400, unit: 'K people' },
      { name: 'Protection', required: 150, received: 55, pin: 1800, unit: 'K people' },
      { name: 'Education', required: 90, received: 25, pin: 1500, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'WASH', needScore: 82, fundingScore: 38, gap: 'Flash flood damage to water infrastructure' },
      { sector: 'Education', needScore: 70, fundingScore: 28, gap: 'Al-Shabaab school closures unaddressed' },
      { sector: 'Protection', needScore: 76, fundingScore: 37, gap: 'Remittance disruption exposes female HHs' },
      { sector: 'Food Security', needScore: 88, fundingScore: 57, gap: 'Gu season shortfall — urban malnutrition rising' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Somalia: Gu season rains 40% below average — food crisis deepens', date: '2026-04-12', source: 'FAO', type: 'alert', snippet: 'Main growing season underperformance threatens harvest, pushing IPC Phase 3-4 population to 4.1M.' },
      { id: 'rw2', title: 'Al-Shabaab advance closes 180 schools in Bay and Bakool', date: '2026-04-09', source: 'UNICEF', type: 'alert', snippet: '68,000 children out of school; teachers threatened; evacuation corridors blocked.' },
      { id: 'rw3', title: 'Somalia Humanitarian Fund: $12M emergency release', date: '2026-04-06', source: 'SHF', type: 'report', snippet: 'Priority to food security and WASH interventions in drought-affected regions.' },
      { id: 'rw4', title: 'Flash floods in Hirshabelle displace 85K', date: '2026-04-04', source: 'OCHA', type: 'update', snippet: 'Juba riverine communities most affected; shelter and WASH needs immediate.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 60, staffSurge: 0 },
  },
  SY: {
    id: 'SY', name: 'Syria', priority: 'MODERATE', region: 'Levant',
    conflictType: 'Post-conflict transition + regional fragility',
    responseYear: 2012, totalRequired: '$4.4B', totalReceived: '$3.8B',
    fundingGap: '$620M', pin: '12.9M', gini: 0.52, fundingPct: 86,
    aiInsight: 'Reconstruction funding asymmetry creating urban-rural equity gap.',
    sectors: [
      { name: 'Food Security', required: 1100, received: 980, pin: 5800, unit: 'K people' },
      { name: 'Health', required: 620, received: 550, pin: 3400, unit: 'K people' },
      { name: 'WASH', required: 480, received: 390, pin: 4200, unit: 'K people' },
      { name: 'Shelter', required: 680, received: 540, pin: 2900, unit: 'K people' },
      { name: 'Protection', required: 360, received: 240, pin: 2600, unit: 'K people' },
      { name: 'Education', required: 280, received: 160, pin: 3200, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'Education', needScore: 76, fundingScore: 57, gap: 'Rural-urban gap — northwest underserved' },
      { sector: 'Protection', needScore: 72, fundingScore: 67, gap: 'Returnee documentation barriers' },
      { sector: 'Shelter', needScore: 68, fundingScore: 79, gap: 'Over-allocation vs. current need' },
      { sector: 'WASH', needScore: 70, fundingScore: 81, gap: 'Good coverage in urban; rural gap persists' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Syria: Post-HTS transition — humanitarian access improving in northwest', date: '2026-04-14', source: 'OCHA', type: 'update', snippet: 'Cross-line access to Idlib expanded following political transition. 18 new convoy routes approved.' },
      { id: 'rw2', title: 'Reconstruction funding asymmetry: Damascus vs. northeast divide', date: '2026-04-11', source: 'World Bank', type: 'report', snippet: 'Urban reconstruction pace 4x faster than rural northeast. Equity assessment recommends reallocation.' },
      { id: 'rw3', title: 'Syria returnee assessment: 1.8M returnees face documentation barriers', date: '2026-04-09', source: 'UNHCR', type: 'report', snippet: 'Property restitution and civil documentation gaps block durable solutions for returnees.' },
      { id: 'rw4', title: 'Earthquake aftershock sequence — structural damage in Aleppo', date: '2026-04-05', source: 'UNOSAT', type: 'alert', snippet: '340 buildings flagged for structural assessment; 12,000 residents temporarily displaced.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 82, staffSurge: 0 },
  },
  UA: {
    id: 'UA', name: 'Ukraine', priority: 'MODERATE', region: 'Eastern Europe',
    conflictType: 'Active armed conflict + infrastructure war',
    responseYear: 2022, totalRequired: '$4.2B', totalReceived: '$3.1B',
    fundingGap: '$1.1B', pin: '14.6M', gini: 0.48, fundingPct: 74,
    aiInsight: 'Winter energy infrastructure damage extends humanitarian timeline.',
    sectors: [
      { name: 'Food Security', required: 820, received: 640, pin: 4800, unit: 'K people' },
      { name: 'Health', required: 680, received: 520, pin: 3600, unit: 'K people' },
      { name: 'WASH', required: 540, received: 380, pin: 5100, unit: 'K people' },
      { name: 'Shelter', required: 960, received: 680, pin: 6200, unit: 'K people' },
      { name: 'Protection', required: 380, received: 280, pin: 2900, unit: 'K people' },
      { name: 'Education', required: 280, received: 190, pin: 3400, unit: 'K people' },
    ],
    allocationMismatch: [
      { sector: 'WASH', needScore: 84, fundingScore: 70, gap: 'Infrastructure strikes — water system damage critical' },
      { sector: 'Health', needScore: 79, fundingScore: 76, gap: 'Hospital targeting — frontline health gap' },
      { sector: 'Education', needScore: 72, fundingScore: 68, gap: 'Distance learning insufficient — 2M affected' },
      { sector: 'Protection', needScore: 70, fundingScore: 74, gap: 'Good coverage — mine risk education scaling' },
    ],
    reliefwebUpdates: [
      { id: 'rw1', title: 'Ukraine: Mass energy infrastructure strikes — 6.2M without heating', date: '2026-04-15', source: 'OCHA', type: 'alert', snippet: 'Coordinated strikes on energy grid leave 6.2M people without heating amid sub-zero temperatures.' },
      { id: 'rw2', title: 'Winter HRP performance: 74% funded — gaps in eastern oblasts', date: '2026-04-12', source: 'OCHA', type: 'report', snippet: 'Donetsk and Zaporizhzhia oblasts at 58% and 61% funding coverage respectively.' },
      { id: 'rw3', title: 'Mine contamination survey: 30% of agricultural land affected', date: '2026-04-09', source: 'HALO Trust', type: 'report', snippet: 'Contamination blocking spring planting season; food security implications for rural households.' },
      { id: 'rw4', title: 'Protection monitoring: 1.4M people in high-risk zones refuse to evacuate', date: '2026-04-06', source: 'UNHCR', type: 'update', snippet: 'Attachment to property and lack of destination support cited as primary barriers to evacuation.' },
    ],
    simulationBase: { fundingBoost: 0, corridorAccess: 80, staffSurge: 0 },
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-amber-100 text-amber-700 border-amber-200',
  MODERATE: 'bg-blue-100 text-blue-700 border-blue-200',
};

const UPDATE_TYPE_STYLES = {
  alert: 'bg-red-50 border-red-200 text-red-600',
  report: 'bg-blue-50 border-blue-200 text-blue-600',
  update: 'bg-amber-50 border-amber-200 text-amber-600',
};

// ─── Left Pane ────────────────────────────────────────────────────────────────

function CrisisLeftPane({ country, onBack }: { country: CountryData; onBack: () => void }) {
  const coverageColor =
    country.fundingPct < 50 ? '#D32F2F' : country.fundingPct < 70 ? '#F59E0B' : '#22c55e';

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo + back */}
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

      {/* Back nav */}
      <div className="border-b border-slate-100 px-3 py-2">
        <button
          onClick={onBack}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={12} />
          Crisis Overview
        </button>
      </div>

      {/* Country header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          Active Crisis
        </p>
        <h2 className="mb-1.5 text-base font-bold text-slate-900">{country.name}</h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[country.priority]}`}
        >
          {country.priority === 'CRITICAL' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
          {country.priority === 'HIGH' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          {country.priority === 'MODERATE' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
          {country.priority}
        </span>
        <p className="mt-2 text-[10px] leading-snug text-slate-400">
          {country.region} · Since {country.responseYear}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{country.conflictType}</p>
      </div>

      {/* Key stats */}
      <div className="flex-1 space-y-0 overflow-y-auto px-5 py-4">
        {[
          { label: 'Funding Gap', value: country.fundingGap, icon: DollarSign, valueColor: 'text-red-600' },
          { label: 'People in Need', value: country.pin, icon: Users, valueColor: 'text-slate-800' },
          { label: 'HRP Coverage', value: `${country.fundingPct}%`, icon: TrendingDown, valueColor: country.fundingPct < 50 ? 'text-red-600' : country.fundingPct < 70 ? 'text-amber-600' : 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="mb-4">
            <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              <s.icon size={9} />
              {s.label}
            </div>
            <p className={`text-lg font-black ${s.valueColor}`}>{s.value}</p>
          </div>
        ))}

        {/* Funding progress */}
        <div className="mt-1">
          <div className="mb-1.5 flex justify-between text-[9px] text-slate-400">
            <span>{country.totalReceived} received</span>
            <span>{country.totalRequired} needed</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${country.fundingPct}%`, background: coverageColor }}
            />
          </div>
        </div>
      </div>

      {/* System health */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-[10px] font-bold text-emerald-700">Live Feed</p>
            <p className="text-[9px] text-emerald-600">ReliefWeb · 42ms</p>
          </div>
          <Wifi size={11} className="ml-auto text-emerald-500" />
        </div>
      </div>
    </aside>
  );
}

// ─── Sector Funding ───────────────────────────────────────────────────────────

function SectorFunding({ sectors }: { sectors: SectorData[] }) {
  const sorted = [...sectors].sort(
    (a, b) => (b.required - b.received) / b.required - (a.required - a.received) / a.required
  );
  return (
    <section>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Sector Funding
      </p>
      <p className="mb-4 text-[11px] text-slate-400">
        How much of each cluster&apos;s requirement has been funded — sorted by worst gap first.
      </p>
      <div className="space-y-3">
        {sorted.map((s) => {
          const pct = Math.round((s.received / s.required) * 100);
          const gap = s.required - s.received;
          const color = pct < 30 ? '#D32F2F' : pct < 55 ? '#F59E0B' : '#008CFF';
          return (
            <div key={s.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12px] font-medium text-slate-700">{s.name}</span>
              <div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="w-8 text-right text-[11px] font-bold tabular-nums" style={{ color }}>
                {pct}%
              </span>
              <span className="w-20 text-right text-[10px] text-slate-400">${gap}M gap</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Allocation Mismatch ──────────────────────────────────────────────────────

function AllocationMismatch({ items }: { items: MismatchItem[] }) {
  return (
    <section>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Allocation Mismatch
      </p>
      <p className="mb-4 text-[11px] text-slate-400">
        Need severity vs. funding received per cluster (0–100). A large gap signals misallocation risk.
      </p>
      <div className="space-y-4">
        {items.map((item) => {
          const div = item.needScore - item.fundingScore;
          const isOver = div < 0;
          return (
            <div key={item.sector}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-800">{item.sector}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    isOver ? 'text-blue-500' : div > 50 ? 'text-red-500' : 'text-amber-500'
                  }`}
                >
                  {isOver ? `+${Math.abs(div)} overfunded` : `−${div} gap`}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[9px] text-slate-400">Need</span>
                  <div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-red-50">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-red-400"
                      style={{ width: `${item.needScore}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[9px] font-bold text-red-500">{item.needScore}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[9px] text-slate-400">Funded</span>
                  <div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-blue-50">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-[#008CFF]"
                      style={{ width: `${item.fundingScore}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[9px] font-bold text-[#008CFF]">{item.fundingScore}</span>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{item.gap}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Recent Developments ──────────────────────────────────────────────────────

function RecentDevelopments({ updates }: { updates: ReliefUpdate[] }) {
  return (
    <section>
      <div className="mb-0.5 flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Recent Developments
        </p>
        <Newspaper size={10} className="text-slate-300" />
      </div>
      <p className="mb-4 text-[11px] text-slate-400">Latest situation reports from ReliefWeb.</p>
      <div className="space-y-4">
        {updates.map((u) => (
          <div key={u.id} className="flex gap-3">
            <div className="mt-0.5 flex flex-col items-center">
              <div
                className={`h-2 w-2 shrink-0 rounded-full border ${UPDATE_TYPE_STYLES[u.type]}`}
              />
              <div className="mt-1 w-px flex-1 bg-slate-100" />
            </div>
            <div className="pb-4">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${UPDATE_TYPE_STYLES[u.type]}`}
                >
                  {u.type}
                </span>
                <span className="text-[9px] text-slate-400">{u.date} · {u.source}</span>
              </div>
              <p className="mb-0.5 text-[12px] font-semibold leading-snug text-slate-800">{u.title}</p>
              <p className="text-[11px] leading-relaxed text-slate-500">{u.snippet}</p>
              <button className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#008CFF] hover:underline">
                ReliefWeb <ExternalLink size={8} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Sandbox (Dossier + Simulation as AI propositions) ────────────────────────

function SandboxCard({
  title,
  icon: Icon,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#008CFF]/10">
          <Icon size={12} className="text-[#008CFF]" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-800">{title}</p>
          <p className="truncate text-[9px] text-slate-400">{description}</p>
        </div>
        <ChevronDown
          size={12}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2.5">{children}</div>
      )}
    </div>
  );
}

function CrisisSandbox({ country }: { country: CountryData }) {
  const [openCard, setOpenCard] = useState<'dossier' | 'sim' | null>(null);
  const toggle = (card: 'dossier' | 'sim') =>
    setOpenCard((prev) => (prev === card ? null : card));

  // Dossier state
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const handleGenerate = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2200);
  };

  // Simulation state
  const [sim, setSim] = useState<SimulationState>(country.simulationBase);
  const basePeopleReached = Math.round(parseFloat(country.pin) * 0.48 * 1000000);
  const totalReached = basePeopleReached + sim.fundingBoost * 180000
    + Math.max(0, sim.corridorAccess - country.simulationBase.corridorAccess) * 22000
    + sim.staffSurge * 95000;
  const coveragePct = Math.min(99, Math.round((totalReached / (parseFloat(country.pin) * 1000000)) * 100));

  return (
    <div className="space-y-1.5 px-3 py-3">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
        AI Sandbox
      </p>

      {/* Dossier */}
      <SandboxCard
        title="Situation Dossier"
        icon={FileText}
        description="Generate a structured situation report"
        open={openCard === 'dossier'}
        onToggle={() => toggle('dossier')}
      >
        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          {['Executive Summary', 'Funding Gap', 'Cluster Breakdown', 'AI Recommendations'].map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:border-[#008CFF]/30 transition-colors"
            >
              <input type="checkbox" defaultChecked className="h-2.5 w-2.5 accent-[#008CFF]" />
              {s}
            </label>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#008CFF] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#0070CC] disabled:opacity-60 transition-colors"
        >
          {generating ? (
            <><RefreshCw size={11} className="animate-spin" /> Generating…</>
          ) : (
            <><FileText size={11} /> Generate Report</>
          )}
        </button>
        {generated && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
            <p className="text-[10px] font-bold text-emerald-700">{country.name}_SitRep_April2026.pdf</p>
            <button className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-semibold text-white hover:bg-emerald-700 transition-colors">
              <Download size={9} /> Save
            </button>
          </div>
        )}
      </SandboxCard>

      {/* Simulation */}
      <SandboxCard
        title="Response Simulation"
        icon={FlaskConical}
        description="Model impact of response levers"
        open={openCard === 'sim'}
        onToggle={() => toggle('sim')}
      >
        <div className="space-y-3">
          {[
            {
              label: 'Extra Funding',
              value: `+$${sim.fundingBoost * 100}M`,
              min: 0, max: 20, step: 1,
              field: 'fundingBoost' as const,
              hint: ['$0', '$2B'],
            },
            {
              label: 'Corridor Access',
              value: `${sim.corridorAccess}%`,
              min: country.simulationBase.corridorAccess, max: 100, step: 5,
              field: 'corridorAccess' as const,
              hint: [`${country.simulationBase.corridorAccess}% now`, '100%'],
            },
            {
              label: 'Staff Surge',
              value: `+${sim.staffSurge * 50}`,
              min: 0, max: 10, step: 1,
              field: 'staffSurge' as const,
              hint: ['0', '+500'],
            },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-0.5 flex justify-between text-[10px]">
                <span className="font-medium text-slate-700">{r.label}</span>
                <span className="font-bold text-[#008CFF]">{r.value}</span>
              </div>
              <input
                type="range" min={r.min} max={r.max} step={r.step}
                value={sim[r.field]}
                onChange={(e) => setSim((s) => ({ ...s, [r.field]: +e.target.value }))}
                className="w-full accent-[#008CFF]"
              />
              <div className="flex justify-between text-[8px] text-slate-400">
                <span>{r.hint[0]}</span><span>{r.hint[1]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-[#008CFF]/20 bg-[#008CFF]/5 px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#008CFF]">Projected reach</p>
          <p className="text-lg font-black text-slate-900">
            {(totalReached / 1000000).toFixed(2)}M
            <span className="ml-1.5 text-[11px] font-bold text-[#008CFF]">{coveragePct}%</span>
          </p>
          <div className="mt-1 relative h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[#008CFF] transition-all duration-500"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
      </SandboxCard>
    </div>
  );
}

// ─── Crisis Page ──────────────────────────────────────────────────────────────

export default function CrisisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const country = COUNTRIES[id.toUpperCase()];

  if (!country) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-amber-400" />
          <p className="text-base font-bold text-slate-800">Crisis zone not found</p>
          <p className="mb-4 text-sm text-slate-500">No data for &quot;{id}&quot;</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-xl bg-[#008CFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0070CC]"
          >
            Back to map
          </button>
        </div>
      </div>
    );
  }

  const seedMessages: UIMessage[] = [
    {
      id: 'seed-1',
      role: 'assistant',
      parts: [{
        type: 'text',
        text: `**${country.name} · AI Brief**\n\nHRP coverage is **${country.fundingPct}%** — ${country.fundingGap} gap against a ${country.totalRequired} requirement. ${country.sectors.reduce((a, b) => ((b.required - b.received) / b.required > (a.required - a.received) / a.required ? b : a)).name} is the most underfunded cluster.\n\nAlert: ${country.aiInsight}\n\nUse the Sandbox above to model scenarios or generate a dossier. Ask me anything about this crisis.`,
      }],
    },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <CrisisLeftPane country={country} onBack={() => router.push('/')} />

      {/* Center — scrollable content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Thin top bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {country.name}
          </p>
          <span className="text-slate-200">/</span>
          <p className="text-[10px] text-slate-400">Crisis Intelligence · FY 2026</p>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <p className="text-[10px] font-medium text-amber-700">{country.aiInsight}</p>
          </div>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-2xl space-y-10">
            <SectorFunding sectors={country.sectors} />
            <div className="h-px bg-slate-100" />
            <AllocationMismatch items={country.allocationMismatch} />
            <div className="h-px bg-slate-100" />
            <RecentDevelopments updates={country.reliefwebUpdates} />
          </div>
        </div>
      </main>

      {/* Right — AI Copilot sidebar */}
      <AICopilot
        seedMessages={seedMessages}
        quickPrompts={['Draft donor appeal', 'Worst-case scenario', 'CERF eligibility', 'Top 3 priorities', 'Access constraints']}
        sandboxNode={<CrisisSandbox country={country} />}
        subtitle={`${country.name} Intelligence`}
        inputPlaceholder="Query situation, draft appeal, or request brief…"
      />
    </div>
  );
}
