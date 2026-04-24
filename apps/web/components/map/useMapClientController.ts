'use client'

import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StyleSpecification } from 'maplibre-gl'

import { useMapEditor } from './editor'
import type { ContextMenuState } from './map-client-types'
import { buildMapFeatureCollection } from './map-client-utils'
import { useResolvedRoutes } from './useResolvedRoutes'

const SATELLITE_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        satellite: {
            type: 'raster',
            tiles: [
                process.env.NEXT_PUBLIC_MAP_SATELLITE_TILES ??
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution:
                process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION ??
                'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        },
    },
    layers: [
        {
            id: 'satellite-base',
            type: 'raster',
            source: 'satellite',
        },
    ],
}

// Hook for project dialog management
function useProjectDialog(editor: ReturnType<typeof useMapEditor>) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')

    const submit = useCallback(() => {
        const created = editor.createNewProject(name)
        if (!created) return
        setName('')
        setOpen(false)
    }, [editor, name])

    return { open, setOpen, name, setName, submit }
}

export function useMapClientController() {
    const router = useRouter()
    const editor = useMapEditor()
    const projectDialog = useProjectDialog(editor)

    const [infoPanelFeatureId, setInfoPanelFeatureId] = useState<string | null>(null)
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null)
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [isSatelliteView, setIsSatelliteView] = useState(false)

    const deferredVisibleFeatures = useDeferredValue(editor.visibleFeatures)
    const { pointFeatures, linearFeatures, routeFeatures, clusterData, summary } = useMemo(
        () => buildMapFeatureCollection({ features: deferredVisibleFeatures, categories: editor.categories }),
        [deferredVisibleFeatures, editor.categories],
    )
    const { resolvedRoutes, routingIds } = useResolvedRoutes(routeFeatures)

    const visibleFeatureIds = useMemo(
        () => new Set(deferredVisibleFeatures.map((feature) => feature._id)),
        [deferredVisibleFeatures],
    )

    const activeSelectedRouteId = selectedRouteId && visibleFeatureIds.has(selectedRouteId) ? selectedRouteId : null
    const activeInfoPanelFeatureId =
        infoPanelFeatureId && visibleFeatureIds.has(infoPanelFeatureId) ? infoPanelFeatureId : null
    const visibilityRatio = editor.features.length
        ? Math.max(8, (deferredVisibleFeatures.length / editor.features.length) * 100)
        : 0

    const defaultCenter = useMemo(
        () =>
            [
                parseFloat(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LNG ?? '-79.8891'),
                parseFloat(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LAT ?? '-2.1894'),
            ] as [number, number],
        [],
    )

    const defaultZoom = useMemo(() => parseFloat(process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? '12'), [])

    const mapStyles = useMemo(
        () =>
            isSatelliteView
                ? { light: SATELLITE_STYLE, dark: SATELLITE_STYLE }
                : {
                    light: process.env.NEXT_PUBLIC_MAP_STYLE,
                    dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? process.env.NEXT_PUBLIC_MAP_STYLE,
                },
        [isSatelliteView],
    )

    const handleLogout = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
        router.refresh()
    }, [router])

    const openFeatureInfo = useCallback((featureId: string | null) => {
        setInfoPanelFeatureId(featureId)
        if (featureId) {
            setContextMenuState(null)
        }
    }, [])

    const openContextMenu = useCallback((state: ContextMenuState) => {
        setContextMenuState(state)
    }, [])

    const closeContextMenu = useCallback(() => {
        setContextMenuState(null)
    }, [])

    const toggleSatelliteView = useCallback(() => {
        setIsSatelliteView((prev) => !prev)
    }, [])

    return {
        editor,
        projectDialog,
        selection: {
            activeInfoPanelFeatureId,
            activeSelectedRouteId,
            contextMenuState,
            setInfoPanelFeatureId,
            setSelectedRouteId,
            openFeatureInfo,
            openContextMenu,
            closeContextMenu,
        },
        derived: {
            deferredVisibleFeatures,
            pointFeatures,
            linearFeatures,
            clusterData,
            summary,
            visibilityRatio,
            resolvedRoutes,
            routingIds,
        },
        mapConfig: {
            defaultCenter,
            defaultZoom,
            mapStyles,
            isSatelliteView,
        },
        actions: {
            logout: handleLogout,
            toggleSatelliteView,
        },
    }
}