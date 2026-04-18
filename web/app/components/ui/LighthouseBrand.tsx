import LightHouseLogo from "../../../public/lighthouse-logo.svg";
import Image from "next/image";
interface LighthouseBrandProps {
  className?: string;
}

export function LighthouseBrand({ className = "" }: LighthouseBrandProps) {
  return (
    <div className={`h-12 p-3 rounded-xl bg-un-blue shadow-sm ${className}`}>
      <Image
        src={LightHouseLogo}
        alt="Lighthouse Logo"
        className="h-full w-auto"
      />
    </div>
  );
}
