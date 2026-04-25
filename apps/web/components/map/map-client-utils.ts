import { categoryColorById, featureCategoryName, isLineCoordinates, isPointCoordinates, type ParsedFeature } from './editor'
import type { MapFeatureCollection, MapFeatureCollectionParams, ResolvedRouteState } from './map-client-types'

// Deduplication of coordinates to remove duplicates within tolerance
function dedupeCoordinates(points: [number, number][]) {
    const unique: [number, number][] = []
    const seen = new Set<string>()

    for (const [lng, lat] of points) {
        const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`
        if (seen.has(key)) continue
        seen.add(key)
        unique.push([lng, lat])
    }

    return unique
}

// Cross product for convex hull calculation
function cross(origin: [number, number], left: [number, number], right: [number, number]) {
    return (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0])
}

// Andrew's monotone chain algorithm for convex hull
function buildConvexHull(points: [number, number][]) {
    if (points.length <= 3) return points

    const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
    const lower: [number, number][] = []

    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
            lower.pop()
        }
        lower.push(point)
    }

    const upper: [number, number][] = []
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        const point = sorted[index]!
        while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
            upper.pop()
        }
        upper.push(point)
    }

    lower.pop()
    upper.pop()

    return [...lower, ...upper]
}

export function getSectionPolygonCoordinates(feature: ParsedFeature, resolvedRoutes: ResolvedRouteState): [number, number][] {
    if (feature.type !== 'section') return []

    const coordinates = dedupeCoordinates(getRenderableCoordinates(feature, resolvedRoutes))
    if (coordinates.length < 3) return []

    const first = coordinates[0]
    const last = coordinates[coordinates.length - 1]
    const isClosed = !!first && !!last && first[0] === last[0] && first[1] === last[1]
    const normalized = isClosed ? coordinates.slice(0, -1) : coordinates
    const hull = buildConvexHull(normalized)

    if (hull.length < 3) return []

    const start = hull[0]
    return start ? [...hull, start] : hull
}

export function getRenderableCoordinates(feature: ParsedFeature, resolvedRoutes: ResolvedRouteState): [number, number][] {
    if (feature.type === 'point') {
        return isPointCoordinates(feature._coords) ? [feature._coords] : []
    }

    if (!isLineCoordinates(feature._coords)) return []

    if (feature.type === 'route') {
        return resolvedRoutes[feature._id]?.coordinates ?? feature._coords
    }

    return feature._coords
}

export function getBoundsFromCoordinates(points: [number, number][]): [[number, number], [number, number]] | null {
    if (!points.length) return null

    let minLng = points[0]?.[0] ?? 0
    let maxLng = minLng
    let minLat = points[0]?.[1] ?? 0
    let maxLat = minLat

    for (const [lng, lat] of points) {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ]
}

export function sortLinearFeatures(features: ParsedFeature[], selectedRouteId: string | null) {
    return [...features].sort((left, right) => {
        if (left._id === selectedRouteId) return 1
        if (right._id === selectedRouteId) return -1
        if (left.type === right.type) return 0
        return left.type === 'section' ? -1 : 1
    })
}

export function buildMapFeatureCollection({ features, categories }: MapFeatureCollectionParams): MapFeatureCollection {
    const pointFeatures = features.filter(
        (feature) => feature.type === 'point' && isPointCoordinates(feature._coords),
    )

    const linearFeatures = features.filter(
        (feature) =>
            (feature.type === 'route' || feature.type === 'section') &&
            isLineCoordinates(feature._coords) &&
            feature._coords.length >= 2,
    )

    const routeFeatures = linearFeatures.filter((feature) => feature.type === 'route')

    return {
        pointFeatures,
        linearFeatures,
        routeFeatures,
        clusterData: {
            type: 'FeatureCollection',
            features: pointFeatures.map((feature) => {
                const [lng, lat] = feature._coords as [number, number]
                return {
                    type: 'Feature',
                    properties: {
                        id: feature._id,
                        name: feature.name,
                        category: featureCategoryName(feature, categories),
                        description: feature.description,
                        color: categoryColorById(feature.categoryId, categories),
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                }
            }),
        },
        summary: {
            points: pointFeatures.length,
            routes: routeFeatures.length,
            sections: linearFeatures.length - routeFeatures.length,
        },
    }
}