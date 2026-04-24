/**
 * Constantes compartidas para los componentes del paquete `ui/map`.
 * Centraliza colores del tema y valores por defecto para evitar duplicación
 * entre `arc.tsx`, `route.tsx` y `cluster.tsx`.
 */

/** Paleta base usada por overlays, clusters y rutas. */
export const MAP_COLORS = {
    primary: "#40A7F4",
    accent: "#6E00A3",
    accentDark: "#4A2D73",
    white: "#ffffff",
} as const;

/** Tema claro/oscuro por defecto (OpenFreeMap). */
export const DEFAULT_BASEMAPS = {
    dark: "https://tiles.openfreemap.org/styles/liberty",
    light: "https://tiles.openfreemap.org/styles/liberty",
} as const;

/** Defaults para `MapArc`. */
export const ARC_DEFAULTS = {
    curvature: 0.2,
    samples: 64,
    hitMinWidth: 12,
    hitPadding: 6,
} as const;

/** Defaults para `MapClusterLayer`. */
export const CLUSTER_DEFAULTS = {
    maxZoom: 14,
    radius: 50,
    colors: [MAP_COLORS.primary, MAP_COLORS.accent, MAP_COLORS.accentDark] as [
        string,
        string,
        string,
    ],
    thresholds: [100, 750] as [number, number],
    pieMinRadius: 18,
    pieMaxRadius: 33,
    coverageFillOpacity: 0.14,
    coverageOutlineOpacity: 0.42,
    coverageMaxLeaves: 64,
} as const;
