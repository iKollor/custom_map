'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature as GeoJsonFeature, Point as GeoJsonPoint } from 'geojson'

import {
    MapClusterLayer,
    MapMarker,
    MapPolygon,
    MapRoute,
    MarkerContent,
    MarkerLabel,
    MarkerTooltip,
} from '@/components/ui/map'
import { useReverseGeocode } from '@/hooks/useReverseGeocode'

import { THEME_COLORS, categoryColor, type CategoryDef, type ParsedFeature } from './editor'
import type { ClusterData, ResolvedRouteState } from './map-client-types'
import { getRenderableCoordinates, getSectionPolygonCoordinates, sortLinearFeatures } from './map-client-utils'

type FeatureTooltipProps = {
    feature: ParsedFeature
    coordinates: [number, number]
    categories: CategoryDef[]
}

function FeatureTooltip({ feature, coordinates, categories }: FeatureTooltipProps) {
    const { address, loading } = useReverseGeocode(coordinates[0], coordinates[1], feature.type === 'point')
    const swatchColor = categoryColor(feature.category, categories)
    const locationText = feature.type === 'point'
        ? loading
            ? 'Buscando dirección…'
            : (address ?? 'Dirección no disponible')
        : `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`

    return (
        <div className="min-w-40 max-w-60 space-y-1.5 text-left">
            <div className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: swatchColor }}
                />
                <p className="truncate text-[13px] font-semibold leading-tight">
                    {feature.name}
                </p>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {feature.category || 'Sin categoría'}
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground/90">
                {locationText}
            </p>
        </div>
    )
}

type MapFeatureLayersProps = {
    categories: CategoryDef[]
    clusterData: ClusterData
    editMode: boolean
    pointFeatures: ParsedFeature[]
    linearFeatures: ParsedFeature[]
    resolvedRoutes: ResolvedRouteState
    activeInfoPanelFeatureId: string | null
    activeSelectedRouteId: string | null
    onOpenFeatureInfoAction: (featureId: string | null) => void
    onSelectRouteAction: (routeId: string | null) => void
    onOpenContextMenuAction: (state: { featureId: string; coordinates: [number, number]; screenPosition: { x: number; y: number } }) => void
    onUpdateFeatureCoordinatesAction: (id: string, coords: [number, number][] | [number, number]) => void
    onDuplicatePointFeatureAction: (id: string, nextPoint: [number, number]) => string | null
}

const LONG_PRESS_DUPLICATE_MS = 420

// Route and section rendering
function RouteFeature({
    feature,
    coordinates,
    sectionPolygon,
    isSelected,
    color,
    categories,
    onSelectRouteAction,
    onOpenFeatureInfoAction,
    onOpenContextMenuAction,
}: {
    feature: ParsedFeature
    coordinates: [number, number][]
    sectionPolygon: [number, number][]
    isSelected: boolean
    color: string
    categories: CategoryDef[]
    onSelectRouteAction: (id: string) => void
    onOpenFeatureInfoAction: (id: string | null) => void
    onOpenContextMenuAction: (state: { featureId: string; coordinates: [number, number]; screenPosition: { x: number; y: number } }) => void
}) {
    return (
        <>
            {feature.type === 'section' && sectionPolygon.length >= 4 && (
                <MapPolygon
                    id={`section-fill-${feature._id}`}
                    coordinates={sectionPolygon}
                    fillColor={color}
                    fillOpacity={isSelected ? 0.26 : 0.16}
                    outlineColor={color}
                    outlineOpacity={isSelected ? 0.95 : 0.75}
                />
            )}

            <MapRoute
                id={feature._id}
                coordinates={feature.type === 'section' && sectionPolygon.length >= 4 ? sectionPolygon : coordinates}
                color={color}
                width={isSelected ? (feature.type === 'route' ? 6 : 4.6) : feature.type === 'route' ? 4.8 : 2.8}
                opacity={isSelected ? 1 : feature.type === 'route' ? 0.88 : 0.72}
                dashArray={feature.type === 'section' ? [3, 2] : undefined}
                onClick={() => {
                    onSelectRouteAction(feature._id)
                    onOpenFeatureInfoAction(feature._id)
                }}
                onContextMenu={(coords, screenPosition) => {
                    onSelectRouteAction(feature._id)
                    onOpenContextMenuAction({
                        featureId: feature._id,
                        coordinates: coords,
                        screenPosition,
                    })
                }}
            />
        </>
    )
}

export function MapFeatureLayers({
    categories,
    clusterData,
    editMode,
    pointFeatures,
    linearFeatures,
    resolvedRoutes,
    activeInfoPanelFeatureId,
    activeSelectedRouteId,
    onOpenFeatureInfoAction,
    onSelectRouteAction,
    onOpenContextMenuAction,
    onUpdateFeatureCoordinatesAction,
    onDuplicatePointFeatureAction,
}: MapFeatureLayersProps) {
    const [armedDuplicatePointId, setArmedDuplicatePointId] = useState<string | null>(null)
    const [dragDuplicatePointId, setDragDuplicatePointId] = useState<string | null>(null)
    const longPressTimerRef = useRef<number | null>(null)
    const longPressCandidateRef = useRef<string | null>(null)

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current === null) return
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
    }

    useEffect(() => {
        return () => clearLongPressTimer()
    }, [])

    const handlePointPointerDown = (featureId: string, event: PointerEvent) => {
        if (event.pointerType === 'mouse') {
            setArmedDuplicatePointId(event.ctrlKey ? featureId : null)
            return
        }

        if (event.pointerType !== 'touch') return

        setArmedDuplicatePointId(null)
        longPressCandidateRef.current = featureId
        clearLongPressTimer()

        longPressTimerRef.current = window.setTimeout(() => {
            if (longPressCandidateRef.current !== featureId) return
            setArmedDuplicatePointId(featureId)
        }, LONG_PRESS_DUPLICATE_MS)
    }

    const handlePointPointerRelease = (featureId: string) => {
        if (longPressCandidateRef.current === featureId) {
            longPressCandidateRef.current = null
        }
        clearLongPressTimer()

        setArmedDuplicatePointId((current) => {
            if (current !== featureId) return current
            return dragDuplicatePointId === featureId ? current : null
        })
    }

    const sortedLinearFeatures = useMemo(
        () => sortLinearFeatures(linearFeatures, activeSelectedRouteId),
        [activeSelectedRouteId, linearFeatures],
    )

    const selectedRouteCoordinates = useMemo(() => {
        const selectedRoute = sortedLinearFeatures.find((feature) => feature._id === activeSelectedRouteId)
        if (!selectedRoute || selectedRoute.type !== 'route') return []
        return getRenderableCoordinates(selectedRoute, resolvedRoutes)
    }, [activeSelectedRouteId, resolvedRoutes, sortedLinearFeatures])

    const clusterCategoryColors = useMemo(() => {
        const palette = new Map<string, string>()
        for (const category of categories) {
            palette.set(category.name, category.color)
        }
        for (const feature of clusterData.features) {
            const category = feature.properties?.category
            const color = feature.properties?.color
            if (!category || !color || palette.has(category)) continue
            palette.set(category, color)
        }
        return Object.fromEntries(palette.entries())
    }, [categories, clusterData.features])

    const pointFeaturesById = useMemo(
        () => new Map(pointFeatures.map((feature) => [feature._id, feature])),
        [pointFeatures],
    )

    return (
        <>
            {/* Route and section layers */}
            {sortedLinearFeatures.map((feature) => {
                const coordinates = getRenderableCoordinates(feature, resolvedRoutes)
                const sectionPolygon = feature.type === 'section'
                    ? getSectionPolygonCoordinates(feature, resolvedRoutes)
                    : []
                const isSelected = activeSelectedRouteId === feature._id
                const color = categoryColor(feature.category, categories)

                return (
                    <RouteFeature
                        key={feature._id}
                        feature={feature}
                        coordinates={coordinates}
                        sectionPolygon={sectionPolygon}
                        isSelected={isSelected}
                        color={color}
                        categories={categories}
                        onSelectRouteAction={onSelectRouteAction}
                        onOpenFeatureInfoAction={onOpenFeatureInfoAction}
                        onOpenContextMenuAction={onOpenContextMenuAction}
                    />
                )
            })}

            {/* Route endpoints */}
            {!editMode && selectedRouteCoordinates.length >= 2 && (
                <>
                    <MapMarker
                        longitude={selectedRouteCoordinates[0]?.[0] ?? 0}
                        latitude={selectedRouteCoordinates[0]?.[1] ?? 0}
                        offset={[0, 10]}
                    >
                        <MarkerContent>
                            <div className="relative flex items-center justify-center">
                                <div className="absolute size-8 rounded-full bg-[#40a7f4]/24 animate-ping animation-duration-[2.4s]" />
                                <div className="relative size-4 rounded-full border-2 border-white bg-[#40a7f4] shadow-lg shadow-[#40a7f4]/50" />
                            </div>
                        </MarkerContent>
                        <MarkerLabel
                            position="top"
                            className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold backdrop-blur"
                        >
                            Inicio
                        </MarkerLabel>
                    </MapMarker>

                    <MapMarker
                        longitude={selectedRouteCoordinates[selectedRouteCoordinates.length - 1]?.[0] ?? 0}
                        latitude={selectedRouteCoordinates[selectedRouteCoordinates.length - 1]?.[1] ?? 0}
                        offset={[0, 10]}
                    >
                        <MarkerContent>
                            <div className="relative flex items-center justify-center">
                                <div className="absolute size-8 rounded-full bg-[#6e00a3]/24 animate-ping animation-duration-[2.2s]" />
                                <div className="relative size-4 rounded-full border-2 border-white bg-[#6e00a3] shadow-lg shadow-[#6e00a3]/50" />
                            </div>
                        </MarkerContent>
                        <MarkerLabel
                            position="bottom"
                            className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold backdrop-blur"
                        >
                            Fin
                        </MarkerLabel>
                    </MapMarker>
                </>
            )}

            {/* Point markers */}
            {editMode ? (
                pointFeatures.map((feature) => {
                    const [lng, lat] = feature._coords as [number, number]
                    const color = categoryColor(feature.category, categories)
                    const duplicateReady = armedDuplicatePointId === feature._id
                    const duplicateDragging = dragDuplicatePointId === feature._id

                    return (
                        <MapMarker
                            key={feature._id}
                            longitude={lng}
                            latitude={lat}
                            draggable
                            onPointerDown={(event) => {
                                handlePointPointerDown(feature._id, event)
                            }}
                            onPointerUp={() => {
                                handlePointPointerRelease(feature._id)
                            }}
                            onPointerCancel={() => {
                                handlePointPointerRelease(feature._id)
                            }}
                            onDragStart={() => {
                                if (armedDuplicatePointId === feature._id) {
                                    setDragDuplicatePointId(feature._id)
                                }
                            }}
                            onClick={() => {
                                onSelectRouteAction(null)
                                onOpenFeatureInfoAction(feature._id)
                            }}
                            onContextMenu={(event) => {
                                event.preventDefault()
                                onSelectRouteAction(null)
                                onOpenContextMenuAction({
                                    featureId: feature._id,
                                    coordinates: [lng, lat],
                                    screenPosition: { x: event.clientX, y: event.clientY },
                                })
                            }}
                            onDragEnd={({ lng: nextLng, lat: nextLat }) => {
                                const nextPoint = [nextLng, nextLat] as [number, number]

                                if (dragDuplicatePointId === feature._id) {
                                    const duplicatedId = onDuplicatePointFeatureAction(feature._id, nextPoint)
                                    setDragDuplicatePointId(null)
                                    setArmedDuplicatePointId(null)
                                    longPressCandidateRef.current = null
                                    clearLongPressTimer()

                                    if (duplicatedId) {
                                        onSelectRouteAction(null)
                                        onOpenFeatureInfoAction(duplicatedId)
                                    }
                                    return
                                }

                                onUpdateFeatureCoordinatesAction(feature._id, [nextLng, nextLat])
                                onOpenFeatureInfoAction(feature._id)
                            }}
                        >
                            <MarkerContent>
                                <div className="relative flex items-center justify-center">
                                    <div
                                        className="absolute size-8 rounded-full opacity-70"
                                        style={{ backgroundColor: `${color}22` }}
                                    />
                                    <div
                                        className="relative h-4 w-4 rounded-full border-2 border-white shadow-lg transition-transform duration-300 hover:scale-110"
                                        style={{ backgroundColor: color }}
                                    />
                                    {activeInfoPanelFeatureId === feature._id && (
                                        <div
                                            className="absolute h-6 w-6 rounded-full border border-white/70"
                                            style={{ backgroundColor: `${color}1a` }}
                                        />
                                    )}
                                    {duplicateReady && (
                                        <div className="pointer-events-none absolute -top-8 rounded-full border border-sky-200/70 bg-sky-500/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-sky-700/30">
                                            {duplicateDragging ? 'Duplicando...' : 'Listo: arrastra'}
                                        </div>
                                    )}
                                </div>
                            </MarkerContent>
                            <MarkerLabel className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] backdrop-blur">
                                {feature.name}
                            </MarkerLabel>
                            <MarkerTooltip>
                                <FeatureTooltip feature={feature} coordinates={[lng, lat]} categories={categories} />
                            </MarkerTooltip>
                        </MapMarker>
                    )
                })
            ) : (
                clusterData.features.length > 0 && (
                    <MapClusterLayer
                        data={clusterData}
                        clusterRadius={34}
                        clusterMaxZoom={17}
                        pointColor={THEME_COLORS.point}
                        renderPointTooltip={(feature: GeoJsonFeature<GeoJsonPoint, (typeof clusterData.features)[number]['properties']>) => {
                            const featureId = feature.properties?.id
                            const sourceFeature = featureId ? pointFeaturesById.get(featureId) : null
                            if (!sourceFeature) return null
                            const coordinates = feature.geometry.coordinates as [number, number]
                            return <FeatureTooltip feature={sourceFeature} coordinates={coordinates} categories={categories} />
                        }}
                        pointTooltipClassName="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 shadow-md"
                        pieOptions={{
                            enabled: true,
                            categoryProperty: 'category',
                            colorProperty: 'color',
                            categoryColors: clusterCategoryColors,
                            showDominantPercent: true,
                            minRadius: 17,
                            maxRadius: 32,
                        }}
                        coverageOverlayOptions={{
                            enabled: true,
                            fillOpacity: 0.14,
                            outlineOpacity: 0.42,
                            maxLeavesPerCluster: 72,
                        }}
                        onPointClick={(feature) => {
                            const properties = feature.properties
                            if (!properties) return
                            onSelectRouteAction(null)
                            onOpenFeatureInfoAction(properties.id)
                        }}
                    />
                )
            )}

            {/* Line endpoint markers (editing mode) */}
            {editMode &&
                sortedLinearFeatures.flatMap((feature) => {
                    if (feature.type === 'section') return []
                    const sourceCoordinates = feature._coords
                    if (!Array.isArray(sourceCoordinates) || !Array.isArray(sourceCoordinates[0])) return []
                    const lineCoordinates = sourceCoordinates as [number, number][]

                    return lineCoordinates.map((point, index) => {
                        const isEndpoint = index === 0 || index === lineCoordinates.length - 1
                        const isSelected = activeSelectedRouteId === feature._id

                        return (
                            <MapMarker
                                key={`${feature._id}-${index}`}
                                longitude={point[0]}
                                latitude={point[1]}
                                draggable
                                onClick={() => {
                                    onSelectRouteAction(feature._id)
                                    onOpenFeatureInfoAction(feature._id)
                                }}
                                onContextMenu={(event) => {
                                    event.preventDefault()
                                    onSelectRouteAction(feature._id)
                                    onOpenContextMenuAction({
                                        featureId: feature._id,
                                        coordinates: point,
                                        screenPosition: { x: event.clientX, y: event.clientY },
                                    })
                                }}
                                onDragEnd={({ lng: nextLng, lat: nextLat }) => {
                                    const nextCoordinates = lineCoordinates.map((coord, coordIndex) =>
                                        coordIndex === index ? ([nextLng, nextLat] as [number, number]) : coord,
                                    )
                                    onUpdateFeatureCoordinatesAction(feature._id, nextCoordinates)
                                    onSelectRouteAction(feature._id)
                                    onOpenFeatureInfoAction(feature._id)
                                }}
                            >
                                <MarkerContent>
                                    <div className="relative flex items-center justify-center">
                                        <div
                                            className="absolute rounded-full bg-sky-500/20"
                                            style={{
                                                width: isSelected ? 24 : 18,
                                                height: isSelected ? 24 : 18,
                                            }}
                                        />
                                        <div
                                            className="relative rounded-full border-2 border-white shadow-lg"
                                            style={{
                                                width: isEndpoint ? 14 : 12,
                                                height: isEndpoint ? 14 : 12,
                                                backgroundColor: feature.type === 'section' ? THEME_COLORS.section : THEME_COLORS.route,
                                            }}
                                        />
                                    </div>
                                </MarkerContent>
                                <MarkerLabel className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] backdrop-blur">
                                    {feature.type === 'section' ? 'Seccion' : 'Ruta'} {index + 1}
                                </MarkerLabel>
                                <MarkerTooltip>
                                    <FeatureTooltip feature={feature} coordinates={point} categories={categories} />
                                </MarkerTooltip>
                            </MapMarker>
                        )
                    })
                })}
        </>
    )
}