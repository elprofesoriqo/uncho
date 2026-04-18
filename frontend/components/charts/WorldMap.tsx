"use client";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  type GeoObject,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import { useState } from "react";
import type { GeoFeature } from "@/lib/types";
import { getISO3 } from "@/lib/utils";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function coverageColor(ratio: number): string {
  const r = +ratio;
  if (r >= 0.8) return "#16a34a";
  if (r >= 0.6) return "#65a30d";
  if (r >= 0.4) return "#ca8a04";
  if (r >= 0.2) return "#ea580c";
  if (r > 0) return "#dc2626";
  return "#1a2538";
}

function mismatchColor(score: number): string {
  if (score >= 2.5) return "#dc2626";
  if (score >= 1.5) return "#ea580c";
  if (score >= 0.8) return "#ca8a04";
  if (score >= 0.3) return "#65a30d";
  return "#1a2538";
}

function severityColor(val: number): string {
  if (val >= 4.5) return "#dc2626";
  if (val >= 3.5) return "#ea580c";
  if (val >= 2.5) return "#ca8a04";
  if (val > 0) return "#65a30d";
  return "#1a2538";
}

interface Props {
  features: GeoFeature[];
  encodingField: string;
  height?: number;
  onCountryClick?: (iso3: string) => void;
}

export default function WorldMap({
  features,
  encodingField,
  onCountryClick,
}: Props) {
  const [tip, setTip] = useState<string>("");
  const dataMap = Object.fromEntries(features.map((f) => [f.iso3, f]));

  function getFill(dRec: Record<string, number | string>): string {
    // if (!d) return "#1a2538";
    if (encodingField === "coverage_ratio")
      return coverageColor(+dRec.coverage_ratio);
    if (
      encodingField === "mismatch_score" ||
      encodingField === "mismatch_score_lower_bound"
    )
      return mismatchColor(+(dRec[encodingField]));
    if (encodingField === "inform_severity")
      return severityColor(+(dRec[encodingField] ?? 0));
    if (encodingField === "people_in_need") {
      const pin = +dRec.people_in_need;
      if (pin >= 5e6) return "#dc2626";
      if (pin >= 2e6) return "#ea580c";
      if (pin >= 500_000) return "#ca8a04";
      if (pin > 0) return "#65a30d";
    }
    return "#1a2538";
  }

  console.log(dataMap, encodingField);

  return (
    <div className="absolute inset-0 h-full w-full select-none">
      <ComposableMap
        width={800}
        height={600}
        projection="geoMercator"
        projectionConfig={{
          scale: 125,
          center: [0, 40],
        }}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: GeoObject[] }) =>
            geographies.map((geo: GeoObject) => {
              const iso3 = getISO3(geo.properties?.name as string);
              const d = dataMap[iso3];

              if (geo.properties?.name === "Antarctica") return null; // skip Antarctica

              console.log(geo.properties?.name, iso3, d);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getFill(d || {})}
                  stroke="#070c18"
                  strokeWidth={0.4}
                  data-tooltip-id="map-tip"
                  data-tooltip-content={
                    d
                      ? `${d.country} · ${(d.coverage_ratio * 100).toFixed(1)}% covered · ${(d.people_in_need / 1e6).toFixed(2)}M PiN`
                      : (geo.properties.NAME as string)
                  }
                  onMouseEnter={() => setTip(iso3)}
                  onMouseLeave={() => setTip("")}
                  onClick={() => onCountryClick?.(iso3)}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8, cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <Tooltip
        id="map-tip"
        className="!text-[11px] !bg-surface !border !border-border !text-text !rounded-lg !py-1.5 !px-2.5"
      />
    </div>
  );
}
