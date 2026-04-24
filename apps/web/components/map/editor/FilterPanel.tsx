'use client'

import { MapPin, X, MessageSquareText } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@workspace/ui/components/button'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@workspace/ui/components/sheet'
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { FEATURE_TYPES, TYPE_ICONS, TYPE_LABELS } from './constants'
import type { CategoryDef, FeatureType, ParsedFeature } from './types'

interface FilterPanelProps {
    open: boolean
    onClose: () => void
    features: ParsedFeature[]
    activeTypes: Set<FeatureType>
    activeCategories: Set<string>
    forcedTooltipTypes: Set<string>
    forcedTooltipCategories: Set<string>
    onToggleType: (type: FeatureType) => void
    onToggleCategory: (category: string) => void
    onToggleForcedTooltipType: (type: FeatureType) => void
    onToggleForcedTooltipCategory: (category: string) => void
    categories: CategoryDef[]
}

export function FilterPanel(props: FilterPanelProps) {
    const isMobile = useIsMobile()
    if (isMobile) return <MobileFilterSheet {...props} />
    return <DesktopFilterPanel {...props} />
}

function MobileFilterSheet(props: FilterPanelProps) {
    return (
        <Sheet open={props.open} onOpenChange={(next) => !next && props.onClose()}>
            <SheetContent
                side="bottom"
                className="h-[80vh] gap-0 overflow-hidden rounded-t-2xl border-sky-100/80 p-0"
            >
                <SheetHeader className="border-b pb-3">
                    <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <FilterBody {...props} />
                </div>
            </SheetContent>
        </Sheet>
    )
}

function DesktopFilterPanel({ open, onClose, ...rest }: FilterPanelProps) {
    if (!open) return null
    return (
        <motion.div
            initial={{ opacity: 0, x: -18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-14 left-3 z-20 w-72 overflow-hidden rounded-2xl border border-sky-100/80 bg-background/95 shadow-[0_18px_55px_-24px_rgba(14,165,233,0.45)] ring-1 ring-black/5 backdrop-blur-md"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Filtros</span>
                <Button type="button" size="icon-xs" variant="ghost" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <FilterBody open={open} onClose={onClose} {...rest} />
        </motion.div>
    )
}

function FilterBody({
    features,
    activeTypes,
    activeCategories,
    forcedTooltipTypes,
    forcedTooltipCategories,
    onToggleType,
    onToggleCategory,
    onToggleForcedTooltipType,
    onToggleForcedTooltipCategory,
    categories,
}: FilterPanelProps) {
    const allTypes = FEATURE_TYPES.filter((type) => features.some((feature) => feature.type === type))

    return (
        <>
            <div className="border-b border-border px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo</p>
                <div className="space-y-1.5">
                    {allTypes.map((type, index) => {
                        const count = features.filter((f) => f.type === type).length
                        const active = activeTypes.has(type)
                        const tooltipsActive = forcedTooltipTypes.has(type)

                        return (
                            <motion.div
                                key={type}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04, duration: 0.22 }}
                                role="button"
                                tabIndex={0}
                                onClick={() => onToggleType(type)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        onToggleType(type)
                                    }
                                }}
                                className="group flex cursor-pointer items-center justify-between rounded-xl border border-transparent px-2.5 py-2 transition-all hover:bg-primary/5 dark:hover:bg-primary/10"
                            >
                                <span className="flex items-center gap-2 text-sm text-foreground">
                                    <span className={active ? 'text-primary' : 'text-muted-foreground'}>
                                        {TYPE_ICONS[type] ?? <MapPin className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="capitalize">{TYPE_LABELS[type] ?? type}</span>
                                </span>
                                <span className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                                    <span className="text-xs text-muted-foreground">{count}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleForcedTooltipType(type)
                                        }}
                                        className={`rounded-md p-1 transition-colors hover:bg-primary/10 hover:text-primary ${tooltipsActive ? 'text-primary' : 'text-muted-foreground/40'}`}
                                        title="Mostrar tooltip permanentemente"
                                    >
                                        <MessageSquareText className="h-4 w-4" />
                                    </button>
                                    <Checkbox checked={active} className="pointer-events-none ml-1 opacity-100" aria-hidden="true" />
                                </span>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            <div className="overflow-y-auto px-4 py-3 md:max-h-64">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</p>
                <div className="space-y-1.5">
                    {categories.map((cat, index) => {
                        const count = features.filter((f) => f.category === cat.name).length
                        const active = activeCategories.has(cat.name)
                        const tooltipsActive = forcedTooltipCategories.has(cat.name)

                        return (
                            <motion.div
                                key={cat.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.08 + index * 0.03, duration: 0.2 }}
                                role="button"
                                tabIndex={0}
                                onClick={() => onToggleCategory(cat.name)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        onToggleCategory(cat.name)
                                    }
                                }}
                                className="group flex cursor-pointer items-center justify-between rounded-xl border border-transparent px-2.5 py-2 transition-all hover:bg-primary/5 dark:hover:bg-primary/10"
                            >
                                <span className="flex items-center gap-2 text-sm text-foreground">
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                                        style={{ backgroundColor: active ? cat.color : '#D1D5DB' }}
                                    />
                                    {cat.name}
                                </span>
                                <span className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                                    <span className="text-xs text-muted-foreground">{count}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleForcedTooltipCategory(cat.name)
                                        }}
                                        className={`rounded-md p-1 transition-colors hover:bg-primary/10 hover:text-primary ${tooltipsActive ? 'text-primary' : 'text-muted-foreground/40'}`}
                                        title="Mostrar tooltip permanentemente"
                                    >
                                        <MessageSquareText className="h-4 w-4" />
                                    </button>
                                    <Checkbox checked={active} className="pointer-events-none ml-1 opacity-100" aria-hidden="true" />
                                </span>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            <div className="border-t border-border bg-muted/40 px-4 py-2">
                <p className="text-xs text-muted-foreground">
                    {
                        features.filter(
                            (f) => activeTypes.has(f.type) && activeCategories.has(f.category),
                        ).length
                    }{' '}
                    de {features.length} elementos visibles
                </p>
            </div>
        </>
    )
}
