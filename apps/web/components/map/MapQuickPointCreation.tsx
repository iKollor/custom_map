'use client'

import { useEffect, useRef } from 'react'

import { useMap } from '@/components/ui/map'

type MapQuickPointCreationProps = {
    editMode: boolean
    onCreatePointAction: (point: [number, number]) => void
}

const MOBILE_LONG_PRESS_MS = 520
const TOUCH_MOVE_TOLERANCE_PX = 10

function parseCoordinatesFromText(text: string): [number, number] | null {
    const matches = text.match(/-?\d+(?:\.\d+)?/g)
    if (!matches || matches.length < 2) return null

    const first = Number(matches[0])
    const second = Number(matches[1])
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null

    // Preferred input for this app is "lat, lng" (as shown in UI copy actions).
    if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
        return [second, first]
    }

    // Fallback: "lng, lat"
    if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
        return [first, second]
    }

    return null
}

function isTextInputTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') !== null
    )
}

function isLikelyAppFeatureLayer(layerId: string | undefined) {
    if (!layerId) return false
    return (
        layerId.startsWith('route-layer-') ||
        layerId.startsWith('polygon-fill-') ||
        layerId.startsWith('polygon-outline-') ||
        layerId.startsWith('clusters-') ||
        layerId.startsWith('cluster-count-') ||
        layerId.startsWith('clusters-hit-') ||
        layerId.startsWith('unclustered-point-')
    )
}

export function MapQuickPointCreation({ editMode, onCreatePointAction }: MapQuickPointCreationProps) {
    const { map, isLoaded } = useMap()
    const mapHoverRef = useRef(false)

    useEffect(() => {
        if (!map || !isLoaded || !editMode) return

        const canvas = map.getCanvas()
        const isCoarsePointer =
            typeof window !== 'undefined' &&
            (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)

        const onMouseEnter = () => {
            mapHoverRef.current = true
        }
        const onMouseLeave = () => {
            mapHoverRef.current = false
        }

        canvas.addEventListener('mouseenter', onMouseEnter)
        canvas.addEventListener('mouseleave', onMouseLeave)

        const handlePaste = (event: ClipboardEvent) => {
            if (isCoarsePointer) return
            if (!mapHoverRef.current) return
            if (isTextInputTarget(event.target)) return

            const text = event.clipboardData?.getData('text')?.trim()
            if (!text) return

            const coords = parseCoordinatesFromText(text)
            if (!coords) return

            event.preventDefault()
            onCreatePointAction(coords)
        }

        window.addEventListener('paste', handlePaste)

        let longPressTimer: number | null = null
        let startPoint: { x: number; y: number } | null = null

        const clearLongPressTimer = () => {
            if (longPressTimer === null) return
            window.clearTimeout(longPressTimer)
            longPressTimer = null
        }

        const handleTouchStart = (event: any) => {
            if (!isCoarsePointer) return

            const target = event.originalEvent?.target
            if (target instanceof HTMLElement) {
                if (target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')) return
            }

            const point = event.point as { x: number; y: number } | undefined
            const lngLat = event.lngLat as { lng: number; lat: number } | undefined
            if (!point || !lngLat) return

            startPoint = point
            clearLongPressTimer()

            longPressTimer = window.setTimeout(() => {
                const rendered = map.queryRenderedFeatures([point.x, point.y])
                const hasAppFeature = rendered.some((feature) =>
                    isLikelyAppFeatureLayer(feature.layer?.id),
                )
                if (hasAppFeature) return

                onCreatePointAction([lngLat.lng, lngLat.lat])
                try {
                    navigator.vibrate?.(16)
                } catch {
                    // no-op
                }
            }, MOBILE_LONG_PRESS_MS)
        }

        const handleTouchMove = (event: any) => {
            if (!startPoint) return
            const point = event.point as { x: number; y: number } | undefined
            if (!point) return

            const moved = Math.hypot(point.x - startPoint.x, point.y - startPoint.y)
            if (moved > TOUCH_MOVE_TOLERANCE_PX) {
                clearLongPressTimer()
            }
        }

        const handleTouchEnd = () => {
            clearLongPressTimer()
            startPoint = null
        }

        const preventNativeContextMenu = (event: Event) => {
            if (!isCoarsePointer) return
            event.preventDefault()
        }

        map.on('touchstart', handleTouchStart)
        map.on('touchmove', handleTouchMove)
        map.on('touchend', handleTouchEnd)
        map.on('touchcancel', handleTouchEnd)
        canvas.addEventListener('contextmenu', preventNativeContextMenu)

        return () => {
            canvas.removeEventListener('mouseenter', onMouseEnter)
            canvas.removeEventListener('mouseleave', onMouseLeave)
            window.removeEventListener('paste', handlePaste)
            map.off('touchstart', handleTouchStart)
            map.off('touchmove', handleTouchMove)
            map.off('touchend', handleTouchEnd)
            map.off('touchcancel', handleTouchEnd)
            canvas.removeEventListener('contextmenu', preventNativeContextMenu)
            clearLongPressTimer()
            startPoint = null
            mapHoverRef.current = false
        }
    }, [map, isLoaded, editMode, onCreatePointAction])

    return null
}
