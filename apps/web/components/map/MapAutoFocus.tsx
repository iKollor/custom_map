'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useMap } from '@/components/ui/map'
import type { ParsedFeature } from './editor'
import type { ResolvedRouteState } from './map-client-types'
import { getBoundsFromCoordinates, getRenderableCoordinates } from './map-client-utils'

const FOCUS_CONFIG = {
    singlePointZoom: 14,
    transitionDuration: 1100,
    fitBoundsDuration: 1400,
    fitBoundsPadding: { top: 110, right: 360, bottom: 90, left: 70 },
    fitBoundsMaxZoom: 15,
} as const

type MapAutoFocusProps = {
    features: ParsedFeature[]
    resolvedRoutes: ResolvedRouteState
    selectedFeatureId: string | null
    editMode: boolean
}

export function MapAutoFocus({ features, resolvedRoutes, selectedFeatureId, editMode }: MapAutoFocusProps) {
    const { map, isLoaded } = useMap()
    const lastKeyRef = useRef('')

    const focusFeatures = useMemo(() => {
        if (!selectedFeatureId) return features
        return features.filter((feature) => feature._id === selectedFeatureId)
    }, [features, selectedFeatureId])

    const focusKey = useMemo(
        () =>
            focusFeatures
                .map((feature) => `${feature._id}:${resolvedRoutes[feature._id]?.signature ?? feature.coordinates}`)
                .join('|'),
        [focusFeatures, resolvedRoutes],
    )

    useEffect(() => {
        if (!map || !isLoaded || !focusKey) return
        if (lastKeyRef.current === focusKey) return

        const points = focusFeatures.flatMap((feature) => getRenderableCoordinates(feature, resolvedRoutes))
        if (!points.length) return

        lastKeyRef.current = focusKey

        if (points.length === 1) {
            const [lng, lat] = points[0] ?? [0, 0]
            map.flyTo({
                center: [lng, lat],
                zoom: Math.max(map.getZoom(), FOCUS_CONFIG.singlePointZoom),
                essential: true,
                duration: FOCUS_CONFIG.transitionDuration,
            })
            return
        }

        const bounds = getBoundsFromCoordinates(points)
        if (!bounds) return

        const rightPadding = editMode ? FOCUS_CONFIG.fitBoundsPadding.right : 70
        map.fitBounds(bounds, {
            duration: FOCUS_CONFIG.fitBoundsDuration,
            essential: true,
            padding: {
                ...FOCUS_CONFIG.fitBoundsPadding,
                right: rightPadding,
            },
            maxZoom: FOCUS_CONFIG.fitBoundsMaxZoom,
        })
    }, [editMode, focusFeatures, focusKey, isLoaded, map, resolvedRoutes])

    return null
}