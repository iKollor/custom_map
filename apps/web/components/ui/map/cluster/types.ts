import MapLibreGL from "maplibre-gl";
import type { Root } from "react-dom/client";
import type { ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export type MapClusterLayerProps<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
> = {
    data: string | GeoJSON.FeatureCollection<GeoJSON.Point, P>;
    clusterMaxZoom?: number;
    clusterRadius?: number;
    clusterColors?: [string, string, string];
    clusterThresholds?: [number, number];
    pointColor?: string;
    onPointClick?: (
        feature: GeoJSON.Feature<GeoJSON.Point, P>,
        coordinates: [number, number],
    ) => void;
    onClusterClick?: (
        clusterId: number,
        coordinates: [number, number],
        pointCount: number,
    ) => void;
    renderPointTooltip?: (
        feature: GeoJSON.Feature<GeoJSON.Point, P>,
        coordinates: [number, number],
    ) => ReactNode;
    pointTooltipClassName?: string;
    pieOptions?: {
        enabled?: boolean;
        categoryProperty: string;
        colorProperty: string;
        categoryColors: Record<string, string>;
        showDominantPercent?: boolean;
        minRadius?: number;
        maxRadius?: number;
    };
    coverageOverlayOptions?: {
        enabled?: boolean;
        fillOpacity?: number;
        outlineOpacity?: number;
        maxLeavesPerCluster?: number;
    };
};

export type ClusterPieSegment = {
    category: string;
    color: string;
    count: number;
    percent: number;
};

export type ClusterPieDetails = {
    clusterId: number;
    pointCount: number;
    coordinates: [number, number];
    segments: ClusterPieSegment[];
};

export type ClusterMarkerEntry = {
    marker: MapLibreGL.Marker;
    element: HTMLDivElement;
    root: Root;
    onClick: (event: MouseEvent) => void;
    signature: string;
};

export type ClusterLayerIds = {
    sourceId: string;
    clusterLayerId: string;
    clusterCountLayerId: string;
    clusterHitLayerId: string;
    unclusteredLayerId: string;
    coverageSourceId: string;
    coverageFillLayerId: string;
    coverageOutlineLayerId: string;
};

export type HoveredPointState<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
    feature: GeoJSON.Feature<GeoJSON.Point, P>;
    coordinates: [number, number];
};
