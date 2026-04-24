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
import { useIsMobile } from '@/hooks/use-is-mobile'
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
    clusteringEnabled: boolean
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
const DUPLICATE_MIN_PIXEL_DISTANCE_DESKTOP = 18
const DUPLICATE_MIN_PIXEL_DISTANCE_TOUCH = 3
const DUPLICATE_COORD_EPSILON = 0.000001

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
    clusteringEnabled,
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
    const isMobile = useIsMobile()
    const [armedDuplicatePointId, setArmedDuplicatePointId] = useState<string | null>(null)
    const [dragDuplicatePointId, setDragDuplicatePointId] = useState<string | null>(null)
    const longPressTimerRef = useRef<number | null>(null)
    const longPressCandidateRef = useRef<string | null>(null)
    const touchActiveRef = useRef<string | null>(null)
    const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
    const pointerCurrentRef = useRef<{ x: number; y: number } | null>(null)
    const duplicateGesturePointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | null>(null)
    const duplicateCancelledRef = useRef(false)
    const gestureCleanupRef = useRef<(() => void) | null>(null)

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current === null) return
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
    }

    const detachGestureListeners = () => {
        gestureCleanupRef.current?.()
        gestureCleanupRef.current = null
    }

    const endGestureTracking = () => {
        detachGestureListeners()
        pointerOriginRef.current = null
        pointerCurrentRef.current = null
        duplicateGesturePointerTypeRef.current = null
    }

    const cancelDuplicateGesture = () => {
        duplicateCancelledRef.current = true
        setDragDuplicatePointId(null)
        setArmedDuplicatePointId(null)
        longPressCandidateRef.current = null
        clearLongPressTimer()
    }

    useEffect(() => {
        return () => {
            clearLongPressTimer()
            endGestureTracking()
        }
    }, [])

    const beginGestureTracking = (event: PointerEvent) => {
        endGestureTracking()
        duplicateCancelledRef.current = false
        pointerOriginRef.current = { x: event.clientX, y: event.clientY }
        pointerCurrentRef.current = { x: event.clientX, y: event.clientY }

        const handlePointerMove = (e: PointerEvent) => {
            pointerCurrentRef.current = { x: e.clientX, y: e.clientY }
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                cancelDuplicateGesture()
            }
        }
        const handleEnd = () => {
            // If pointerup/cancel happens outside the marker, detach listeners to avoid leaks.
            // Keep gesture metrics until dragEnd runs, otherwise duplication can be cancelled
            // because distance snapshots become null before the duplication check.
            detachGestureListeners()
        }

        window.addEventListener('pointermove', handlePointerMove, { passive: true })
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('pointerup', handleEnd, { once: true })
        window.addEventListener('pointercancel', handleEnd, { once: true })

        gestureCleanupRef.current = () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('pointerup', handleEnd)
            window.removeEventListener('pointercancel', handleEnd)
        }
    }

    const handlePointPointerDown = (featureId: string, event: PointerEvent) => {
        beginGestureTracking(event)
        duplicateGesturePointerTypeRef.current = event.pointerType as 'mouse' | 'touch' | 'pen'

        if (event.pointerType === 'mouse') {
            touchActiveRef.current = null
            setArmedDuplicatePointId(event.altKey ? featureId : null)
            return
        }

        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return

        touchActiveRef.current = featureId
        setArmedDuplicatePointId(null)
        longPressCandidateRef.current = featureId
        clearLongPressTimer()

        longPressTimerRef.current = window.setTimeout(() => {
            if (longPressCandidateRef.current !== featureId) return
            setArmedDuplicatePointId(featureId)
            // Haptic feedback when duplicate is armed (browsers that support Vibration API)
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                try { navigator.vibrate(18) } catch { /* no-op */ }
            }
        }, LONG_PRESS_DUPLICATE_MS)
    }

    const handlePointPointerRelease = (featureId: string) => {
        if (longPressCandidateRef.current === featureId) {
            longPressCandidateRef.current = null
        }
        if (touchActiveRef.current === featureId) {
            touchActiveRef.current = null
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
            {editMode || !clusteringEnabled ? (
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
                            draggable={editMode}
                            onPointerDown={(event) => {
                                if (!editMode) return
                                handlePointPointerDown(feature._id, event)
                            }}
                            onPointerUp={() => {
                                if (!editMode) return
                                handlePointPointerRelease(feature._id)
                            }}
                            onPointerCancel={() => {
                                if (!editMode) return
                                handlePointPointerRelease(feature._id)
                            }}
                            onDragStart={() => {
                                if (!editMode) return
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
                                // On touch, the browser fires 'contextmenu' around ~500ms into a long-press,
                                // which would interfere with the long-press-to-duplicate gesture. Ignore it
                                // and let the long-press flow handle the interaction.
                                if (touchActiveRef.current === feature._id) return
                                onSelectRouteAction(null)
                                onOpenContextMenuAction({
                                    featureId: feature._id,
                                    coordinates: [lng, lat],
                                    screenPosition: { x: event.clientX, y: event.clientY },
                                })
                            }}
                            onDragEnd={({ lng: nextLng, lat: nextLat }) => {
                                if (!editMode) return
                                const nextPoint = [nextLng, nextLat] as [number, number]
                                const cancelled = duplicateCancelledRef.current

                                // DOM-level distance between original pointerdown and the
                                // last tracked pointer position. If the user barely moved,
                                // treat it as a mis-trigger and cancel duplication.
                                const origin = pointerOriginRef.current
                                const current = pointerCurrentRef.current
                                const pointerType = duplicateGesturePointerTypeRef.current
                                const isTouchLike = pointerType === 'touch' || pointerType === 'pen'
                                const minPixelDistance = isTouchLike
                                    ? DUPLICATE_MIN_PIXEL_DISTANCE_TOUCH
                                    : DUPLICATE_MIN_PIXEL_DISTANCE_DESKTOP
                                const hasPixelTracking = Boolean(origin && current)
                                const pixelDistance = origin && current
                                    ? Math.hypot(current.x - origin.x, current.y - origin.y)
                                    : 0
                                const movedInCoords =
                                    Math.hypot(nextLng - lng, nextLat - lat) > DUPLICATE_COORD_EPSILON
                                const tooClose = hasPixelTracking
                                    ? pixelDistance < minPixelDistance
                                    : isTouchLike
                                        ? !movedInCoords
                                        : true

                                if (dragDuplicatePointId === feature._id) {
                                    setDragDuplicatePointId(null)
                                    setArmedDuplicatePointId(null)
                                    longPressCandidateRef.current = null
                                    clearLongPressTimer()
                                    endGestureTracking()

                                    if (cancelled || tooClose) {
                                        // Revert: do not duplicate and do not move the original.
                                        onOpenFeatureInfoAction(feature._id)
                                        return
                                    }

                                    const duplicatedId = onDuplicatePointFeatureAction(feature._id, nextPoint)
                                    if (duplicatedId) {
                                        onSelectRouteAction(null)
                                        onOpenFeatureInfoAction(duplicatedId)
                                    }
                                    return
                                }

                                endGestureTracking()
                                onUpdateFeatureCoordinatesAction(feature._id, [nextLng, nextLat])
                                onOpenFeatureInfoAction(feature._id)
                            }}
                        >
                            <MarkerContent>
                                <div
                                    className="relative flex items-center justify-center select-none"
                                    style={{
                                        touchAction: 'none',
                                        WebkitTouchCallout: 'none',
                                        WebkitUserSelect: 'none',
                                        userSelect: 'none',
                                    }}
                                >
                                    <div
                                        className="absolute size-11 rounded-full opacity-70"
                                        style={{ backgroundColor: `${color}22` }}
                                    />
                                    <div
                                        className="relative h-6 w-6 rounded-full border-2 border-white shadow-lg transition-transform duration-300 hover:scale-110"
                                        style={{ backgroundColor: color }}
                                    />
                                    {activeInfoPanelFeatureId === feature._id && (
                                        <div
                                            className="absolute h-9 w-9 rounded-full border border-white/70"
                                            style={{ backgroundColor: `${color}1a` }}
                                        />
                                    )}
                                    {duplicateReady && (
                                        <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-full border border-sky-200/70 bg-sky-500/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-sky-700/30">
                                            {duplicateDragging ? 'Duplicando…' : 'Listo: arrastra'}
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
                        renderPointTooltip={isMobile ? undefined : (feature: GeoJsonFeature<GeoJsonPoint, (typeof clusterData.features)[number]['properties']>) => {
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
                            minRadius: 24,
                            maxRadius: 44,
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