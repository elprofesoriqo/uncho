declare module "react-simple-maps" {
  import { FC, SVGProps } from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
  export const ComposableMap: FC<ComposableMapProps>;

  export interface ZoomableGroupProps {
    zoom?: number;
    children?: React.ReactNode;
  }
  export const ZoomableGroup: FC<ZoomableGroupProps>;

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: GeoObject[] }) => React.ReactNode;
  }
  export const Geographies: FC<GeographiesProps>;

  export interface GeoObject {
    rsmKey: string;
    properties: Record<string, string | number>;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeoObject;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    "data-tooltip-id"?: string;
    "data-tooltip-content"?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onClick?: () => void;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
  }
  export const Geography: FC<GeographyProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    children?: React.ReactNode;
  }
  export const Marker: FC<MarkerProps>;
}
