'use client'

import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { StyleSpecification } from 'maplibre-gl'

import { MapProject, FeatureType } from './editor/types'
import { buildMapFeatureCollection } from './map-client-utils'
import { useResolvedRoutes } from './useResolvedRoutes'
import { buildCategoryIndex, getDescendantIds } from './editor/helpers'

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

export function useSharedMapClientController(project: MapProject) {
    const [infoPanelFeatureId, setInfoPanelFeatureId] = useState<string | null>(null)
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
    const [isSatelliteView, setIsSatelliteView] = useState(false)
    const [clusteringEnabled, setClusteringEnabled] = useState(true)

    const [filtersOpen, setFiltersOpen] = useState(false)
    
    // Filter states
    const [activeTypes, setActiveTypes] = useState<Set<FeatureType>>(new Set(['point', 'route', 'section']))
    const [activeCategories, setActiveCategories] = useState<Set<string>>(() => {
        const ids = new Set<string>()
        project.categories.forEach((c) => ids.add(c.id))
        return ids
    })
    
    const [forcedTooltipTypes, setForcedTooltipTypes] = useState<Set<string>>(new Set())
    const [forcedTooltipCategories, setForcedTooltipCategories] = useState<Set<string>>(new Set())

    const toggleType = useCallback((type: FeatureType) => {
        setActiveTypes((prev) => {
            const next = new Set(prev)
            next.has(type) ? next.delete(type) : next.add(type)
            return next
        })
    }, [])

    const toggleCategory = useCallback((category: string) => {
        setActiveCategories((prev) => {
            const next = new Set(prev)
            const index = buildCategoryIndex(project.categories)
            const toToggle = [category, ...getDescendantIds(category, index)]
            const isAdding = !next.has(category)

            for (const id of toToggle) {
                if (isAdding) next.add(id)
                else next.delete(id)
            }
            return next
        })
    }, [project.categories])

    const toggleForcedTooltipType = useCallback((type: string) => {
        setForcedTooltipTypes((prev) => {
            const next = new Set(prev)
            next.has(type) ? next.delete(type) : next.add(type)
            return next
        })
    }, [])

    const toggleForcedTooltipCategory = useCallback((category: string) => {
        setForcedTooltipCategories((prev) => {
            const next = new Set(prev)
            next.has(category) ? next.delete(category) : next.add(category)
            return next
        })
    }, [])

    const visibleFeatures = useMemo(
        () => project.features.filter((f) => activeTypes.has(f.type) && activeCategories.has(f.categoryId)),
        [project.features, activeTypes, activeCategories],
    )

    const deferredVisibleFeatures = useDeferredValue(visibleFeatures)
    
    const { pointFeatures, linearFeatures, routeFeatures, clusterData, summary } = useMemo(
        () => buildMapFeatureCollection({ features: deferredVisibleFeatures, categories: project.categories }),
        [deferredVisibleFeatures, project.categories],
    )
    
    const { resolvedRoutes, routingIds } = useResolvedRoutes(routeFeatures)

    const visibleFeatureIds = useMemo(
        () => new Set(deferredVisibleFeatures.map((feature) => feature._id)),
        [deferredVisibleFeatures],
    )

    const activeSelectedRouteId = selectedRouteId && visibleFeatureIds.has(selectedRouteId) ? selectedRouteId : null
    const activeInfoPanelFeatureId = infoPanelFeatureId && visibleFeatureIds.has(infoPanelFeatureId) ? infoPanelFeatureId : null
    const visibilityRatio = project.features.length
        ? Math.max(8, (deferredVisibleFeatures.length / project.features.length) * 100)
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

    return {
        state: {
            filtersOpen,
            activeTypes,
            activeCategories,
            forcedTooltipTypes,
            forcedTooltipCategories,
            isSatelliteView,
            clusteringEnabled,
        },
        selection: {
            activeInfoPanelFeatureId,
            activeSelectedRouteId,
            openFeatureInfo: setInfoPanelFeatureId,
            setSelectedRouteId,
        },
        derived: {
            deferredVisibleFeatures,
            pointFeatures,
            linearFeatures,
            routeFeatures,
            clusterData,
            summary,
            resolvedRoutes,
            routingIds,
            visibilityRatio,
        },
        mapConfig: {
            defaultCenter,
            defaultZoom,
            mapStyles,
            isSatelliteView,
            clusteringEnabled,
        },
        actions: {
            setFiltersOpen,
            toggleType,
            toggleCategory,
            toggleForcedTooltipType,
            toggleForcedTooltipCategory,
            toggleSatelliteView: () => setIsSatelliteView((prev) => !prev),
            toggleClustering: () => setClusteringEnabled((prev) => !prev),
        },
    }
}
