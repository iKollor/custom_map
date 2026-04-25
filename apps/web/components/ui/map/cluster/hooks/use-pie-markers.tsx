"use client";

import MapLibreGL from "maplibre-gl";
import { useRef, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { CLUSTER_DEFAULTS } from "../../constants";
import { useMap } from "../../core";
import { wrapLongitudeForView } from "../../utils";

import { ClusterPieMarkerChart } from "../cluster-pie-marker";
import {
    removeMarkerEntry,
    segmentPercent,
    stepExpression,
    toCategoryCountKey,
} from "../helpers";
import type {
    ClusterLayerIds,
    ClusterMarkerEntry,
    ClusterPieDetails,
    ClusterPieSegment,
    MapClusterLayerProps,
} from "../types";

// ============================================================================
// usePieMarkers
// ============================================================================

/**
 * Renders HTML pie-chart markers on top of the invisible cluster hit layer.
 * Returns the active pie state so the parent can render the popup.
 */
export function usePieMarkers<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
>(
    ids: ClusterLayerIds,
    opts: {
        pieEnabled: boolean;
        pieOptions: MapClusterLayerProps<P>["pieOptions"];
        pointColor: string;
        categoryEntries: [string, string][];
        onClusterClick: MapClusterLayerProps<P>["onClusterClick"];
    },
) {
    const { map, isLoaded } = useMap();
    const { sourceId, clusterHitLayerId } = ids;
    const { pieEnabled, pieOptions, pointColor, categoryEntries, onClusterClick } = opts;

    const clusterMarkersRef = useRef<Map<number, ClusterMarkerEntry>>(
        new globalThis.Map(),
    );
    const [activePie, setActivePie] = useState<ClusterPieDetails | null>(null);

    useEffect(() => {
        if (!isLoaded || !map || !pieEnabled) return;

        const markers = clusterMarkersRef.current;

        const clearMarkers = () => {
            for (const entry of markers.values()) removeMarkerEntry(entry);
            markers.clear();
        };

        const createClickHandler = (
            clusterId: number,
            coordinates: [number, number],
            pointCount: number,
            segmentsWithPercent: ClusterPieSegment[],
            source: MapLibreGL.GeoJSONSource,
        ) => {
            return async (event: MouseEvent) => {
                event.stopPropagation();

                if (onClusterClick) {
                    onClusterClick(clusterId, coordinates, pointCount);
                    return;
                }

                setActivePie((prev) => {
                    if (prev?.clusterId === clusterId) return prev;
                    return { clusterId, pointCount, coordinates, segments: segmentsWithPercent };
                });

                try {
                    const zoom = await source.getClusterExpansionZoom(clusterId);
                    map.easeTo(
                        map.getZoom() >= zoom - 0.1
                            ? { center: coordinates, zoom, duration: 500 }
                            : { center: coordinates, duration: 400 },
                    );
                } catch {
                    map.easeTo({ center: coordinates, duration: 400 });
                }
            };
        };

        const renderPieMarkerJSX = (
            radius: number,
            pointCount: number,
            segments: Array<{ category: string; color: string; count: number; label: string }>,
        ) => (
            <div className="mapcn-pie-cluster-marker-inner">
                <ClusterPieMarkerChart
                    radius={radius}
                    total={pointCount}
                    showPercent={pieOptions?.showDominantPercent ?? true}
                    segments={segments}
                />
            </div>
        );

        const renderPieMarkers = () => {
            if (!map.getSource(sourceId) || !map.getLayer(clusterHitLayerId)) return;

            const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
            const mapCenter = map.getCenter();
            const features = map
                .queryRenderedFeatures({ layers: [clusterHitLayerId] })
                .filter((f) => f.properties?.cluster);

            if (!features.length) {
                clearMarkers();
                return;
            }

            // De-duplicate: keep the rendered copy closest to the map centre.
            const candidates = new globalThis.Map<
                number,
                { feature: MapLibreGL.MapGeoJSONFeature; score: number }
            >();

            for (const feature of features) {
                const props = feature.properties;
                if (!props?.cluster) continue;
                const clusterId = Number(props.cluster_id);
                if (!Number.isFinite(clusterId)) continue;

                const rawCoords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
                if (!rawCoords || rawCoords.length < 2) continue;

                const wrappedLng = wrapLongitudeForView(rawCoords[0], mapCenter.lng);
                const score =
                    Math.abs(wrappedLng - mapCenter.lng) +
                    Math.abs(rawCoords[1] - mapCenter.lat);

                const existing = candidates.get(clusterId);
                if (!existing || score < existing.score) {
                    candidates.set(clusterId, { feature, score });
                }
            }

            const nextClusterIds = new Set<number>();

            for (const [clusterId, { feature }] of candidates) {
                const props = feature.properties;
                if (!props?.cluster) continue;
                nextClusterIds.add(clusterId);

                const pointCount = Math.max(1, Number(props.point_count ?? 1));
                const radiusMin = pieOptions?.minRadius ?? CLUSTER_DEFAULTS.pieMinRadius;
                const radiusMax = pieOptions?.maxRadius ?? CLUSTER_DEFAULTS.pieMaxRadius;
                const scale = Math.min(1, Math.log10(pointCount + 1) / 3);
                const radius = radiusMin + (radiusMax - radiusMin) * scale;
                const size = radius * 2;

                const segments = categoryEntries
                    .map(([category, color]) => ({
                        category,
                        color,
                        count: Number(props[toCategoryCountKey(category)] ?? 0),
                    }))
                    .filter((s) => s.count > 0);

                const normalizedSegments =
                    segments.length > 0
                        ? segments.map((s) => ({ ...s, label: s.category }))
                        : [{ category: "default", color: pointColor, count: pointCount, label: "Sin categoría" }];

                const segmentsWithPercent: ClusterPieSegment[] = normalizedSegments.map((s) => ({
                    category: s.category,
                    color: s.color,
                    count: s.count,
                    percent: segmentPercent(s.count, pointCount),
                }));

                const rawCoords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
                const coordinates: [number, number] = [
                    wrapLongitudeForView(rawCoords[0], mapCenter.lng),
                    rawCoords[1],
                ];

                const markerSignature = JSON.stringify({
                    pointCount,
                    radius: Math.round(radius * 10) / 10,
                    showPercent: pieOptions?.showDominantPercent ?? true,
                    segments: normalizedSegments.map((s) => ({
                        category: s.category,
                        count: s.count,
                        color: s.color,
                    })),
                });

                const clickHandler = createClickHandler(
                    clusterId, coordinates, pointCount, segmentsWithPercent, source,
                );

                // Update existing marker if possible
                const existing = markers.get(clusterId);
                if (existing) {
                    if (existing.signature !== markerSignature) {
                        existing.root.render(renderPieMarkerJSX(radius, pointCount, normalizedSegments));
                        existing.signature = markerSignature;
                    }
                    existing.element.removeEventListener("click", existing.onClick);
                    existing.element.addEventListener("click", clickHandler);
                    existing.onClick = clickHandler;
                    existing.marker.setLngLat(coordinates);
                    continue;
                }

                // Create new marker
                const el = document.createElement("div");
                el.setAttribute("role", "button");
                el.setAttribute("tabindex", "0");
                el.className = "mapcn-pie-cluster-marker";
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;

                const root = createRoot(el);
                root.render(renderPieMarkerJSX(radius, pointCount, normalizedSegments));
                el.addEventListener("click", clickHandler);

                const marker = new MapLibreGL.Marker({ element: el, anchor: "center" })
                    .setLngLat(coordinates)
                    .addTo(map);

                markers.set(clusterId, { marker, element: el, root, onClick: clickHandler, signature: markerSignature });
            }

            // Remove stale markers
            for (const [clusterId, entry] of markers) {
                if (nextClusterIds.has(clusterId)) continue;
                removeMarkerEntry(entry);
                markers.delete(clusterId);
            }
        };

        const handleData = (e: MapLibreGL.MapSourceDataEvent) => {
            if (e.sourceId !== sourceId || !e.isSourceLoaded) return;
            renderPieMarkers();
        };

        map.on("moveend", renderPieMarkers);
        map.on("zoomend", renderPieMarkers);
        map.on("sourcedata", handleData);
        map.on("idle", renderPieMarkers);

        renderPieMarkers();

        return () => {
            map.off("moveend", renderPieMarkers);
            map.off("zoomend", renderPieMarkers);
            map.off("sourcedata", handleData);
            map.off("idle", renderPieMarkers);
            clearMarkers();
        };
    }, [
        isLoaded,
        map,
        pieEnabled,
        sourceId,
        clusterHitLayerId,
        pointColor,
        onClusterClick,
        pieOptions,
        categoryEntries,
    ]);

    // Clean up markers on unmount (safety net)
    useEffect(() => {
        const markers = clusterMarkersRef.current;
        return () => {
            try {
                for (const entry of markers.values()) removeMarkerEntry(entry);
                markers.clear();
            } catch {
                // ignore
            }
        };
    }, []);

    return { activePie, setActivePie };
}
