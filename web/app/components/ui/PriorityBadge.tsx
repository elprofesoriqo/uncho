interface PriorityBadgeProps {
  level: "CRITICAL" | "HIGH" | "MODERATE";
}

const PRIORITY_COLORS: Record<PriorityBadgeProps["level"], string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-amber-100 text-amber-700 border-amber-200",
  MODERATE: "bg-blue-100 text-blue-700 border-blue-200",
};

const PRIORITY_DOT_COLORS: Record<PriorityBadgeProps["level"], string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-amber-500",
  MODERATE: "bg-blue-500",
};

export function PriorityBadge({ level }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_COLORS[level]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT_COLORS[level]}`} />
      {level}
    </span>
  );
}
