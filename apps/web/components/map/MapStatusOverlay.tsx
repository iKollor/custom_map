'use client'

import { AnimatePresence, motion } from 'motion/react'

import { THEME_COLORS } from './editor'

type MapStatusOverlayProps = {
    editMode: boolean
    visibleCount: number
    totalCount: number
    activeTypesCount: number
    activeCategoriesCount: number
    summary: {
        points: number
        routes: number
        sections: number
    }
    visibilityRatio: number
    routingCount: number
}

export function MapStatusOverlay({
    editMode,
    visibleCount,
    totalCount,
    activeTypesCount,
    activeCategoriesCount,
    summary,
    visibilityRatio,
    routingCount,
}: MapStatusOverlayProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={`${editMode ? 'edit' : 'view'}-${visibleCount}-${activeTypesCount}-${activeCategoriesCount}`}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none absolute bottom-5 left-3 z-20 hidden w-[min(430px,calc(100vw-1.5rem))] flex-col gap-2 md:flex"
            >
                <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/88 p-4 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.65)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/82">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                {editMode ? 'Modo edicion' : 'Vista operativa'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                                {visibleCount} de {totalCount} elementos visibles
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                            <span className="rounded-full bg-[#40a7f4]/15 px-2.5 py-1 text-[#114771] dark:text-[#8fd2ff]">
                                {summary.points} puntos
                            </span>
                            <span className="rounded-full bg-[#6e00a3]/14 px-2.5 py-1 text-[#5b178a] dark:text-[#ddb6ff]">
                                {summary.routes} rutas
                            </span>
                            <span className="rounded-full bg-[#8f4bd0]/14 px-2.5 py-1 text-[#563476] dark:text-[#d2b8f5]">
                                {summary.sections} secciones
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900/5 dark:bg-white/10">
                        <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: `${visibilityRatio}%` }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full bg-linear-to-r from-[#6e00a3] via-[#8e58d6] to-[#40a7f4]"
                        />
                    </div>
                </div>

                {routingCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="pointer-events-auto inline-flex items-center gap-2 self-start rounded-full border border-[#40a7f4]/35 bg-white/92 px-3 py-1.5 text-xs font-medium text-[#13507f] shadow-lg backdrop-blur dark:border-[#40a7f4]/40 dark:bg-slate-950/85 dark:text-[#8fd2ff]"
                    >
                        <span className="h-2 w-2 rounded-full bg-[#40a7f4] animate-pulse" />
                        Ajustando trazado real de {routingCount} ruta(s)
                    </motion.div>
                )}
            </motion.div>

            {/* Mobile: compact status chip */}
            <motion.div
                key={`mobile-${editMode ? 'edit' : 'view'}-${visibleCount}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22 }}
                className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-10 -translate-x-1/2 md:hidden"
            >
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/92 px-3 py-1 text-[11px] font-medium shadow-md backdrop-blur-sm">
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${editMode ? 'bg-[#6e00a3]' : 'bg-[#40a7f4]'} ${routingCount > 0 ? 'animate-pulse' : ''}`}
                    />
                    <span className="tabular-nums">
                        {visibleCount}/{totalCount}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                        {summary.points}p · {summary.routes}r · {summary.sections}s
                    </span>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}