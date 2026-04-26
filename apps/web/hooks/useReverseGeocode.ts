'use client'

import { useEffect, useState } from 'react'

const geocodeCache = new Map<string, string>()

type QueuedRequest = {
    url: string
    key: string
    resolve: (data: any) => void
    reject: (error: any) => void
}

const requestQueue: QueuedRequest[] = []
let isProcessingQueue = false

async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) return
    isProcessingQueue = true

    while (requestQueue.length > 0) {
        const req = requestQueue.shift()
        if (!req) continue

        try {
            const response = await fetch(req.url)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            req.resolve(data)
        } catch (error) {
            req.reject(error)
        }

        // Wait ~1.1s between requests to respect Nominatim limits
        if (requestQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 1100))
        }
    }

    isProcessingQueue = false
}

const pendingRequests = new Map<string, Promise<any>>()

function queuedGeocodeFetch(url: string, key: string): Promise<any> {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!
    }

    const promise = new Promise((resolve, reject) => {
        requestQueue.push({ url, key, resolve, reject })
        processQueue()
    }).finally(() => {
        pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise)
    return promise
}

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

        let isMounted = true
        setLoading(true)

        queuedGeocodeFetch(`/api/geocode?lat=${lat}&lon=${lng}`, key)
            .then((data: { display_name?: string }) => {
                if (!isMounted) return
                const addr = data?.display_name ?? null
                if (addr) {
                    geocodeCache.set(key, addr)
                    setAddress(addr)
                }
            })
            .catch(() => {
                // ignore network errors
            })
            .finally(() => {
                if (isMounted) setLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [key, lat, lng, enabled])

    return { address, loading }
}
