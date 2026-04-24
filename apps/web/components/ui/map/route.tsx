"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useRef } from "react";

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
    onMouseMove?: (coords: [number, number]) => void;
    onMouseLeave?: () => void;
    interactive?: boolean;
    animateOnMount?: boolean;
    animationDurationMs?: number;
};

type MapPolygonProps = {
    id?: string;
    coordinates: [number, number][];
    fillColor?: string;
    fillOpacity?: number;
    outlineColor?: string;
    outlineOpacity?: number;
    onClick?: () => void;
    onContextMenu?: (
        coords: [number, number],
        screenPos: { x: number; y: number },
    ) => void;
    onMouseEnter?: () => void;
    onMouseMove?: (coords: [number, number]) => void;
    onMouseLeave?: () => void;
    interactive?: boolean;
    animateOnMount?: boolean;
    animationDurationMs?: number;
};

function MapPolygon({
    id: propId,
    coordinates,
    fillColor = MAP_COLORS.primary,
    fillOpacity = 0.16,
    outlineColor,
    outlineOpacity = 0.85,
    onClick,
    onContextMenu,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    interactive = true,
    animateOnMount = false,
    animationDurationMs = 680,
}: MapPolygonProps) {
    const { map, isLoaded } = useMap();
    const autoId = useId();
    const id = propId ?? autoId;
    const sourceId = `polygon-source-${id}`;
    const fillLayerId = `polygon-fill-${id}`;
    const outlineLayerId = `polygon-outline-${id}`;
    const hasAnimatedRef = useRef(false);

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
                "fill-opacity": animateOnMount ? 0 : fillOpacity,
            },
        });

        map.addLayer({
            id: outlineLayerId,
            type: "line",
            source: sourceId,
            paint: {
                "line-color": outlineColor ?? fillColor,
                "line-opacity": animateOnMount ? 0 : outlineOpacity,
                "line-width": animateOnMount ? 0.8 : 2,
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
        animateOnMount,
    ]);

    useEffect(() => {
        if (!isLoaded || !map || !animateOnMount || hasAnimatedRef.current) return;
        if (!map.getLayer(fillLayerId) || !map.getLayer(outlineLayerId)) return;

        hasAnimatedRef.current = true;
        map.setPaintProperty(fillLayerId, "fill-opacity-transition", {
            duration: animationDurationMs,
            delay: 0,
        });
        map.setPaintProperty(outlineLayerId, "line-opacity-transition", {
            duration: animationDurationMs,
            delay: 0,
        });
        map.setPaintProperty(outlineLayerId, "line-width-transition", {
            duration: animationDurationMs,
            delay: 0,
        });

        requestAnimationFrame(() => {
            if (!map.getLayer(fillLayerId) || !map.getLayer(outlineLayerId)) return;
            map.setPaintProperty(fillLayerId, "fill-opacity", fillOpacity);
            map.setPaintProperty(outlineLayerId, "line-opacity", outlineOpacity);
            map.setPaintProperty(outlineLayerId, "line-width", 2);
        });
    }, [
        isLoaded,
        map,
        animateOnMount,
        fillLayerId,
        outlineLayerId,
        fillOpacity,
        outlineOpacity,
        animationDurationMs,
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
        const handleMouseMove = (e: MapLibreGL.MapMouseEvent) => {
            onMouseMove?.([e.lngLat.lng, e.lngLat.lat]);
        };
        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            onMouseLeave?.();
        };

        map.on("click", fillLayerId, handleClick);
        map.on("contextmenu", fillLayerId, handleContextMenuEvent);
        map.on("mouseenter", fillLayerId, handleMouseEnter);
        map.on("mousemove", fillLayerId, handleMouseMove);
        map.on("mouseleave", fillLayerId, handleMouseLeave);

        return () => {
            map.off("click", fillLayerId, handleClick);
            map.off("contextmenu", fillLayerId, handleContextMenuEvent);
            map.off("mouseenter", fillLayerId, handleMouseEnter);
            map.off("mousemove", fillLayerId, handleMouseMove);
            map.off("mouseleave", fillLayerId, handleMouseLeave);
        };
    }, [
        isLoaded,
        map,
        fillLayerId,
        onClick,
        onContextMenu,
        onMouseEnter,
        onMouseMove,
        onMouseLeave,
        interactive,
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
    onMouseMove,
    onMouseLeave,
    interactive = true,
    animateOnMount = false,
    animationDurationMs = 680,
}: MapRouteProps) {
    const { map, isLoaded } = useMap();
    const autoId = useId();
    const id = propId ?? autoId;
    const sourceId = `route-source-${id}`;
    const layerId = `route-layer-${id}`;
    const hasAnimatedRef = useRef(false);

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
                "line-width": animateOnMount ? Math.max(1, width * 0.2) : width,
                "line-opacity": animateOnMount ? 0 : opacity,
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
        if (!isLoaded || !map || !animateOnMount || hasAnimatedRef.current) return;
        if (!map.getLayer(layerId)) return;

        hasAnimatedRef.current = true;
        map.setPaintProperty(layerId, "line-opacity-transition", {
            duration: animationDurationMs,
            delay: 0,
        });
        map.setPaintProperty(layerId, "line-width-transition", {
            duration: animationDurationMs,
            delay: 0,
        });

        requestAnimationFrame(() => {
            if (!map.getLayer(layerId)) return;
            map.setPaintProperty(layerId, "line-opacity", opacity);
            map.setPaintProperty(layerId, "line-width", width);
        });
    }, [isLoaded, map, animateOnMount, layerId, opacity, width, animationDurationMs]);

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
        const handleMouseMove = (e: MapLibreGL.MapMouseEvent) => {
            onMouseMove?.([e.lngLat.lng, e.lngLat.lat]);
        };
        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            onMouseLeave?.();
        };

        map.on("click", layerId, handleClick);
        map.on("contextmenu", layerId, handleContextMenuEvent);
        map.on("mouseenter", layerId, handleMouseEnter);
        map.on("mousemove", layerId, handleMouseMove);
        map.on("mouseleave", layerId, handleMouseLeave);

        return () => {
            map.off("click", layerId, handleClick);
            map.off("contextmenu", layerId, handleContextMenuEvent);
            map.off("mouseenter", layerId, handleMouseEnter);
            map.off("mousemove", layerId, handleMouseMove);
            map.off("mouseleave", layerId, handleMouseLeave);
        };
    }, [
        isLoaded,
        map,
        layerId,
        onClick,
        onContextMenu,
        onMouseEnter,
        onMouseMove,
        onMouseLeave,
        interactive,
    ]);

    return null;
}

export { MapPolygon, MapRoute };
export type { MapPolygonProps, MapRouteProps };
