"use client";

import MapLibreGL from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "../../core";

import { getFeatureId, unwrapPointCoords } from "../helpers";
import type { ClusterLayerIds, HoveredPointState, MapClusterLayerProps } from "../types";

/**
 * Registers click, hover and cursor handlers on the cluster and unclustered
 * point layers. Returns the currently hovered point for tooltip rendering.
 */
export function useClusterEvents<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
>(
    ids: ClusterLayerIds,
    opts: {
        pieEnabled: boolean;
        onClusterClick: MapClusterLayerProps<P>["onClusterClick"];
        onPointClick: MapClusterLayerProps<P>["onPointClick"];
        renderPointTooltip: MapClusterLayerProps<P>["renderPointTooltip"];
    },
) {
    const { map, isLoaded } = useMap();
    const { sourceId, clusterLayerId, clusterHitLayerId, unclusteredLayerId } = ids;
    const { pieEnabled, onClusterClick, onPointClick, renderPointTooltip } = opts;

    const [hoveredPoint, setHoveredPoint] = useState<HoveredPointState<P> | null>(null);

    useEffect(() => {
        if (!isLoaded || !map) return;

        // --- cluster click (non-pie mode) ---
        const handleClusterClick = async (
            e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] },
        ) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
            const feature = features[0];
            if (!feature) return;

            const clusterId = feature.properties?.cluster_id as number;
            const pointCount = feature.properties?.point_count as number;
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

            if (onClusterClick) {
                onClusterClick(clusterId, coordinates, pointCount);
            } else {
                const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
                const zoom = await source.getClusterExpansionZoom(clusterId);
                map.easeTo({ center: coordinates, zoom });
            }
        };

        // --- point click ---
        const handlePointClick = (
            e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] },
        ) => {
            const feature = e.features?.[0];
            if (!onPointClick || !feature) return;
            const coordinates = unwrapPointCoords(
                feature as unknown as GeoJSON.Feature<GeoJSON.Point>,
                e.lngLat.lng,
            );
            onPointClick(feature as unknown as GeoJSON.Feature<GeoJSON.Point, P>, coordinates);
        };

        // --- point hover (tooltip) ---
        const updateHoveredPoint = (
            e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] },
        ) => {
            const feature = e.features?.[0];
            if (!renderPointTooltip || !feature) return;

            const coordinates = unwrapPointCoords(
                feature as unknown as GeoJSON.Feature<GeoJSON.Point>,
                e.lngLat.lng,
            );

            setHoveredPoint((current) => {
                const nextId = getFeatureId(feature);
                const currentId = current ? getFeatureId(current.feature) : undefined;
                if (
                    current &&
                    nextId !== undefined &&
                    currentId === nextId &&
                    current.coordinates[0] === coordinates[0] &&
                    current.coordinates[1] === coordinates[1]
                ) {
                    return current;
                }
                return {
                    feature: feature as unknown as GeoJSON.Feature<GeoJSON.Point, P>,
                    coordinates,
                };
            });
        };

        const clearHovered = () => setHoveredPoint(null);

        // --- cursor ---
        const setCursor = (v: string) => { map.getCanvas().style.cursor = v; };

        // --- bind helpers ---
        const unbinders: Array<() => void> = [];
        const bind = <T extends keyof MapLibreGL.MapLayerEventType>(
            type: T,
            layerId: string,
            handler: (e: MapLibreGL.MapLayerEventType[T]) => void,
        ) => {
            map.on(type, layerId, handler as never);
            unbinders.push(() => map.off(type, layerId, handler as never));
        };

        if (!pieEnabled) {
            bind("click", clusterLayerId, handleClusterClick);
            bind("mouseenter", clusterLayerId, () => setCursor("pointer"));
            bind("mouseleave", clusterLayerId, () => setCursor(""));
        } else if (map.getLayer(clusterHitLayerId)) {
            bind("mouseenter", clusterHitLayerId, () => setCursor("pointer"));
            bind("mouseleave", clusterHitLayerId, () => setCursor(""));
        }

        bind("click", unclusteredLayerId, handlePointClick);
        bind("mouseenter", unclusteredLayerId, () => { if (onPointClick) setCursor("pointer"); });
        bind("mouseleave", unclusteredLayerId, () => { setCursor(""); clearHovered(); });

        if (renderPointTooltip) {
            bind("mouseenter", unclusteredLayerId, updateHoveredPoint);
            bind("mousemove", unclusteredLayerId, updateHoveredPoint);
        }

        map.on("click", clearHovered);
        map.on("touchstart", clearHovered);
        map.on("movestart", clearHovered);
        map.on("zoomstart", clearHovered);

        return () => {
            map.off("click", clearHovered);
            map.off("touchstart", clearHovered);
            map.off("movestart", clearHovered);
            map.off("zoomstart", clearHovered);
            for (let i = unbinders.length - 1; i >= 0; i -= 1) unbinders[i]!();
        };
    }, [
        isLoaded,
        map,
        pieEnabled,
        clusterLayerId,
        clusterHitLayerId,
        unclusteredLayerId,
        sourceId,
        onClusterClick,
        onPointClick,
        renderPointTooltip,
    ]);

    return { hoveredPoint };
}
