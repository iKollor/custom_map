import { NextResponse } from 'next/server'

/**
 * OSRM routing proxy.
 * Forwards /api/route/<anything>?<query> to the self-hosted OSRM backend.
 *
 * Keeps OSRM URL server-side (no mixed content on HTTPS clients) and hides
 * backend URL from the browser. Configure via OSRM_URL env var.
 *
 * Example:
 *   GET /api/route/v1/driving/lng,lat;lng,lat?overview=full&geometries=geojson
 *   → OSRM_URL/route/v1/driving/lng,lat;lng,lat?overview=full&geometries=geojson
 */

const OSRM_URL = (process.env.OSRM_URL ?? process.env.NEXT_PUBLIC_OSRM_URL ?? '').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 10000

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    context: { params: Promise<{ path: string[] }> },
) {
    if (!OSRM_URL) {
        return NextResponse.json(
            { error: 'OSRM backend not configured. Set OSRM_URL env var.' },
            { status: 503 },
        )
    }

    const { path } = await context.params
    if (!Array.isArray(path) || path.length === 0) {
        return NextResponse.json({ error: 'Invalid route path.' }, { status: 400 })
    }

    const incoming = new URL(request.url)
    const targetUrl = `${OSRM_URL}/route/${path.map(encodeURIComponent).join('/')}${incoming.search}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const upstream = await fetch(targetUrl, { signal: controller.signal })
        const body = await upstream.text()

        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        })
    } catch (error) {
        const name = (error as Error)?.name
        const message =
            name === 'AbortError'
                ? `Upstream OSRM timed out after ${REQUEST_TIMEOUT_MS}ms`
                : (error as Error)?.message ?? 'Unknown error'
        return NextResponse.json({ error: message }, { status: 502 })
    } finally {
        clearTimeout(timeoutId)
    }
}
