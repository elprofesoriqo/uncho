import Link from "next/link";
import { ExternalLink, Newspaper } from "lucide-react";

export interface SectorData {
  name: string;
  required: number;
  received: number;
  pin: number;
  unit: string;
}

export interface MismatchItem {
  sector: string;
  needScore: number;
  fundingScore: number;
  gap: string;
}

export interface ReliefUpdate {
  id: string;
  title: string;
  date: string;
  source: string;
  type: "report" | "alert" | "update";
  snippet: string;
}

const UPDATE_TYPE_STYLES: Record<ReliefUpdate["type"], string> = {
  alert: "bg-red-50 border-red-200 text-red-600",
  report: "bg-blue-50 border-blue-200 text-blue-600",
  update: "bg-amber-50 border-amber-200 text-amber-600",
};

export function SectorFunding({ sectors }: { sectors: SectorData[] }) {
  const sorted = [...sectors].sort(
    (a, b) =>
      (b.required - b.received) / b.required -
      (a.required - a.received) / a.required,
  );

  return (
    <section>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Sector Funding
      </p>
      <p className="mb-4 text-[11px] text-slate-400">
        How much of each cluster&apos;s requirement has been funded - sorted by
        worst gap first.
      </p>
      <div className="space-y-3">
        {sorted.map((s) => {
          const pct = Math.round((s.received / s.required) * 100);
          const gap = s.required - s.received;
          const color = pct < 30 ? "#D32F2F" : pct < 55 ? "#F59E0B" : "#008CFF";

          return (
            <div key={s.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12px] font-medium text-slate-700">
                {s.name}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span
                className="w-8 text-right text-[11px] font-bold tabular-nums"
                style={{ color }}
              >
                {pct}%
              </span>
              <span className="w-20 text-right text-[10px] text-slate-400">
                ${gap}M gap
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AllocationMismatch({ items }: { items: MismatchItem[] }) {
  return (
    <section>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Allocation Mismatch
      </p>
      <p className="mb-4 text-[11px] text-slate-400">
        Need severity vs. funding received per cluster (0-100). A large gap
        signals misallocation risk.
      </p>
      <div className="space-y-4">
        {items.map((item) => {
          const div = item.needScore - item.fundingScore;
          const isOver = div < 0;

          return (
            <div key={item.sector}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-800">
                  {item.sector}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    isOver
                      ? "text-blue-500"
                      : div > 50
                        ? "text-red-500"
                        : "text-amber-500"
                  }`}
                >
                  {isOver ? `+${Math.abs(div)} overfunded` : `-${div} gap`}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[9px] text-slate-400">Need</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-red-50">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-red-400"
                      style={{ width: `${item.needScore}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[9px] font-bold text-red-500">
                    {item.needScore}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[9px] text-slate-400">Funded</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-blue-50">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-[#008CFF]"
                      style={{ width: `${item.fundingScore}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[9px] font-bold text-[#008CFF]">
                    {item.fundingScore}
                  </span>
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

export function RecentDevelopments({ updates }: { updates: ReliefUpdate[] }) {
  return (
    <section>
      <div className="mb-0.5 flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Recent Developments
        </p>
        <Newspaper size={10} className="text-slate-300" />
      </div>
      <p className="mb-4 text-[11px] text-slate-400">
        Latest situation reports from ReliefWeb.
      </p>
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
                <span className="text-[9px] text-slate-400">
                  {u.date} · {u.source}
                </span>
              </div>
              <p className="mb-0.5 text-[12px] font-semibold leading-snug text-slate-800">
                {u.title}
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {u.snippet}
              </p>
              <Link
                href="/"
                className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#008CFF] hover:underline"
              >
                ReliefWeb <ExternalLink size={8} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
