import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'map_session'

const PUBLIC_PATHS = ['/login', '/api/auth', '/shared', '/api/shared', '/api/route']

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
        return NextResponse.next()
    }

    const cookieValue = request.cookies.get(SESSION_COOKIE)?.value
    const expectedToken = process.env.AUTH_SESSION_TOKEN ?? 'dev-token-change-me'

    if (cookieValue !== expectedToken) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|data/).*)'],
}
