import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, isValidSessionValue } from '@/lib/auth'
import { StoredStateSchema } from '@/components/map/editor/types'

export const dynamic = 'force-dynamic'

// Single-tenant app: one global row. Swap to per-user id to scope by session.
const SNAPSHOT_ID = 'default'

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

    const parseResult = StoredStateSchema.safeParse(payload)
    if (!parseResult.success) {
        return NextResponse.json(
            { error: 'Invalid payload shape', details: parseResult.error.format() },
            { status: 400 }
        )
    }

    try {
        const saved = await prisma.projectSnapshot.upsert({
            where: { id: SNAPSHOT_ID },
            update: { data: parseResult.data as unknown as object },
            create: { id: SNAPSHOT_ID, data: parseResult.data as unknown as object },
        })

        return NextResponse.json({
            ok: true,
            updatedAt: saved.updatedAt.toISOString(),
        })
    } catch (error) {
        const message = (error as Error)?.message ?? 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
