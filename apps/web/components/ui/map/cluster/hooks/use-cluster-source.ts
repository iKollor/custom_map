"use client";

import MapLibreGL from "maplibre-gl";
import { useEffect, useMemo } from "react";

import { CLUSTER_DEFAULTS, MAP_COLORS } from "../../constants";
import { useMap } from "../../core";
import { safeRemoveLayer, safeRemoveSource } from "../../utils";

import { ensureClusterMarkerStyles, stepExpression, toCategoryCountKey } from "../helpers";
import type { ClusterLayerIds, MapClusterLayerProps } from "../types";

// ============================================================================
// useClusterSource
// ============================================================================

/**
 * Creates the GeoJSON source, cluster/unclustered layers, and optional
 * coverage overlay layers.  Also handles data updates and paint-property
 * changes when colours/thresholds change.
 */
export function useClusterSource<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
>(
    ids: ClusterLayerIds,
    data: MapClusterLayerProps<P>["data"],
    opts: {
        clusterMaxZoom: number;
        clusterRadius: number;
        clusterColors: [string, string, string];
        clusterThresholds: [number, number];
        pointColor: string;
        pieEnabled: boolean;
        pieOptions: MapClusterLayerProps<P>["pieOptions"];
        coverageEnabled: boolean;
        coverageOverlayOptions: MapClusterLayerProps<P>["coverageOverlayOptions"];
        categoryEntries: [string, string][];
    },
) {
    const { map, isLoaded } = useMap();

    const {
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
    } = opts;

    const {
        sourceId,
        clusterLayerId,
        clusterCountLayerId,
        clusterHitLayerId,
        unclusteredLayerId,
        coverageSourceId,
        coverageFillLayerId,
        coverageOutlineLayerId,
    } = ids;

    // -- Build cluster properties once per categoryEntries/pieOptions change --
    const clusterProperties = useMemo(() => {
        if (!pieEnabled || !pieOptions) return undefined;
        return Object.fromEntries(
            categoryEntries.map(([category]) => [
                toCategoryCountKey(category),
                [
                    "+",
                    [
                        "case",
                        ["==", ["get", pieOptions.categoryProperty], category],
                        1,
                        0,
                    ],
                ],
            ]),
        );
    }, [pieEnabled, pieOptions, categoryEntries]);

    // -- Add source + layers on mount, tear down on unmount --
    useEffect(() => {
        if (!isLoaded || !map) return;

        ensureClusterMarkerStyles();

        map.addSource(sourceId, {
            type: "geojson",
            data,
            cluster: true,
            clusterMaxZoom,
            clusterRadius,
            ...(clusterProperties ? { clusterProperties } : {}),
        });

        if (coverageEnabled) {
            map.addSource(coverageSourceId, {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addLayer({
                id: coverageFillLayerId,
                type: "fill",
                source: coverageSourceId,
                paint: {
                    "fill-color": ["coalesce", ["get", "overlayColor"], MAP_COLORS.primary],
                    "fill-opacity":
                        coverageOverlayOptions?.fillOpacity ??
                        CLUSTER_DEFAULTS.coverageFillOpacity,
                },
            });

            map.addLayer({
                id: coverageOutlineLayerId,
                type: "line",
                source: coverageSourceId,
                paint: {
                    "line-color": ["coalesce", ["get", "overlayColor"], MAP_COLORS.primary],
                    "line-opacity":
                        coverageOverlayOptions?.outlineOpacity ??
                        CLUSTER_DEFAULTS.coverageOutlineOpacity,
                    "line-width": 1.6,
                },
                layout: { "line-join": "round", "line-cap": "round" },
            });
        }

        if (!pieEnabled) {
            map.addLayer({
                id: clusterLayerId,
                type: "circle",
                source: sourceId,
                filter: ["has", "point_count"],
                paint: {
                    "circle-color": stepExpression(clusterThresholds, clusterColors),
                    "circle-radius": stepExpression(clusterThresholds, [40, 50, 64]),
                    "circle-stroke-width": 1.2,
                    "circle-stroke-color": MAP_COLORS.white,
                    "circle-opacity": 0.88,
                },
            });

            map.addLayer({
                id: clusterCountLayerId,
                type: "symbol",
                source: sourceId,
                filter: ["has", "point_count"],
                layout: {
                    "text-field": "{point_count_abbreviated}",
                    "text-font": ["Open Sans"],
                    "text-size": 14,
                },
                paint: { "text-color": MAP_COLORS.white },
            });
        } else {
            // Invisible hit layer for hover/cursor; opacity 0 so it doesn't
            // compete visually with the HTML pie marker.
            map.addLayer({
                id: clusterHitLayerId,
                type: "circle",
                source: sourceId,
                filter: ["has", "point_count"],
                paint: {
                    "circle-radius": stepExpression(clusterThresholds, [36, 44, 56]),
                    "circle-opacity": 0,
                    "circle-color": "#000",
                },
            });
        }

        map.addLayer({
            id: unclusteredLayerId,
            type: "circle",
            source: sourceId,
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-color":
                    pieEnabled && pieOptions
                        ? ["coalesce", ["get", pieOptions.colorProperty], pointColor]
                        : pointColor,
                "circle-radius": 8,
                "circle-stroke-width": 2,
                "circle-stroke-color": MAP_COLORS.white,
            },
        });

        return () => {
            safeRemoveLayer(map, clusterCountLayerId);
            safeRemoveLayer(map, unclusteredLayerId);
            safeRemoveLayer(map, coverageOutlineLayerId);
            safeRemoveLayer(map, coverageFillLayerId);
            safeRemoveLayer(map, clusterHitLayerId);
            safeRemoveLayer(map, clusterLayerId);
            safeRemoveSource(map, coverageSourceId);
            safeRemoveSource(map, sourceId);
        };
    }, [
        isLoaded,
        map,
        sourceId,
        data,
        clusterMaxZoom,
        clusterRadius,
        clusterProperties,
        pieEnabled,
        coverageEnabled,
        pieOptions,
        coverageOverlayOptions,
        categoryEntries,
        clusterColors,
        clusterThresholds,
        pointColor,
        clusterHitLayerId,
        clusterCountLayerId,
        clusterLayerId,
        unclusteredLayerId,
        coverageSourceId,
        coverageFillLayerId,
        coverageOutlineLayerId,
    ]);

    // -- Update GeoJSON data when it changes (non-URL sources) --
    useEffect(() => {
        if (!isLoaded || !map || typeof data === "string") return;
        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
        source?.setData(data);
    }, [isLoaded, map, data, sourceId]);

    // -- Repaint layers when colours/thresholds change (non-pie mode) --
    useEffect(() => {
        if (!isLoaded || !map || pieEnabled) return;

        if (map.getLayer(clusterLayerId)) {
            map.setPaintProperty(
                clusterLayerId,
                "circle-color",
                stepExpression(clusterThresholds, clusterColors),
            );
            map.setPaintProperty(
                clusterLayerId,
                "circle-radius",
                stepExpression(clusterThresholds, [20, 30, 40]),
            );
        }
        if (map.getLayer(unclusteredLayerId)) {
            map.setPaintProperty(unclusteredLayerId, "circle-color", pointColor);
        }
    }, [
        isLoaded,
        map,
        pieEnabled,
        clusterLayerId,
        unclusteredLayerId,
        clusterColors,
        clusterThresholds,
        pointColor,
    ]);
}
