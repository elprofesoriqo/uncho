export function CoveragePct({ value, showBar = true }: { value: number; showBar?: boolean }) {
  const pct = Math.min(Math.max(+value * 100, 0), 100);
  const color =
    pct >= 80 ? "#16a34a" :
    pct >= 60 ? "#65a30d" :
    pct >= 40 ? "#ca8a04" :
    pct >= 20 ? "#ea580c" : "#dc2626";

  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      {showBar && (
        <div className="flex-1 h-1.5 bg-border-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
      <span className="mono tabular text-[12px] font-medium" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export function MismatchScore({ value, lower, upper }: {
  value: number; lower?: number; upper?: number;
}) {
  const v = +value;
  const lo = lower != null ? +lower : undefined;
  const hi = upper != null ? +upper : undefined;
  const intensity = Math.min(v / 3, 1);
  const color = intensity > 0.7 ? "#dc2626" : intensity > 0.4 ? "#ea580c" : intensity > 0.2 ? "#ca8a04" : "#94a3b8";
  return (
    <div className="flex flex-col items-end">
      <span className="mono font-bold text-[14px]" style={{ color }}>
        {isNaN(v) ? "—" : v.toFixed(3)}
      </span>
      {lo != null && hi != null && !isNaN(lo) && !isNaN(hi) && (
        <span className="mono text-[9px] text-faint">
          [{lo.toFixed(2)}–{hi.toFixed(2)}]
        </span>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted text-[13px]">
      {message}
    </div>
  );
}

export function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-severe/30 bg-severe/10 px-4 py-3 text-severe text-[13px]">
      {error}
    </div>
  );
}

export function StatRow({ label, value, mono = true }: {
  label: string; value: React.ReactNode; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted text-[12px]">{label}</span>
      <span className={`text-text text-[13px] font-medium ${mono ? "mono tabular" : ""}`}>{value}</span>
    </div>
  );
}
