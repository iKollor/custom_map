'use client'

import dynamic from 'next/dynamic'

const MapClient = dynamic(() => import('@/components/map/MapClient'), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                    <span className="size-2 animate-pulse rounded-full bg-primary/60" />
                    <span className="size-2 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-primary/60 [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-muted-foreground">Cargando entorno...</span>
            </div>
        </div>
    ),
})

export default MapClient
