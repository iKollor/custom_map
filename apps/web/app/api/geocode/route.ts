import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')

    try {
        let url = ''
        if (q) {
            const params = new URLSearchParams({
                q,
                format: 'jsonv2',
                limit: '1',
                'accept-language': 'es',
            })
            url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
        } else if (lat && lon) {
            url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        } else {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        let data = null
        let success = false
        let attempts = 0
        const maxAttempts = 3
        let lastStatus = 0

        while (attempts < maxAttempts && !success) {
            attempts++
            try {
                const controller = new AbortController()
                // Next.js undici defaults to 10s connection timeout anyway, keep it within that
                const timeoutId = setTimeout(() => controller.abort(), 9000)

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        // Nominatim requires a valid and unique User-Agent to avoid 403 Forbidden
                        'User-Agent': 'FormulariosXavierMapEditor/1.0 (isai@formulariosxavier.local)',
                        'Referer': 'http://localhost:3000',
                        'Accept-Language': 'es',
                        'Accept': 'application/json',
                    },
                })

                clearTimeout(timeoutId)

                if (response.ok) {
                    data = await response.json()
                    success = true
                } else {
                    lastStatus = response.status
                    if (response.status === 429 || response.status >= 500) {
                        // Rate limited or server error, wait and retry
                        await new Promise(r => setTimeout(r, 1500 * attempts))
                    } else {
                        // Client error (e.g. 400 Bad Request), don't retry
                        break
                    }
                }
            } catch (error: any) {
                if (attempts >= maxAttempts) {
                    if (error.name === 'AbortError' || error.message?.includes('fetch failed')) {
                        console.warn(`[Geocode] Retries exhausted for ${lat ? `lat=${lat},lon=${lon}` : `q=${q}`}`)
                    } else {
                        console.error('Geocoding error:', error)
                    }
                    break
                }
                // Wait before retry on network error/timeout
                await new Promise(r => setTimeout(r, 1500 * attempts))
            }
        }

        if (success && data) {
            return NextResponse.json(data)
        }

        return NextResponse.json({ 
            display_name: `Dirección no disponible (${lastStatus ? `Error ${lastStatus}` : 'Tiempo de conexión excedido'})` 
        })
    } catch (error: any) {
        console.error('Geocoding critical error:', error)
        return NextResponse.json({ 
            display_name: 'Dirección no disponible (Error interno)' 
        })
    }
}
