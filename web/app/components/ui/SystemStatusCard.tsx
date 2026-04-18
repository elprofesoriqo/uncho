import { Wifi } from "lucide-react";

interface SystemStatusCardProps {
  label: string;
  detail: string;
}

export function SystemStatusCard({ label, detail }: SystemStatusCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <div>
        <p className="text-[10px] font-bold text-emerald-700">{label}</p>
        <p className="text-[9px] text-emerald-600">{detail}</p>
      </div>
      <Wifi size={11} className="ml-auto text-emerald-500" />
    </div>
  );
}
