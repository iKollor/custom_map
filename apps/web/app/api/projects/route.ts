import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, isValidSessionValue } from '@/lib/auth'
import { StoredStateSchema, type StoredState } from '@/components/map/editor/types'
import { PROJECTS_UPDATE_EVENT, projectsBus } from '@/lib/projectsBus'
import { mergeStoredState } from '@/lib/projectsMerge'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Single-tenant app: one global row. Swap to per-user id to scope by session.
const SNAPSHOT_ID = 'default'

// Serializa los PUTs concurrentes en este proceso. Sin esto dos requests
// simultaneos pueden leer el mismo `current`, mergear por separado y el
// segundo upsert pisa al primero (perdida de datos). Para multi-instancia
// hace falta un lock distribuido (Redis/PG advisory lock).
const globalForLock = globalThis as unknown as {
    __projectsPutLock?: Promise<unknown>
}
async function withProjectsLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = globalForLock.__projectsPutLock ?? Promise.resolve()
    let release!: () => void
    const next = new Promise<void>((resolve) => {
        release = resolve
    })
    globalForLock.__projectsPutLock = previous.then(() => next)
    try {
        await previous.catch(() => {
            /* ignore previous failures */
        })
        return await fn()
    } finally {
        release()
    }
}

const BaselineMetaSchema = z.object({
    updatedAt: z.string().nullable().optional(),
    projects: z.array(
        z.object({
            id: z.string(),
            featureIds: z.array(z.string()),
            categoryIds: z.array(z.string()),
        }),
    ),
})

// Accept either the legacy bare StoredState (back-compat) or the new wrapper
// `{ state, baseline }`. New clients should send the wrapper so the server can
// preserve concurrent additions made by other clients.
const PutBodySchema = z.union([
    z.object({
        state: StoredStateSchema,
        baseline: BaselineMetaSchema.optional(),
    }),
    StoredStateSchema,
])

async function requireAuth() {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE)?.value
    return isValidSessionValue(session)
}

export async function GET() {
    if (!(await requireAuth())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const snapshot = await prisma.projectSnapshot.findUnique({
            where: { id: SNAPSHOT_ID },
        })

        if (!snapshot) {
            return NextResponse.json({ data: null, updatedAt: null })
        }

        return NextResponse.json({
            data: snapshot.data,
            updatedAt: snapshot.updatedAt.toISOString(),
        })
    } catch (error) {
        const message = (error as Error)?.message ?? 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    if (!(await requireAuth())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = PutBodySchema.safeParse(payload)
    if (!parseResult.success) {
        return NextResponse.json(
            { error: 'Invalid payload shape', details: parseResult.error.format() },
            { status: 400 }
        )
    }

    const incomingState: StoredState =
        'state' in parseResult.data ? parseResult.data.state : parseResult.data
    const baseline = 'baseline' in parseResult.data ? parseResult.data.baseline : undefined

    try {
        const { merged, updatedAt } = await withProjectsLock(async () => {
            const existing = await prisma.projectSnapshot.findUnique({
                where: { id: SNAPSHOT_ID },
            })

            const currentState = existing
                ? StoredStateSchema.safeParse(existing.data).data ?? null
                : null

            const mergedState = mergeStoredState(currentState, incomingState, baseline)

            const saved = await prisma.projectSnapshot.upsert({
                where: { id: SNAPSHOT_ID },
                update: { data: mergedState as unknown as object },
                create: { id: SNAPSHOT_ID, data: mergedState as unknown as object },
            })

            return { merged: mergedState, updatedAt: saved.updatedAt.toISOString() }
        })

        const senderId = request.headers.get('x-client-id')

        // Emite a otros clientes el snapshot ya fusionado. El remitente filtra
        // por senderId y no lo aplica (recibe los cambios via response del PUT).
        projectsBus.emit(PROJECTS_UPDATE_EVENT, {
            senderId,
            data: merged,
            updatedAt,
        })

        return NextResponse.json({
            ok: true,
            updatedAt,
            data: merged,
        })
    } catch (error) {
        const message = (error as Error)?.message ?? 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
