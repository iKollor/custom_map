import { cookies } from 'next/headers'
import { SESSION_COOKIE, isValidSessionValue } from '@/lib/auth'
import {
    PROJECTS_UPDATE_EVENT,
    projectsBus,
    type ProjectsUpdateEvent,
} from '@/lib/projectsBus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE)?.value
    if (!isValidSessionValue(session)) {
        return new Response('Unauthorized', { status: 401 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false
            const safeEnqueue = (chunk: string) => {
                if (closed) return
                try {
                    controller.enqueue(encoder.encode(chunk))
                } catch {
                    closed = true
                }
            }

            // Mensaje inicial para forzar flush del header en algunos proxies.
            safeEnqueue(`event: hello\ndata: {"ok":true}\n\n`)

            const handler = (payload: ProjectsUpdateEvent) => {
                safeEnqueue(`event: update\ndata: ${JSON.stringify(payload)}\n\n`)
            }
            projectsBus.on(PROJECTS_UPDATE_EVENT, handler)

            // Heartbeat para mantener viva la conexion detras de proxies.
            const interval = setInterval(() => {
                safeEnqueue(`: ping ${Date.now()}\n\n`)
            }, 25_000)

            const cleanup = () => {
                if (closed) return
                closed = true
                clearInterval(interval)
                projectsBus.off(PROJECTS_UPDATE_EVENT, handler)
                try {
                    controller.close()
                } catch {
                    // ya cerrado
                }
            }

            request.signal.addEventListener('abort', cleanup)
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            // Desactiva buffering en proxies tipo nginx.
            'X-Accel-Buffering': 'no',
        },
    })
}
