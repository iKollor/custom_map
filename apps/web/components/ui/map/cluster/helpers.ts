"use client";

import MapLibreGL from "maplibre-gl";

import type { ChartConfig } from "@workspace/ui/components/chart";

import type { ClusterMarkerEntry } from "./types";

// ============================================================================
// Helpers
// ============================================================================

export function toCategoryCountKey(category: string) {
    return `cat_${category.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

/** Devuelve el porcentaje entero (mínimo 1) del segmento respecto del total. */
export function segmentPercent(count: number, total: number) {
    return Math.max(1, Math.round((count / Math.max(1, total)) * 100));
}

/** Construye un `ChartConfig` a partir de los segmentos (label → color). */
export function chartConfigFromSegments(
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
export function stepExpression(
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
export function unwrapPointCoords(
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
export function getFeatureId(f: {
    id?: string | number;
    properties?: unknown;
}): string | number | undefined {
    const props = f.properties as { id?: string | number } | null | undefined;
    return f.id ?? props?.id;
}

/** Desmonta completamente una entrada de marker (listener + root + marker). */
export function removeMarkerEntry(entry: ClusterMarkerEntry) {
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

export function ensureClusterMarkerStyles() {
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
