"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TableProperties, Globe2, TrendingUp,
  Shield, MessageSquare, Activity, BarChart2
} from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/rankings",   label: "Rankings",    icon: TableProperties },
  { href: "/map",        label: "Globe Map",   icon: Globe2 },
  { href: "/simulator",  label: "Simulator",   icon: TrendingUp },
  { href: "/timeline",   label: "Timeline",    icon: BarChart2 },
  { href: "/data-health",label: "Data Health", icon: Shield },
  { href: "/chat",       label: "AI Co-Pilot", icon: MessageSquare },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] flex flex-col border-r border-border bg-surface z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Activity size={14} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-text leading-tight">Lighthouse OS</p>
          <p className="text-[10px] text-faint leading-tight">Humanitarian Intelligence</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">Navigation</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted hover:text-text hover:bg-surface-2"
              )}
            >
              <Icon size={15} className={active ? "text-accent" : "text-faint"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-faint">
          Databricks · Claude · Kumo.AI
        </p>
        <p className="text-[10px] text-faint/60 mt-0.5">UN OCHA Data Sources</p>
      </div>
    </aside>
  );
}
