'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { MapProject } from './editor/types'

const SharedMapClient = dynamic(() => import('./SharedMapClient'), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium animate-pulse">Cargando mapa público...</p>
            </div>
        </div>
    ),
})

export default function SharedMapClientLoader({ project }: { project: MapProject }) {
    return <SharedMapClient project={project} />
}
