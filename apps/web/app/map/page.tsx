import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SESSION_COOKIE, isValidSessionValue, getConfiguredUsername } from '@/lib/auth'
import MapClientLoader from '@/components/map/MapClientLoader'

export const metadata: Metadata = {
    title: 'Mapa — Plataforma de Datos Geoespaciales',
    description: 'Visualización y gestión de datos geoespaciales interactivos',
}

export default async function MapPage() {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE)?.value

    if (!isValidSessionValue(session)) {
        redirect('/login')
    }

    const username = getConfiguredUsername()

    return <MapClientLoader username={username} />
}
