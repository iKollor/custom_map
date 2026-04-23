'use client'

import { useEffect, useState } from 'react'

const geocodeCache = new Map<string, string>()

export function useReverseGeocode(lng: number, lat: number, enabled: boolean) {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    const [address, setAddress] = useState<string | null>(() => geocodeCache.get(key) ?? null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!enabled) return
        if (geocodeCache.has(key)) {
            setAddress(geocodeCache.get(key)!)
            return
        }

        const controller = new AbortController()
        setLoading(true)

        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            signal: controller.signal,
            headers: { 'Accept-Language': 'es' },
        })
            .then((r) => r.json())
            .then((data: { display_name?: string }) => {
                const addr = data?.display_name ?? null
                if (addr) {
                    geocodeCache.set(key, addr)
                    setAddress(addr)
                }
            })
            .catch(() => {
                // ignore abort or network errors
            })
            .finally(() => setLoading(false))

        return () => controller.abort()
    }, [key, lat, lng, enabled])

    return { address, loading }
}
