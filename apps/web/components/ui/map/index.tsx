"use client";

/**
 * Paquete `ui/map`: wrappers declarativos sobre MapLibre GL.
 *
 * Estructura:
 *  - `core.tsx`      · Componente `Map`, `useMap`, contexto y tipos base.
 *  - `popup.tsx`     · `MapPopup` controlado + `PopupCloseButton`.
 *  - `marker.tsx`    · `MapMarker` + subcomponentes (Content/Popup/Tooltip/Label).
 *  - `controls.tsx`  · `MapControls` (zoom, compass, locate, fullscreen, satellite).
 *  - `route.tsx`     · `MapRoute` (LineString) + `MapPolygon` (relleno + contorno).
 *  - `arc.tsx`       · `MapArc` (líneas curvas Bézier cuadráticas).
 *  - `cluster.tsx`   · `MapClusterLayer` con soporte de pie-markers y coverage hull.
 *  - `constants.ts`  · Colores y defaults compartidos (no exportados).
 *  - `utils.ts`      · Helpers internos (convex hull, safe remove, wrap lng).
 */

// ── Core ────────────────────────────────────────────────────────────────────
export { Map, useMap, MapContext } from "./core";
export type {
  MapRef,
  MapViewport,
  MapStyleOption,
  MapProps,
  Theme,
} from "./core";

// ── Popups ──────────────────────────────────────────────────────────────────
export { MapPopup, PopupCloseButton } from "./popup";

// ── Markers ─────────────────────────────────────────────────────────────────
export {
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MarkerLabel,
} from "./marker";

// ── Controles ───────────────────────────────────────────────────────────────
export { MapControls } from "./controls";

// ── Capas declarativas ──────────────────────────────────────────────────────
export { MapPolygon, MapRoute } from "./route";
export type { MapPolygonProps, MapRouteProps } from "./route";

export { MapArc } from "./arc";
export type { MapArcDatum, MapArcEvent } from "./arc";

export { MapClusterLayer } from "./cluster";
export type { MapClusterLayerProps } from "./cluster";
