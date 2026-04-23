/**
 * Utilidades internas compartidas por los componentes del paquete `ui/map`.
 * No se re-exportan desde `index.tsx` para mantener la API pública estable.
 */

/** Producto cruzado 2D (z del cross product). */
function cross(
    origin: [number, number],
    a: [number, number],
    b: [number, number],
): number {
    return (
        (a[0] - origin[0]) * (b[1] - origin[1]) -
        (a[1] - origin[1]) * (b[0] - origin[0])
    );
}

/**
 * Construye el casco convexo (convex hull) de un conjunto de puntos 2D
 * usando el algoritmo "Andrew's monotone chain". Devuelve los puntos en
 * orden antihorario (sin repetir el primero al final).
 */
export function buildConvexHull(points: [number, number][]): [number, number][] {
    if (points.length <= 3) return points;

    const sorted = [...points].sort((a, b) =>
        a[0] === b[0] ? a[1] - b[1] : a[0] - b[0],
    );

    const lower: [number, number][] = [];
    for (const p of sorted) {
        while (
            lower.length >= 2 &&
            cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
        ) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: [number, number][] = [];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const p = sorted[i]!;
        while (
            upper.length >= 2 &&
            cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
        ) {
            upper.pop();
        }
        upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

/**
 * Normaliza una longitud para que quede dentro de ±180° respecto al centro
 * actual del mapa (evita saltos al cruzar el antimeridiano).
 */
export function wrapLongitudeForView(
    longitude: number,
    centerLongitude: number,
): number {
    let wrapped = longitude;
    while (wrapped - centerLongitude > 180) wrapped -= 360;
    while (wrapped - centerLongitude < -180) wrapped += 360;
    return wrapped;
}

/**
 * Remueve de forma segura una capa/fuente de MapLibre si existe.
 * Silencia errores (capas pueden desaparecer durante cleanup por cambios de estilo).
 */
export function safeRemoveLayer(
    map: { getLayer: (id: string) => unknown; removeLayer: (id: string) => void },
    layerId: string,
) {
    try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
        // ignore
    }
}

export function safeRemoveSource(
    map: {
        getSource: (id: string) => unknown;
        removeSource: (id: string) => void;
    },
    sourceId: string,
) {
    try {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
        // ignore
    }
}
