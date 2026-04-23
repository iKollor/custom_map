"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId } from "react";

import { MAP_COLORS } from "./constants";
import { useMap } from "./core";
import { safeRemoveLayer, safeRemoveSource } from "./utils";

type MapRouteProps = {
    id?: string;
    coordinates: [number, number][];
    color?: string;
    width?: number;
    opacity?: number;
    dashArray?: [number, number];
    onClick?: () => void;
    onContextMenu?: (
        coords: [number, number],
        screenPos: { x: number; y: number },
    ) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    interactive?: boolean;
};

type MapPolygonProps = {
    id?: string;
    coordinates: [number, number][];
    fillColor?: string;
    fillOpacity?: number;
    outlineColor?: string;
    outlineOpacity?: number;
};

function MapPolygon({
    id: propId,
    coordinates,
    fillColor = MAP_COLORS.primary,
    fillOpacity = 0.16,
    outlineColor,
    outlineOpacity = 0.85,
}: MapPolygonProps) {
    const { map, isLoaded } = useMap();
    const autoId = useId();
    const id = propId ?? autoId;
    const sourceId = `polygon-source-${id}`;
    const fillLayerId = `polygon-fill-${id}`;
    const outlineLayerId = `polygon-outline-${id}`;

    useEffect(() => {
        if (!isLoaded || !map) return;

        map.addSource(sourceId, {
            type: "geojson",
            data: {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [[]] },
            },
        });

        map.addLayer({
            id: fillLayerId,
            type: "fill",
            source: sourceId,
            paint: {
                "fill-color": fillColor,
                "fill-opacity": fillOpacity,
            },
        });

        map.addLayer({
            id: outlineLayerId,
            type: "line",
            source: sourceId,
            paint: {
                "line-color": outlineColor ?? fillColor,
                "line-opacity": outlineOpacity,
                "line-width": 2,
            },
            layout: { "line-join": "round", "line-cap": "round" },
        });

        return () => {
            safeRemoveLayer(map, outlineLayerId);
            safeRemoveLayer(map, fillLayerId);
            safeRemoveSource(map, sourceId);
        };
    }, [
        isLoaded,
        map,
        sourceId,
        fillLayerId,
        outlineLayerId,
        fillColor,
        fillOpacity,
        outlineColor,
        outlineOpacity,
    ]);

    useEffect(() => {
        if (!isLoaded || !map || coordinates.length < 4) return;

        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
        source?.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
        });
    }, [isLoaded, map, coordinates, sourceId]);

    useEffect(() => {
        if (!isLoaded || !map) return;
        if (map.getLayer(fillLayerId)) {
            map.setPaintProperty(fillLayerId, "fill-color", fillColor);
            map.setPaintProperty(fillLayerId, "fill-opacity", fillOpacity);
        }
        if (map.getLayer(outlineLayerId)) {
            map.setPaintProperty(
                outlineLayerId,
                "line-color",
                outlineColor ?? fillColor,
            );
            map.setPaintProperty(outlineLayerId, "line-opacity", outlineOpacity);
        }
    }, [
        isLoaded,
        map,
        fillLayerId,
        outlineLayerId,
        fillColor,
        fillOpacity,
        outlineColor,
        outlineOpacity,
    ]);

    return null;
}

function MapRoute({
    id: propId,
    coordinates,
    color = MAP_COLORS.primary,
    width = 3,
    opacity = 0.8,
    dashArray,
    onClick,
    onContextMenu,
    onMouseEnter,
    onMouseLeave,
    interactive = true,
}: MapRouteProps) {
    const { map, isLoaded } = useMap();
    const autoId = useId();
    const id = propId ?? autoId;
    const sourceId = `route-source-${id}`;
    const layerId = `route-layer-${id}`;

    useEffect(() => {
        if (!isLoaded || !map) return;

        map.addSource(sourceId, {
            type: "geojson",
            data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: [] },
            },
        });

        map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": color,
                "line-width": width,
                "line-opacity": opacity,
                ...(dashArray && { "line-dasharray": dashArray }),
            },
        });

        return () => {
            safeRemoveLayer(map, layerId);
            safeRemoveSource(map, sourceId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, map]);

    useEffect(() => {
        if (!isLoaded || !map || coordinates.length < 2) return;

        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
        if (source) {
            source.setData({
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates },
            });
        }
    }, [isLoaded, map, coordinates, sourceId]);

    useEffect(() => {
        if (!isLoaded || !map || !map.getLayer(layerId)) return;

        map.setPaintProperty(layerId, "line-color", color);
        map.setPaintProperty(layerId, "line-width", width);
        map.setPaintProperty(layerId, "line-opacity", opacity);
        if (dashArray) {
            map.setPaintProperty(layerId, "line-dasharray", dashArray);
        }
    }, [isLoaded, map, layerId, color, width, opacity, dashArray]);

    useEffect(() => {
        if (!isLoaded || !map || !interactive) return;

        const handleClick = () => {
            onClick?.();
        };
        const handleContextMenuEvent = (e: MapLibreGL.MapMouseEvent) => {
            e.originalEvent.preventDefault();
            onContextMenu?.([e.lngLat.lng, e.lngLat.lat], {
                x: e.originalEvent.clientX,
                y: e.originalEvent.clientY,
            });
        };
        const handleMouseEnter = () => {
            map.getCanvas().style.cursor = "pointer";
            onMouseEnter?.();
        };
        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            onMouseLeave?.();
        };

        map.on("click", layerId, handleClick);
        map.on("contextmenu", layerId, handleContextMenuEvent);
        map.on("mouseenter", layerId, handleMouseEnter);
        map.on("mouseleave", layerId, handleMouseLeave);

        return () => {
            map.off("click", layerId, handleClick);
            map.off("contextmenu", layerId, handleContextMenuEvent);
            map.off("mouseenter", layerId, handleMouseEnter);
            map.off("mouseleave", layerId, handleMouseLeave);
        };
    }, [
        isLoaded,
        map,
        layerId,
        onClick,
        onContextMenu,
        onMouseEnter,
        onMouseLeave,
        interactive,
    ]);

    return null;
}

export { MapPolygon, MapRoute };
export type { MapPolygonProps, MapRouteProps };
