"use client";

import MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Cell, LabelList, Pie, PieChart } from "recharts";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@workspace/ui/components/chart";

import { CLUSTER_DEFAULTS, MAP_COLORS } from "./constants";
import { useMap } from "./core";
import { MapPopup } from "./popup";
import {
    buildConvexHull,
    safeRemoveLayer,
    safeRemoveSource,
    wrapLongitudeForView,
} from "./utils";

// ============================================================================
// Types
// ============================================================================

type MapClusterLayerProps<
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

type ClusterPieSegment = {
    category: string;
    color: string;
    count: number;
    percent: number;
};

type ClusterPieDetails = {
    clusterId: number;
    pointCount: number;
    coordinates: [number, number];
    segments: ClusterPieSegment[];
};

type ClusterMarkerEntry = {
    marker: MapLibreGL.Marker;
    element: HTMLDivElement;
    root: Root;
    onClick: (event: MouseEvent) => void;
    signature: string;
};

type HoveredPointState<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
    feature: GeoJSON.Feature<GeoJSON.Point, P>;
    coordinates: [number, number];
};

// ============================================================================
// Helpers
// ============================================================================

function toCategoryCountKey(category: string) {
    return `cat_${category.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

/** Devuelve el porcentaje entero (mínimo 1) del segmento respecto del total. */
function segmentPercent(count: number, total: number) {
    return Math.max(1, Math.round((count / Math.max(1, total)) * 100));
}

/** Construye un `ChartConfig` a partir de los segmentos (label → color). */
function chartConfigFromSegments(
    segments: Array<{ category?: string; label?: string; color: string }>,
    extra?: Record<string, { label?: string }>,
): ChartConfig {
    const config: ChartConfig = { ...extra };
    for (const seg of segments) {
        const key = seg.label ?? seg.category ?? "categoria";
        config[key] = { label: key, color: seg.color };
    }
    return config;
}

/** Expresión MapLibre en escalones usada para color y radio de clusters. */
function stepExpression(
    stops: [number, number],
    values: [unknown, unknown, unknown],
) {
    return [
        "step",
        ["get", "point_count"],
        values[0],
        stops[0],
        values[1],
        stops[1],
        values[2],
    ] as unknown as MapLibreGL.ExpressionSpecification;
}

/** Copia `coordinates` del Point desenvolviendo la longitud cerca de `refLng`. */
function unwrapPointCoords(
    feature: GeoJSON.Feature<GeoJSON.Point>,
    refLng: number,
): [number, number] {
    const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
        number,
        number,
    ];
    while (Math.abs(refLng - coords[0]) > 180) {
        coords[0] += refLng > coords[0] ? 360 : -360;
    }
    return coords;
}

/** Obtiene un id estable (feature.id o properties.id) para hover dedupe. */
function getFeatureId(f: {
    id?: string | number;
    properties?: unknown;
}): string | number | undefined {
    const props = f.properties as { id?: string | number } | null | undefined;
    return f.id ?? props?.id;
}

/** Desmonta completamente una entrada de marker (listener + root + marker). */
function removeMarkerEntry(entry: ClusterMarkerEntry) {
    entry.element.removeEventListener("click", entry.onClick);
    entry.marker.remove();

    // Evita desmontar el root de forma síncrona mientras React sigue en render.
    // Esto previene la advertencia de "Attempted to synchronously unmount a root...".
    const scheduleUnmount =
        typeof queueMicrotask === "function"
            ? queueMicrotask
            : (cb: () => void) => {
                  setTimeout(cb, 0);
              };

    scheduleUnmount(() => {
        try {
            entry.root.unmount();
        } catch {
            // ignore unmount races on disposed markers
        }
    });
}

function ensureClusterMarkerStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("mapcn-cluster-marker-styles")) return;

    const style = document.createElement("style");
    style.id = "mapcn-cluster-marker-styles";
    style.textContent = `
    .mapcn-pie-cluster-marker {
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      line-height: 0;
    }
    .mapcn-pie-cluster-marker-inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      transform-origin: center;
      animation: mapcn-cluster-pop 260ms cubic-bezier(0.22, 1, 0.36, 1);
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.28));
      transition: transform 180ms ease, filter 180ms ease;
      will-change: transform;
    }
    .mapcn-pie-cluster-marker:hover .mapcn-pie-cluster-marker-inner {
      transform: scale(1.04);
      filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.32));
    }
    @keyframes mapcn-cluster-pop {
      0% { transform: scale(0.85); opacity: 0; }
      70% { transform: scale(1.03); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
    document.head.appendChild(style);
}

function ClusterPieMarkerChart({
    radius,
    total,
    showPercent,
    segments,
}: {
    radius: number;
    total: number;
    showPercent: boolean;
    segments: Array<{ color: string; count: number; label?: string }>;
}) {
    const size = radius * 2;
    const outerRadius = Math.max(8, radius - 2);
    const labelFontSize = Math.max(9, Math.round(radius * 0.32));

    const chartConfig = useMemo<ChartConfig>(
        () =>
            chartConfigFromSegments(segments, {
                value: { label: showPercent ? "Porcentaje" : "Cantidad" },
            }),
        [segments, showPercent],
    );

    const data = useMemo(
        () =>
            segments.map((segment) => ({
                category: segment.label ?? "Categoria",
                value: segment.count,
                percent: segmentPercent(segment.count, total),
                fill: segment.color,
            })),
        [segments, total],
    );

    return (
        <div
            className="relative flex items-center justify-center opacity-85"
            style={{ width: size, height: size, overflow: "visible" }}
        >
            <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square h-full w-full overflow-visible [&_.recharts-text]:fill-background [&_.recharts-wrapper]:overflow-visible! [&_.recharts-surface]:overflow-visible"
            >
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <ChartTooltip
                        cursor={false}
                        allowEscapeViewBox={{ x: true, y: true }}
                        isAnimationActive={false}
                        wrapperStyle={{
                            zIndex: 50,
                            pointerEvents: "none",
                            transform: "translate(-50%, 0)",
                            left: "50%",
                            top: size + 16,
                            transition: "none",
                        }}
                        content={
                            <ChartTooltipContent
                                nameKey="value"
                                hideLabel
                                className="min-w-48 px-3 py-2 text-[12px] shadow-lg"
                            />
                        }
                    />
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="category"
                        outerRadius={outerRadius}
                        strokeWidth={1.5}
                        stroke="#ffffff"
                        fillOpacity={0.85}
                        isAnimationActive={false}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`${entry.category}-${index}`} fill={entry.fill} />
                        ))}
                        <LabelList
                            dataKey={showPercent ? "percent" : "value"}
                            className="fill-background"
                            stroke="none"
                            fontSize={labelFontSize}
                            fontWeight={600}
                            style={{ pointerEvents: "none" }}
                            formatter={(value) =>
                                showPercent ? `${value}%` : `${value}`
                            }
                        />
                    </Pie>
                </PieChart>
            </ChartContainer>
        </div>
    );
}

// ============================================================================
// Popup (Recharts + shadcn)
// ============================================================================

function ClusterPiePopup({
    details,
    onClose,
}: {
    details: ClusterPieDetails;
    onClose: () => void;
}) {
    const chartConfig = useMemo<ChartConfig>(
        () => chartConfigFromSegments(details.segments),
        [details.segments],
    );

    const chartData = useMemo(
        () =>
            details.segments.map((segment) => ({
                category: segment.category,
                value: segment.count,
                percent: segment.percent,
                fill: segment.color,
            })),
        [details.segments],
    );

    return (
        <MapPopup
            longitude={details.coordinates[0]}
            latitude={details.coordinates[1]}
            onClose={onClose}
            closeButton
            className="min-w-56 p-3"
            offset={24}
        >
            <div className="mb-1 text-xs font-medium text-muted-foreground">
                Cluster · {details.pointCount} puntos
            </div>
            <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square h-40 w-40"
            >
                <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent
                                hideLabel
                                formatter={(value, _name, item) => {
                                    const raw = item?.payload as
                                        | { category?: string; percent?: number }
                                        | undefined;
                                    const category = raw?.category ?? "";
                                    const pct = raw?.percent ?? 0;
                                    return (
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="size-2.5 rounded-full"
                                                style={{ background: item?.color }}
                                            />
                                            <span className="font-medium">{category}</span>
                                            <span className="ml-auto tabular-nums">
                                                {value} ({pct}%)
                                            </span>
                                        </div>
                                    );
                                }}
                            />
                        }
                    />
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="category"
                        innerRadius={32}
                        outerRadius={60}
                        strokeWidth={2}
                        paddingAngle={1}
                    >
                        {chartData.map((entry) => (
                            <Cell key={entry.category} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1 text-xs">
                {details.segments.map((segment) => (
                    <li key={segment.category} className="flex items-center gap-2">
                        <span
                            className="size-2.5 rounded-full"
                            style={{ background: segment.color }}
                        />
                        <span className="truncate">{segment.category}</span>
                        <span className="ml-auto tabular-nums text-muted-foreground">
                            {segment.count} ({segment.percent}%)
                        </span>
                    </li>
                ))}
            </ul>
        </MapPopup>
    );
}

// ============================================================================
// MapClusterLayer
// ============================================================================

function MapClusterLayer<
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
    pointTooltipClassName,
    pieOptions,
    coverageOverlayOptions,
}: MapClusterLayerProps<P>) {
    const { map, isLoaded } = useMap();
    const id = useId();
    const sourceId = `cluster-source-${id}`;
    const clusterLayerId = `clusters-${id}`;
    const clusterCountLayerId = `cluster-count-${id}`;
    const clusterHitLayerId = `clusters-hit-${id}`;
    const unclusteredLayerId = `unclustered-point-${id}`;
    const coverageSourceId = `clusters-coverage-source-${id}`;
    const coverageFillLayerId = `clusters-coverage-fill-${id}`;
    const coverageOutlineLayerId = `clusters-coverage-outline-${id}`;

    const pieEnabled = pieOptions?.enabled ?? false;
    const coverageEnabled = coverageOverlayOptions?.enabled ?? false;
    const categoryEntries = useMemo(
        () => Object.entries(pieOptions?.categoryColors ?? {}),
        [pieOptions?.categoryColors],
    );

    const clusterMarkersRef = useRef<Map<number, ClusterMarkerEntry>>(
        new globalThis.Map(),
    );
    const [activePie, setActivePie] = useState<ClusterPieDetails | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<HoveredPointState<P> | null>(null);

    // Add source and layers on mount
    useEffect(() => {
        if (!isLoaded || !map) return;
        const markers = clusterMarkersRef.current;

        ensureClusterMarkerStyles();

        const clusterProperties =
            pieEnabled && pieOptions
                ? Object.fromEntries(
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
                )
                : undefined;

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
            // Capa hit invisible para hover/cursor; opacidad 0 para no competir
            // visualmente con el pie marker HTML.
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
            try {
                for (const entry of markers.values()) removeMarkerEntry(entry);
                markers.clear();
            } catch {
                // ignore
            }
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

    // Update data (non-URL) when it changes
    useEffect(() => {
        if (!isLoaded || !map || typeof data === "string") return;
        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
        source?.setData(data);
    }, [isLoaded, map, data, sourceId]);

    // Actualizar pintura de capas cuando cambien colores/thresholds/pointColor.
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

    // Render pie HTML markers on top of the hit layer
    useEffect(() => {
        if (!isLoaded || !map || !pieEnabled) return;

        const markers = clusterMarkersRef.current;

        const clearMarkers = () => {
            for (const entry of markers.values()) removeMarkerEntry(entry);
            markers.clear();
        };

        const createClusterClickHandler = (
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
                    return {
                        clusterId,
                        pointCount,
                        coordinates,
                        segments: segmentsWithPercent,
                    };
                });

                try {
                    const zoom = await source.getClusterExpansionZoom(clusterId);
                    if (map.getZoom() >= zoom - 0.1) {
                        map.easeTo({ center: coordinates, zoom, duration: 500 });
                    } else {
                        map.easeTo({ center: coordinates, duration: 400 });
                    }
                } catch {
                    map.easeTo({ center: coordinates, duration: 400 });
                }
            };
        };

        const renderPieMarkers = () => {
            if (!map.getSource(sourceId)) return;
            if (!map.getLayer(clusterHitLayerId)) return;

            const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
            const mapCenter = map.getCenter();
            const rendered = map.queryRenderedFeatures({
                layers: [clusterHitLayerId],
            });
            const features = rendered.filter((feature) => feature.properties?.cluster);

            if (!features.length) {
                clearMarkers();
                return;
            }

            const candidates = new globalThis.Map<
                number,
                { feature: MapLibreGL.MapGeoJSONFeature; score: number }
            >();

            for (const feature of features) {
                const props = feature.properties;
                if (!props?.cluster) continue;

                const clusterId = Number(props.cluster_id);
                if (!Number.isFinite(clusterId)) continue;

                const rawCoordinates = (feature.geometry as GeoJSON.Point)
                    .coordinates as [number, number];
                if (!rawCoordinates || rawCoordinates.length < 2) continue;

                const wrappedLng = wrapLongitudeForView(
                    rawCoordinates[0],
                    mapCenter.lng,
                );
                const score =
                    Math.abs(wrappedLng - mapCenter.lng) +
                    Math.abs(rawCoordinates[1] - mapCenter.lat);

                const existing = candidates.get(clusterId);
                if (!existing || score < existing.score) {
                    candidates.set(clusterId, {
                        feature: feature as MapLibreGL.MapGeoJSONFeature,
                        score,
                    });
                }
            }

            const nextClusterIds = new Set<number>();

            for (const [clusterId, candidate] of candidates) {
                const feature = candidate.feature;
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
                    .filter((segment) => segment.count > 0);

                const normalizedSegments =
                    segments.length > 0
                        ? segments.map((segment) => ({ ...segment, label: segment.category }))
                        : [
                            {
                                category: "default",
                                color: pointColor,
                                count: pointCount,
                                label: "Sin categoría",
                            },
                        ];

                const segmentsWithPercent: ClusterPieSegment[] =
                    normalizedSegments.map((segment) => ({
                        category: segment.category,
                        color: segment.color,
                        count: segment.count,
                        percent: segmentPercent(segment.count, pointCount),
                    }));

                const rawCoordinates = (feature.geometry as GeoJSON.Point)
                    .coordinates as [number, number];
                const coordinates: [number, number] = [
                    wrapLongitudeForView(rawCoordinates[0], mapCenter.lng),
                    rawCoordinates[1],
                ];

                const markerSignature = JSON.stringify({
                    pointCount,
                    radius: Math.round(radius * 10) / 10,
                    showPercent: pieOptions?.showDominantPercent ?? true,
                    segments: normalizedSegments.map((segment) => ({
                        category: segment.category,
                        count: segment.count,
                        color: segment.color,
                    })),
                });

                const clickHandler = createClusterClickHandler(
                    clusterId,
                    coordinates,
                    pointCount,
                    segmentsWithPercent,
                    source,
                );

                const existingMarker = markers.get(clusterId);
                if (existingMarker) {
                    if (existingMarker.signature !== markerSignature) {
                        existingMarker.root.render(
                            <div className="mapcn-pie-cluster-marker-inner">
                                <ClusterPieMarkerChart
                                    radius={radius}
                                    total={pointCount}
                                    showPercent={pieOptions?.showDominantPercent ?? true}
                                    segments={normalizedSegments}
                                />
                            </div>,
                        );
                        existingMarker.signature = markerSignature;
                    }
                    existingMarker.element.removeEventListener(
                        "click",
                        existingMarker.onClick,
                    );
                    existingMarker.element.addEventListener("click", clickHandler);
                    existingMarker.onClick = clickHandler;
                    existingMarker.marker.setLngLat(coordinates);
                    continue;
                }

                const markerElement = document.createElement("div");
                markerElement.setAttribute("role", "button");
                markerElement.setAttribute("tabindex", "0");
                markerElement.className = "mapcn-pie-cluster-marker";
                markerElement.style.width = `${size}px`;
                markerElement.style.height = `${size}px`;
                const root = createRoot(markerElement);
                root.render(
                    <div className="mapcn-pie-cluster-marker-inner">
                        <ClusterPieMarkerChart
                            radius={radius}
                            total={pointCount}
                            showPercent={pieOptions?.showDominantPercent ?? true}
                            segments={normalizedSegments}
                        />
                    </div>,
                );
                markerElement.addEventListener("click", clickHandler);

                const marker = new MapLibreGL.Marker({
                    element: markerElement,
                    anchor: "center",
                })
                    .setLngLat(coordinates)
                    .addTo(map);

                markers.set(clusterId, {
                    marker,
                    element: markerElement,
                    root,
                    onClick: clickHandler,
                    signature: markerSignature,
                });
            }

            for (const [clusterId, entry] of markers) {
                if (nextClusterIds.has(clusterId)) continue;
                removeMarkerEntry(entry);
                markers.delete(clusterId);
            }
        };

        const handleMove = () => renderPieMarkers();
        const handleData = (event: MapLibreGL.MapSourceDataEvent) => {
            if (event.sourceId !== sourceId) return;
            if (!event.isSourceLoaded) return;
            renderPieMarkers();
        };
        const handleIdle = () => renderPieMarkers();

        map.on("moveend", handleMove);
        map.on("zoomend", handleMove);
        map.on("sourcedata", handleData);
        map.on("idle", handleIdle);

        renderPieMarkers();

        return () => {
            map.off("moveend", handleMove);
            map.off("zoomend", handleMove);
            map.off("sourcedata", handleData);
            map.off("idle", handleIdle);
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

    // Coverage overlay (hull per cluster)
    useEffect(() => {
        if (!isLoaded || !map || !coverageEnabled || !pieOptions) return;

        const source = map.getSource(sourceId) as
            | MapLibreGL.GeoJSONSource
            | undefined;
        const coverageSource = map.getSource(coverageSourceId) as
            | MapLibreGL.GeoJSONSource
            | undefined;
        if (!source || !coverageSource) return;

        let cancelled = false;
        const maxLeaves =
            coverageOverlayOptions?.maxLeavesPerCluster ??
            CLUSTER_DEFAULTS.coverageMaxLeaves;

        const getClusterLeaves = (clusterId: number) =>
            source.getClusterLeaves(
                clusterId,
                maxLeaves,
                0,
            ) as Promise<MapLibreGL.MapGeoJSONFeature[]>;

        const refreshCoverage = async () => {
            if (!map.getSource(sourceId) || !map.getSource(coverageSourceId)) return;

            const clusterFeatures = map
                .querySourceFeatures(sourceId)
                .filter((feature) => feature.properties?.cluster);

            const uniqueClusterIds = new Set<number>();
            const overlays: GeoJSON.Feature<
                GeoJSON.Polygon,
                { overlayColor: string }
            >[] = [];

            for (const clusterFeature of clusterFeatures) {
                const clusterId = Number(clusterFeature.properties?.cluster_id ?? NaN);
                const pointCount = Number(clusterFeature.properties?.point_count ?? 0);
                if (
                    !Number.isFinite(clusterId) ||
                    pointCount < 3 ||
                    uniqueClusterIds.has(clusterId)
                )
                    continue;
                uniqueClusterIds.add(clusterId);

                let leaves: MapLibreGL.MapGeoJSONFeature[] = [];
                try {
                    leaves = await getClusterLeaves(clusterId);
                } catch {
                    continue;
                }

                if (cancelled || leaves.length < 3) continue;

                const points = leaves
                    .map(
                        (leaf) =>
                            (leaf.geometry as GeoJSON.Point).coordinates as [number, number],
                    )
                    .filter((coords) => Array.isArray(coords) && coords.length === 2);
                if (points.length < 3) continue;

                const categoryCounts = new globalThis.Map<string, number>();
                for (const leaf of leaves) {
                    const category = String(
                        leaf.properties?.[pieOptions.categoryProperty] ?? "",
                    ).trim();
                    if (!category) continue;
                    categoryCounts.set(
                        category,
                        (categoryCounts.get(category) ?? 0) + 1,
                    );
                }

                let dominantCategory = "";
                let dominantCount = -1;
                for (const [category, count] of categoryCounts) {
                    if (count > dominantCount) {
                        dominantCategory = category;
                        dominantCount = count;
                    }
                }

                const dominantColor =
                    pieOptions.categoryColors[dominantCategory] ??
                    String(
                        leaves[0]?.properties?.[pieOptions.colorProperty] ?? pointColor,
                    );

                const hull = buildConvexHull(points);
                if (hull.length < 3) continue;

                const first = hull[0];
                const ring = first ? [...hull, first] : hull;

                overlays.push({
                    type: "Feature",
                    properties: { overlayColor: dominantColor },
                    geometry: { type: "Polygon", coordinates: [ring] },
                });
            }

            if (!cancelled) {
                coverageSource.setData({
                    type: "FeatureCollection",
                    features: overlays,
                });
            }
        };

        const handleRefresh = () => {
            void refreshCoverage();
        };

        map.on("moveend", handleRefresh);
        map.on("zoomend", handleRefresh);
        map.on("sourcedata", handleRefresh);

        handleRefresh();

        return () => {
            cancelled = true;
            map.off("moveend", handleRefresh);
            map.off("zoomend", handleRefresh);
            map.off("sourcedata", handleRefresh);
        };
    }, [
        isLoaded,
        map,
        coverageEnabled,
        coverageOverlayOptions?.maxLeavesPerCluster,
        sourceId,
        coverageSourceId,
        pieOptions,
        pointColor,
    ]);

    // Click handlers (non-pie clusters + unclustered points)
    useEffect(() => {
        if (!isLoaded || !map) return;

        const handleClusterClick = async (
            e: MapLibreGL.MapMouseEvent & {
                features?: MapLibreGL.MapGeoJSONFeature[];
            },
        ) => {
            const features = map.queryRenderedFeatures(e.point, {
                layers: [clusterLayerId],
            });
            if (!features.length) return;
            const feature = features[0];
            if (!feature) return;
            const clusterId = feature.properties?.cluster_id as number;
            const pointCount = feature.properties?.point_count as number;
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [
                number,
                number,
            ];

            if (onClusterClick) {
                onClusterClick(clusterId, coordinates, pointCount);
            } else {
                const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
                const zoom = await source.getClusterExpansionZoom(clusterId);
                map.easeTo({ center: coordinates, zoom });
            }
        };

        const handlePointClick = (
            e: MapLibreGL.MapMouseEvent & {
                features?: MapLibreGL.MapGeoJSONFeature[];
            },
        ) => {
            const feature = e.features?.[0];
            if (!onPointClick || !feature) return;
            const coordinates = unwrapPointCoords(
                feature as unknown as GeoJSON.Feature<GeoJSON.Point>,
                e.lngLat.lng,
            );
            onPointClick(
                feature as unknown as GeoJSON.Feature<GeoJSON.Point, P>,
                coordinates,
            );
        };

        const updateHoveredPoint = (
            e: MapLibreGL.MapMouseEvent & {
                features?: MapLibreGL.MapGeoJSONFeature[];
            },
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
                    feature: feature as unknown as GeoJSON.Feature<
                        GeoJSON.Point,
                        P
                    >,
                    coordinates,
                };
            });
        };

        const clearHoveredPoint = () => setHoveredPoint(null);
        const clearHoveredPointOnMapInteraction = () => setHoveredPoint(null);

        const setCursor = (value: string) => {
            map.getCanvas().style.cursor = value;
        };
        const handleMouseEnterCluster = () => setCursor("pointer");
        const handleMouseLeaveCluster = () => setCursor("");
        const handleMouseEnterPoint = () => {
            if (onPointClick) setCursor("pointer");
        };
        const handleMouseLeavePoint = () => {
            setCursor("");
            clearHoveredPoint();
        };

        // Registra pares on/off. El cleanup recorre la lista en orden inverso.
        const bindings: Array<() => void> = [];
        const bind = <T extends keyof MapLibreGL.MapLayerEventType>(
            type: T,
            layerId: string,
            handler: (e: MapLibreGL.MapLayerEventType[T]) => void,
        ) => {
            map.on(type, layerId, handler as never);
            bindings.push(() => map.off(type, layerId, handler as never));
        };

        if (!pieEnabled) {
            bind("click", clusterLayerId, handleClusterClick);
            bind("mouseenter", clusterLayerId, handleMouseEnterCluster);
            bind("mouseleave", clusterLayerId, handleMouseLeaveCluster);
        } else if (map.getLayer(clusterHitLayerId)) {
            bind("mouseenter", clusterHitLayerId, handleMouseEnterCluster);
            bind("mouseleave", clusterHitLayerId, handleMouseLeaveCluster);
        }

        bind("click", unclusteredLayerId, handlePointClick);
        bind("mouseenter", unclusteredLayerId, handleMouseEnterPoint);
        bind("mouseleave", unclusteredLayerId, handleMouseLeavePoint);
        if (renderPointTooltip) {
            bind("mouseenter", unclusteredLayerId, updateHoveredPoint);
            bind("mousemove", unclusteredLayerId, updateHoveredPoint);
        }

        map.on("click", clearHoveredPointOnMapInteraction);
        map.on("touchstart", clearHoveredPointOnMapInteraction);
        map.on("movestart", clearHoveredPointOnMapInteraction);
        map.on("zoomstart", clearHoveredPointOnMapInteraction);

        return () => {
            map.off("click", clearHoveredPointOnMapInteraction);
            map.off("touchstart", clearHoveredPointOnMapInteraction);
            map.off("movestart", clearHoveredPointOnMapInteraction);
            map.off("zoomstart", clearHoveredPointOnMapInteraction);
            for (let i = bindings.length - 1; i >= 0; i -= 1) bindings[i]!();
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

export { MapClusterLayer };
export type { MapClusterLayerProps };
