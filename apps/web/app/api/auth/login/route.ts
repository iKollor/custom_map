import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkCredentials, getSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: Request) {
    try {
        const body = await request.json() as { username?: string; password?: string }
        const { username = '', password = '' } = body

        if (!checkCredentials(username, password)) {
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401 }
            )
        }

        const cookieStore = await cookies()
        cookieStore.set(SESSION_COOKIE, getSessionToken(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 días
        })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
