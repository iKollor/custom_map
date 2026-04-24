import { useEffect, useRef } from 'react'
import { MapMarker, MapRoute, MarkerContent, useMap } from '@/components/ui/map'
import type { DrawMode } from './types'

interface MapDrawLayerProps {
    drawMode: DrawMode
    pendingPoints: [number, number][]
    onAddPoint: (point: [number, number]) => void
}

export function MapDrawLayer({ drawMode, pendingPoints, onAddPoint }: MapDrawLayerProps) {
    const { map } = useMap()
    const onAddPointRef = useRef(onAddPoint)
    onAddPointRef.current = onAddPoint

    useEffect(() => {
        if (!map || !drawMode) return

        map.getCanvas().style.cursor = 'crosshair'

        const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
            onAddPointRef.current([e.lngLat.lng, e.lngLat.lat])
        }

        map.on('click', handleClick)

        return () => {
            map.off('click', handleClick)
            map.getCanvas().style.cursor = ''
        }
    }, [map, drawMode])

    if (!drawMode || pendingPoints.length === 0) return null

    if (drawMode === 'point') {
        const point = pendingPoints[0]
        if (!point) return null

        return (
            <MapMarker longitude={point[0]} latitude={point[1]}>
                <MarkerContent>
                    <div className="h-5 w-5 rounded-full border-2 border-white bg-[#40a7f4] shadow-lg animate-pulse" />
                </MarkerContent>
            </MapMarker>
        )
    }

    const firstPoint = pendingPoints[0]
    const lastPoint = pendingPoints[pendingPoints.length - 1]
    const sectionClosed = drawMode === 'section' && pendingPoints.length >= 4 && !!firstPoint && !!lastPoint
        && firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]
    const sectionPreviewPath = drawMode === 'section' && pendingPoints.length >= 3 && !sectionClosed && firstPoint
        ? [...pendingPoints, firstPoint]
        : pendingPoints

    return (
        <>
            {pendingPoints.length >= 2 && (
                <MapRoute
                    id="__draw-preview__"
                    coordinates={sectionPreviewPath}
                    color="#40A7F4"
                    width={3}
                    opacity={0.75}
                    dashArray={[6, 4]}
                    animateOnMount
                />
            )}
            {pendingPoints.map((point, index) => (
                <MapMarker key={`${point[0]}-${point[1]}-${index}`} longitude={point[0]} latitude={point[1]}>
                    <MarkerContent>
                        <div
                            onClick={() => {
                                if (drawMode !== 'section' || index !== 0 || pendingPoints.length < 3) return
                                const first = pendingPoints[0]
                                if (!first) return
                                onAddPoint(first)
                            }}
                            className="rounded-full border border-white shadow"
                            style={{
                                width: index === 0 ? 11 : 8,
                                height: index === 0 ? 11 : 8,
                                backgroundColor: index === 0 ? '#6E00A3' : '#40A7F4',
                                cursor: drawMode === 'section' && index === 0 && pendingPoints.length >= 3
                                    ? 'pointer'
                                    : 'default',
                            }}
                            title={
                                drawMode === 'section' && index === 0 && pendingPoints.length >= 3
                                    ? 'Clic para cerrar polígono'
                                    : undefined
                            }
                        />
                    </MarkerContent>
                </MapMarker>
            ))}
        </>
    )
}
