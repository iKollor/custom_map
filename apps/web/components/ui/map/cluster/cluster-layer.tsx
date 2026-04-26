"use client";

import { useId, useMemo } from "react";

import { CLUSTER_DEFAULTS, MAP_COLORS } from "../constants";

import { MapPopup } from "../popup";

import { ClusterPiePopup } from "./cluster-pie-popup";
import { useClusterEvents } from "./hooks/use-cluster-events";
import { useClusterSource } from "./hooks/use-cluster-source";
import { useCoverageOverlay } from "./hooks/use-coverage-overlay";
import { usePieMarkers } from "./hooks/use-pie-markers";
import type { ClusterLayerIds, MapClusterLayerProps } from "./types";

// ============================================================================
// MapClusterLayer
// ============================================================================

export function MapClusterLayer<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
>({
    data,
    clusterMaxZoom = CLUSTER_DEFAULTS.maxZoom,
    clusterRadius = CLUSTER_DEFAULTS.radius,
    clusterColors = CLUSTER_DEFAULTS.colors,
    clusterThresholds = CLUSTER_DEFAULTS.thresholds,
    pointColor = MAP_COLORS.primary,
    onPointClick,
    onClusterClick,
    renderPointTooltip,
    onPointHoverChange,
    pointTooltipClassName,
    pieOptions,
    coverageOverlayOptions,
}: MapClusterLayerProps<P>) {
    const id = useId();

    const ids: ClusterLayerIds = useMemo(
        () => ({
            sourceId: `cluster-source-${id}`,
            clusterLayerId: `clusters-${id}`,
            clusterCountLayerId: `cluster-count-${id}`,
            clusterHitLayerId: `clusters-hit-${id}`,
            unclusteredLayerId: `unclustered-point-${id}`,
            coverageSourceId: `clusters-coverage-source-${id}`,
            coverageFillLayerId: `clusters-coverage-fill-${id}`,
            coverageOutlineLayerId: `clusters-coverage-outline-${id}`,
        }),
        [id],
    );

    const pieEnabled = pieOptions?.enabled ?? false;
    const coverageEnabled = coverageOverlayOptions?.enabled ?? false;

    const categoryEntries = useMemo(
        () => Object.entries(pieOptions?.categoryColors ?? {}) as [string, string][],
        [pieOptions?.categoryColors],
    );

    // 1. Source + layers lifecycle
    useClusterSource<P>(ids, data, {
        clusterMaxZoom,
        clusterRadius,
        clusterColors,
        clusterThresholds,
        pointColor,
        pieEnabled,
        pieOptions,
        coverageEnabled,
        coverageOverlayOptions,
        categoryEntries,
    });

    // 2. Pie HTML markers
    const { activePie, setActivePie } = usePieMarkers<P>(ids, {
        pieEnabled,
        pieOptions,
        pointColor,
        categoryEntries,
        onClusterClick,
    });

    // 3. Coverage overlay (convex hull per cluster)
    useCoverageOverlay<P>(ids, {
        coverageEnabled,
        coverageOverlayOptions,
        pieOptions,
        pointColor,
    });

    // 4. Click / hover / cursor events
    const { hoveredPoint } = useClusterEvents<P>(ids, {
        pieEnabled,
        onClusterClick,
        onPointClick,
        renderPointTooltip,
        onPointHoverChange,
    });

    return (
        <>
            {activePie ? (
                <ClusterPiePopup
                    details={activePie}
                    onClose={() => setActivePie(null)}
                />
            ) : null}
            {hoveredPoint && renderPointTooltip ? (
                <MapPopup
                    longitude={hoveredPoint.coordinates[0]}
                    latitude={hoveredPoint.coordinates[1]}
                    closeButton={false}
                    closeOnClick={false}
                    closeOnMove={false}
                    focusAfterOpen={false}
                    anchor="bottom"
                    wrapperClassName="pointer-events-none"
                    className={pointTooltipClassName ?? "bg-popover text-popover-foreground max-w-62 rounded-md border px-2.5 py-1.5 shadow-md"}
                >
                    {renderPointTooltip(hoveredPoint.feature, hoveredPoint.coordinates)}
                </MapPopup>
            ) : null}
        </>
    );
}
