


interface LighthouseBrandProps {
  className?: string;
}

export function LighthouseBrand({ className = "" }: LighthouseBrandProps) {
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 ${className}`.trim()}
    >
      
      <div>
        <p className="text-[11px] font-bold leading-none tracking-widest text-un-blue uppercase">
          Lighthouse
        </p>
        <p className="text-[9px] font-medium tracking-widest text-slate-400 uppercase">
          OS · v2.4.1
        </p>
      </div>
    </div>
  );
}
