import { ChevronRight, type LucideIcon } from "lucide-react";

interface SidebarNavLinkProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

export function SidebarNavLink({
  icon: Icon,
  label,
  active = false,
}: SidebarNavLinkProps) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-un-blue/10 text-un-blue"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      <span>{label}</span>
      {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
    </button>
  );
}
