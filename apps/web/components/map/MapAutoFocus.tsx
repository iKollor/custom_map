'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useMap } from '@/components/ui/map'
import type { ParsedFeature } from './editor'
import type { ResolvedRouteState } from './map-client-types'
import { getBoundsFromCoordinates, getRenderableCoordinates } from './map-client-utils'

const FOCUS_CONFIG = {
    // Zoom objetivo al hacer foco en un solo punto. Lo suficientemente cerca
    // para ver el contexto inmediato sin perder orientacion.
    singlePointZoom: 16,
    // Zoom minimo al enfocar un cluster pequeño / ruta corta para que se aprecie.
    multiFeatureMinZoom: 14,
    transitionDuration: 900,
    fitBoundsDuration: 1100,
    fitBoundsPadding: { top: 110, right: 360, bottom: 90, left: 70 },
    fitBoundsMaxZoom: 16,
} as const

type MapAutoFocusProps = {
    features: ParsedFeature[]
    resolvedRoutes: ResolvedRouteState
    selectedFeatureId: string | null
    editMode: boolean
    /**
     * Identificador del contexto (p.ej. proyecto activo) para reiniciar el
     * "fit inicial" al cambiar de contexto. Cuando es el mismo, agregar o
     * eliminar features NO provoca un nuevo fitBounds (evita el zoom-out
     * incomodo al editar).
     */
    contextKey?: string
}

export function MapAutoFocus({
    features,
    resolvedRoutes,
    selectedFeatureId,
    editMode,
    contextKey,
}: MapAutoFocusProps) {
    const { map, isLoaded } = useMap()
    const lastSelectionKeyRef = useRef<string>('')
    const initialFitContextRef = useRef<string | null>(null)

    // --- Fly-to / fitBounds al SELECCIONAR un feature -----------------------
    const selectedFeature = useMemo(
        () => (selectedFeatureId ? features.find((f) => f._id === selectedFeatureId) ?? null : null),
        [features, selectedFeatureId],
    )

    const selectionKey = useMemo(() => {
        if (!selectedFeature) return ''
        const sig = resolvedRoutes[selectedFeature._id]?.signature ?? selectedFeature.coordinates
        return `${selectedFeature._id}:${sig}`
    }, [selectedFeature, resolvedRoutes])

    useEffect(() => {
        if (!map || !isLoaded) return
        if (!selectionKey) {
            // Sin seleccion: limpia la key para que volver a clickear el mismo
            // feature dispare el fly-to nuevamente.
            lastSelectionKeyRef.current = ''
            return
        }
        if (lastSelectionKeyRef.current === selectionKey) return
        if (!selectedFeature) return

        const points = getRenderableCoordinates(selectedFeature, resolvedRoutes)
        if (!points.length) return

        lastSelectionKeyRef.current = selectionKey

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
    }, [editMode, isLoaded, map, resolvedRoutes, selectedFeature, selectionKey])

    // --- Fit inicial al cargar el contexto (solo una vez por contextKey) ----
    useEffect(() => {
        if (!map || !isLoaded) return
        if (selectedFeatureId) return // si hay seleccion, manda el otro effect
        if (!features.length) return

        const key = contextKey ?? '__default__'
        if (initialFitContextRef.current === key) return

        const points = features.flatMap((feature) => getRenderableCoordinates(feature, resolvedRoutes))
        if (!points.length) return

        initialFitContextRef.current = key

        if (points.length === 1) {
            const [lng, lat] = points[0] ?? [0, 0]
            map.flyTo({
                center: [lng, lat],
                zoom: Math.max(map.getZoom(), FOCUS_CONFIG.multiFeatureMinZoom),
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
    }, [contextKey, editMode, features, isLoaded, map, resolvedRoutes, selectedFeatureId])

    return null
}
