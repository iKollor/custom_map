"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useEffectEvent, useId, useMemo } from "react";

import { MAP_COLORS, ARC_DEFAULTS } from "./constants";
import { useMap } from "./core";
import { safeRemoveLayer, safeRemoveSource } from "./utils";

type MapArcDatum = {
    id: string | number;
    from: [number, number];
    to: [number, number];
};

type MapArcEvent<T extends MapArcDatum = MapArcDatum> = {
    arc: T;
    longitude: number;
    latitude: number;
    originalEvent: MapLibreGL.MapMouseEvent;
};

type MapArcLinePaint = NonNullable<MapLibreGL.LineLayerSpecification["paint"]>;
type MapArcLineLayout = NonNullable<
    MapLibreGL.LineLayerSpecification["layout"]
>;

type MapArcProps<T extends MapArcDatum = MapArcDatum> = {
    data: T[];
    id?: string;
    curvature?: number;
    samples?: number;
    paint?: MapArcLinePaint;
    layout?: MapArcLineLayout;
    hoverPaint?: MapArcLinePaint;
    onClick?: (e: MapArcEvent<T>) => void;
    onHover?: (e: MapArcEvent<T> | null) => void;
    interactive?: boolean;
    beforeId?: string;
};

const DEFAULT_ARC_PAINT: MapArcLinePaint = {
    "line-color": MAP_COLORS.primary,
    "line-width": 2,
    "line-opacity": 0.85,
};

const DEFAULT_ARC_LAYOUT: MapArcLineLayout = {
    "line-join": "round",
    "line-cap": "round",
};

function mergeArcPaint(
    paint: MapArcLinePaint,
    hoverPaint: MapArcLinePaint | undefined,
): MapArcLinePaint {
    if (!hoverPaint) return paint;
    const merged: Record<string, unknown> = { ...paint };
    for (const [key, hoverValue] of Object.entries(hoverPaint)) {
        if (hoverValue === undefined) continue;
        const baseValue = merged[key];
        merged[key] =
            baseValue === undefined
                ? hoverValue
                : [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    hoverValue,
                    baseValue,
                ];
    }
    return merged as MapArcLinePaint;
}

function buildArcCoordinates(
    from: [number, number],
    to: [number, number],
    curvature: number,
    samples: number,
): [number, number][] {
    const [x0, y0] = from;
    const [x2, y2] = to;
    const dx = x2 - x0;
    const dy = y2 - y0;
    const distance = Math.hypot(dx, dy);

    if (distance === 0 || curvature === 0) return [from, to];

    const mx = (x0 + x2) / 2;
    const my = (y0 + y2) / 2;
    const nx = -dy / distance;
    const ny = dx / distance;
    const offset = distance * curvature;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    const points: [number, number][] = [];
    const segments = Math.max(2, Math.floor(samples));
    for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const inv = 1 - t;
        const x = inv * inv * x0 + 2 * inv * t * cx + t * t * x2;
        const y = inv * inv * y0 + 2 * inv * t * cy + t * t * y2;
        points.push([x, y]);
    }
    return points;
}

function MapArc<T extends MapArcDatum = MapArcDatum>({
    data,
    id: propId,
    curvature = ARC_DEFAULTS.curvature,
    samples = ARC_DEFAULTS.samples,
    paint,
    layout,
    hoverPaint,
    onClick,
    onHover,
    interactive = true,
    beforeId,
}: MapArcProps<T>) {
    const { map, isLoaded } = useMap();
    const autoId = useId();
    const id = propId ?? autoId;
    const sourceId = `arc-source-${id}`;
    const layerId = `arc-layer-${id}`;
    const hitLayerId = `arc-hit-layer-${id}`;

    const mergedPaint = useMemo(
        () => mergeArcPaint({ ...DEFAULT_ARC_PAINT, ...paint }, hoverPaint),
        [paint, hoverPaint],
    );
    const mergedLayout = useMemo(
        () => ({ ...DEFAULT_ARC_LAYOUT, ...layout }),
        [layout],
    );

    const hitWidth = useMemo(() => {
        const w = paint?.["line-width"] ?? DEFAULT_ARC_PAINT["line-width"];
        const base = typeof w === "number" ? w : ARC_DEFAULTS.hitMinWidth;
        return Math.max(base + ARC_DEFAULTS.hitPadding, ARC_DEFAULTS.hitMinWidth);
    }, [paint]);

    const geoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
        () => ({
            type: "FeatureCollection",
            features: data.map((arc) => {
                const { from, to, ...properties } = arc;
                return {
                    type: "Feature",
                    properties,
                    geometry: {
                        type: "LineString",
                        coordinates: buildArcCoordinates(from, to, curvature, samples),
                    },
                };
            }),
        }),
        [data, curvature, samples],
    );

    const handleArcHover = useEffectEvent((event: MapArcEvent<T> | null) => {
        onHover?.(event);
    });
    const handleArcClick = useEffectEvent((event: MapArcEvent<T>) => {
        onClick?.(event);
    });

    useEffect(() => {
        if (!isLoaded || !map) return;

        map.addSource(sourceId, {
            type: "geojson",
            data: geoJSON,
            promoteId: "id",
        });

        map.addLayer(
            {
                id: hitLayerId,
                type: "line",
                source: sourceId,
                layout: DEFAULT_ARC_LAYOUT,
                paint: {
                    "line-color": "rgba(0, 0, 0, 0)",
                    "line-width": hitWidth,
                    "line-opacity": 1,
                },
            },
            beforeId,
        );

        map.addLayer(
            {
                id: layerId,
                type: "line",
                source: sourceId,
                layout: mergedLayout,
                paint: mergedPaint,
            },
            beforeId,
        );

        return () => {
            safeRemoveLayer(map, layerId);
            safeRemoveLayer(map, hitLayerId);
            safeRemoveSource(map, sourceId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, map]);

    useEffect(() => {
        if (!isLoaded || !map) return;
        const source = map.getSource(sourceId) as
            | MapLibreGL.GeoJSONSource
            | undefined;
        source?.setData(geoJSON);
    }, [isLoaded, map, geoJSON, sourceId]);

    useEffect(() => {
        if (!isLoaded || !map || !map.getLayer(layerId)) return;
        for (const [key, value] of Object.entries(mergedPaint)) {
            map.setPaintProperty(
                layerId,
                key as keyof MapArcLinePaint,
                value as never,
            );
        }
        for (const [key, value] of Object.entries(mergedLayout)) {
            map.setLayoutProperty(
                layerId,
                key as keyof MapArcLineLayout,
                value as never,
            );
        }
        if (map.getLayer(hitLayerId)) {
            map.setPaintProperty(hitLayerId, "line-width", hitWidth);
        }
    }, [isLoaded, map, layerId, hitLayerId, mergedPaint, mergedLayout, hitWidth]);

    useEffect(() => {
        if (!isLoaded || !map || !interactive) return;

        let hoveredId: string | number | null = null;

        const setHover = (next: string | number | null) => {
            if (next === hoveredId) return;
            const sourceExists = !!map.getSource(sourceId);
            if (hoveredId != null && sourceExists) {
                map.setFeatureState(
                    { source: sourceId, id: hoveredId },
                    { hover: false },
                );
            }
            hoveredId = next;
            if (next != null && sourceExists) {
                map.setFeatureState({ source: sourceId, id: next }, { hover: true });
            }
        };

        const findArc = (featureId: string | number | undefined) =>
            featureId == null
                ? undefined
                : data.find((arc) => String(arc.id) === String(featureId));

        const handleMouseMove = (e: MapLibreGL.MapLayerMouseEvent) => {
            const featureId = e.features?.[0]?.id as string | number | undefined;
            if (featureId == null || featureId === hoveredId) return;

            setHover(featureId);
            map.getCanvas().style.cursor = "pointer";

            const arc = findArc(featureId);
            if (arc) {
                handleArcHover?.({
                    arc: arc as T,
                    longitude: e.lngLat.lng,
                    latitude: e.lngLat.lat,
                    originalEvent: e,
                });
            }
        };

        const handleMouseLeave = () => {
            setHover(null);
            map.getCanvas().style.cursor = "";
            handleArcHover?.(null);
        };

        const handleClick = (e: MapLibreGL.MapLayerMouseEvent) => {
            const arc = findArc(e.features?.[0]?.id as string | number | undefined);
            if (!arc) return;
            handleArcClick?.({
                arc: arc as T,
                longitude: e.lngLat.lng,
                latitude: e.lngLat.lat,
                originalEvent: e,
            });
        };

        map.on("mousemove", hitLayerId, handleMouseMove);
        map.on("mouseleave", hitLayerId, handleMouseLeave);
        map.on("click", hitLayerId, handleClick);

        return () => {
            map.off("mousemove", hitLayerId, handleMouseMove);
            map.off("mouseleave", hitLayerId, handleMouseLeave);
            map.off("click", hitLayerId, handleClick);
            setHover(null);
            map.getCanvas().style.cursor = "";
        };
    }, [isLoaded, map, hitLayerId, sourceId, interactive, data]);

    return null;
}

export { MapArc };
export type { MapArcDatum, MapArcEvent };
