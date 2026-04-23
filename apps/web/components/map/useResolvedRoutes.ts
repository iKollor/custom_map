import { useEffect, useRef, useState } from 'react'

import type { ParsedFeature } from './editor'
import type { ResolvedRouteState } from './map-client-types'

type PendingRoute = {
    id: string
    signature: string
    coordinates: [number, number][]
}

type RouteProvider = {
    name: string
    fetch: (coords: [number, number][], signal: AbortSignal) => Promise<[number, number][] | null>
}

const REQUEST_TIMEOUT_MS = 8000

// Combine external abort signal with a timeout
function withTimeout(signal: AbortSignal, ms: number) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), ms)
    const onExternalAbort = () => controller.abort()
    signal.addEventListener('abort', onExternalAbort)
    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timeoutId)
            signal.removeEventListener('abort', onExternalAbort)
        },
    }
}

function decodePolyline(str: string, precision = 5): [number, number][] {
    const factor = Math.pow(10, precision)
    const coordinates: [number, number][] = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < str.length) {
        let result = 0
        let shift = 0
        let byte: number
        do {
            byte = str.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
        lat += deltaLat

        result = 0
        shift = 0
        do {
            byte = str.charCodeAt(index++) - 63
            result |= (byte & 0x1f) << shift
            shift += 5
        } while (byte >= 0x20)
        const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
        lng += deltaLng

        coordinates.push([lng / factor, lat / factor])
    }

    return coordinates
}

// Provider 1: OSRM public demo server
async function fetchOsrmPublic(
    coordinates: [number, number][],
    signal: AbortSignal,
): Promise<[number, number][] | null> {
    const waypoints = coordinates
        .slice(0, 25)
        .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
        .join(';')

    const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as {
        code?: string
        routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>
    }
    const coords = payload.routes?.[0]?.geometry?.coordinates
    return coords && coords.length > 0 ? coords : null
}

// Provider 2: FOSSGIS OSRM mirror
async function fetchOsrmFossgis(
    coordinates: [number, number][],
    signal: AbortSignal,
): Promise<[number, number][] | null> {
    const waypoints = coordinates
        .slice(0, 25)
        .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
        .join(';')

    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as {
        code?: string
        routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>
    }
    const coords = payload.routes?.[0]?.geometry?.coordinates
    return coords && coords.length > 0 ? coords : null
}

// Provider 3: Valhalla FOSSGIS
async function fetchValhallaFossgis(
    coordinates: [number, number][],
    signal: AbortSignal,
): Promise<[number, number][] | null> {
    const locations = coordinates.slice(0, 25).map(([lng, lat]) => ({ lon: lng, lat }))

    const response = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            locations,
            costing: 'auto',
            directions_options: { units: 'kilometers' },
        }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as {
        trip?: { legs?: Array<{ shape?: string }> }
    }

    const legs = payload.trip?.legs
    if (!legs || !legs.length) return null

    const combined: [number, number][] = []
    for (const leg of legs) {
        if (!leg.shape) continue
        // Valhalla uses precision 6 for polyline encoding
        const decoded = decodePolyline(leg.shape, 6)
        if (combined.length && decoded.length) decoded.shift() // avoid duplicate join point
        combined.push(...decoded)
    }

    return combined.length > 0 ? combined : null
}

const ROUTE_PROVIDERS: RouteProvider[] = [
    { name: 'valhalla-fossgis', fetch: fetchValhallaFossgis },
    { name: 'osrm-fossgis', fetch: fetchOsrmFossgis },
    { name: 'osrm-public', fetch: fetchOsrmPublic },
]

async function resolveRouteWithFallback(
    coordinates: [number, number][],
    signal: AbortSignal,
): Promise<[number, number][] | null> {
    for (const provider of ROUTE_PROVIDERS) {
        if (signal.aborted) return null
        const { signal: providerSignal, cleanup } = withTimeout(signal, REQUEST_TIMEOUT_MS)
        try {
            console.debug(`[useResolvedRoutes] trying provider: ${provider.name}`)
            const result = await provider.fetch(coordinates, providerSignal)
            if (result && result.length > 0) {
                console.debug(`[useResolvedRoutes] ✓ ${provider.name} returned ${result.length} points`)
                return result
            }
            console.debug(`[useResolvedRoutes] ✗ ${provider.name} returned empty`)
        } catch (error) {
            const name = (error as Error)?.name
            if (signal.aborted) return null // outer cancellation
            if (name === 'AbortError') {
                console.warn(`[useResolvedRoutes] ✗ ${provider.name} timed out after ${REQUEST_TIMEOUT_MS}ms`)
            } else {
                console.warn(`[useResolvedRoutes] ✗ ${provider.name} failed:`, (error as Error)?.message ?? error)
            }
        } finally {
            cleanup()
        }
    }
    return null
}

export function useResolvedRoutes(routeFeatures: ParsedFeature[]) {
    const [resolvedRoutes, setResolvedRoutes] = useState<ResolvedRouteState>({})
    const [routingIds, setRoutingIds] = useState<Set<string>>(new Set())
    // Use ref to read latest resolvedRoutes inside effect without retriggering it
    const resolvedRoutesRef = useRef<ResolvedRouteState>({})
    resolvedRoutesRef.current = resolvedRoutes

    // Stable signature key from route features to avoid re-triggering on reference changes
    const featuresSignature = routeFeatures
        .map((feature) => `${feature._id}::${feature.coordinates}`)
        .join('|')

    useEffect(() => {
        const pendingRoutes: PendingRoute[] = routeFeatures
            .filter(
                (feature) =>
                    resolvedRoutesRef.current[feature._id]?.signature !== feature.coordinates &&
                    Array.isArray(feature._coords) &&
                    Array.isArray((feature._coords as [number, number][])[0]),
            )
            .map((feature) => ({
                id: feature._id,
                signature: feature.coordinates,
                coordinates: feature._coords as [number, number][],
            }))

        if (!pendingRoutes.length) return

        const controller = new AbortController()
        let active = true

        setRoutingIds((prev) => {
            const next = new Set(prev)
            pendingRoutes.forEach((route) => next.add(route.id))
            return next
        })

        void Promise.all(
            pendingRoutes.map(async (route) => {
                const resolved = await resolveRouteWithFallback(route.coordinates, controller.signal)
                return {
                    id: route.id,
                    signature: route.signature,
                    coordinates: resolved ?? route.coordinates,
                }
            }),
        ).then((results) => {
            if (!active) return

            setResolvedRoutes((prev) => {
                const next = { ...prev }
                for (const result of results) {
                    next[result.id] = {
                        signature: result.signature,
                        coordinates: result.coordinates,
                    }
                }
                return next
            })

            setRoutingIds((prev) => {
                const next = new Set(prev)
                pendingRoutes.forEach((route) => next.delete(route.id))
                return next
            })
        })

        return () => {
            active = false
            controller.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [featuresSignature])

    return {
        resolvedRoutes,
        routingIds,
    }
}