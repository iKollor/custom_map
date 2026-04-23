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

    return (
        <>
            {pendingPoints.length >= 2 && (
                <MapRoute
                    id="__draw-preview__"
                    coordinates={pendingPoints}
                    color="#40A7F4"
                    width={3}
                    opacity={0.75}
                    dashArray={[6, 4]}
                />
            )}
            {pendingPoints.map((point, index) => (
                <MapMarker key={`${point[0]}-${point[1]}-${index}`} longitude={point[0]} latitude={point[1]}>
                    <MarkerContent>
                        <div
                            className="rounded-full border border-white shadow"
                            style={{
                                width: index === 0 ? 10 : 8,
                                height: index === 0 ? 10 : 8,
                                backgroundColor: index === 0 ? '#6E00A3' : '#40A7F4',
                            }}
                        />
                    </MarkerContent>
                </MapMarker>
            ))}
        </>
    )
}
