import { clsx } from "clsx";

export function Badge({ label, variant = "default" }: {
  label: string;
  variant?: "default" | "high" | "medium" | "low" | "structural" | "acute" | "recovering" | "blue";
}) {
  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
      {
        "bg-covered/15 text-covered border border-covered/30":      variant === "high",
        "bg-medium/15 text-[#eab308] border border-medium/30":       variant === "medium",
        "bg-severe/15 text-severe border border-severe/30":          variant === "low",
        "bg-[#1e2a3a] text-muted border border-border":              variant === "default",
        "bg-accent/10 text-accent border border-accent/20":          variant === "blue",
        "bg-orange-900/20 text-orange-400 border border-orange-800/30": variant === "acute",
        "bg-covered/10 text-covered border border-covered/25":       variant === "recovering",
      }
    )}>
      {label}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: string }) {
  const v = level?.toUpperCase();
  if (v === "HIGH") return <Badge label="HIGH" variant="high" />;
  if (v === "MEDIUM") return <Badge label="MED" variant="medium" />;
  return <Badge label="LOW" variant="low" />;
}

export function CrisisTypeBadge({ type }: { type: string }) {
  const t = type?.toUpperCase();
  if (t === "STRUCTURAL") return <Badge label="STRUCTURAL" variant="low" />;
  if (t === "ACUTE") return <Badge label="ACUTE" variant="acute" />;
  if (t === "RECOVERING") return <Badge label="RECOVERING" variant="recovering" />;
  return <Badge label={type ?? "—"} />;
}
