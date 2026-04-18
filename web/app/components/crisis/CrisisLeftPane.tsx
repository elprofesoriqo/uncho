import { ArrowLeft, DollarSign, TrendingDown, Users } from "lucide-react";
import { LighthouseBrand } from "@/app/components/ui/LighthouseBrand";
import { PriorityBadge } from "@/app/components/ui/PriorityBadge";
import { SystemStatusCard } from "@/app/components/ui/SystemStatusCard";

interface CountrySidebarData {
  name: string;
  priority: "CRITICAL" | "HIGH" | "MODERATE";
  region: string;
  conflictType: string;
  responseYear: number;
  fundingGap: string;
  pin: string;
  fundingPct: number;
  totalReceived: string;
  totalRequired: string;
}

interface CrisisLeftPaneProps {
  country: CountrySidebarData;
  onBack: () => void;
}

export function CrisisLeftPane({ country, onBack }: CrisisLeftPaneProps) {
  const coverageColor =
    country.fundingPct < 50
      ? "#D32F2F"
      : country.fundingPct < 70
        ? "#F59E0B"
        : "#22c55e";

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <LighthouseBrand />

      <div className="border-b border-slate-100 px-3 py-2">
        <button
          onClick={onBack}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft size={12} />
          Crisis Overview
        </button>
      </div>

      <div className="border-b border-slate-100 px-5 py-4">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          Active Crisis
        </p>
        <h2 className="mb-1.5 text-base font-bold text-slate-900">{country.name}</h2>
        <PriorityBadge level={country.priority} />
        <p className="mt-2 text-[10px] leading-snug text-slate-400">
          {country.region} · Since {country.responseYear}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
          {country.conflictType}
        </p>
      </div>

      <div className="flex-1 space-y-0 overflow-y-auto px-5 py-4">
        {[
          {
            label: "Funding Gap",
            value: country.fundingGap,
            icon: DollarSign,
            valueColor: "text-red-600",
          },
          {
            label: "People in Need",
            value: country.pin,
            icon: Users,
            valueColor: "text-slate-800",
          },
          {
            label: "HRP Coverage",
            value: `${country.fundingPct}%`,
            icon: TrendingDown,
            valueColor:
              country.fundingPct < 50
                ? "text-red-600"
                : country.fundingPct < 70
                  ? "text-amber-600"
                  : "text-emerald-600",
          },
        ].map((s) => (
          <div key={s.label} className="mb-4">
            <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              <s.icon size={9} />
              {s.label}
            </div>
            <p className={`text-lg font-black ${s.valueColor}`}>{s.value}</p>
          </div>
        ))}

        <div className="mt-1">
          <div className="mb-1.5 flex justify-between text-[9px] text-slate-400">
            <span>{country.totalReceived} received</span>
            <span>{country.totalRequired} needed</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${country.fundingPct}%`,
                background: coverageColor,
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <SystemStatusCard label="Live Feed" detail="ReliefWeb · 42ms" />
      </div>
    </aside>
  );
}
