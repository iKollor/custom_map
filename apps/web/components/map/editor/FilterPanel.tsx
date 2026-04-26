'use client'

import { useMemo } from 'react'
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
import { buildCategoryTree, categoryColorById } from './helpers'
import type { CategoryDef, FeatureType, ParsedFeature } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Root component (responsive switch) ─────────────────────────────────────

export function FilterPanel(props: FilterPanelProps) {
    const isMobile = useIsMobile()
    if (isMobile) return <MobileFilterSheet {...props} />
    return <DesktopFilterPanel {...props} />
}

// ─── Layout shells ──────────────────────────────────────────────────────────

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

// ─── Shared filter row (DRY: used by both type and category rows) ───────────

interface FilterRowProps {
    /** Unique key for staggered animation delay */
    index: number
    active: boolean
    tooltipActive: boolean
    count: number
    depth?: number
    onToggle: () => void
    onToggleTooltip: () => void
    /** Left-side content (icon + label) */
    children: React.ReactNode
}

/** Reusable interactive row shared between "Tipo" and "Categoría" sections. */
function FilterRow({
    index,
    active,
    tooltipActive,
    count,
    depth = 0,
    onToggle,
    onToggleTooltip,
    children,
}: FilterRowProps) {
    return (
        <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggle()
                }
            }}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-transparent px-2.5 py-2 transition-all hover:bg-primary/5 dark:hover:bg-primary/10"
            style={depth > 0 ? { paddingLeft: `${0.625 + depth * 1.25}rem` } : undefined}
        >
            <span className="flex items-center gap-2 text-sm text-foreground">
                {children}
            </span>
            <span className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleTooltip()
                    }}
                    className={`rounded-md p-1 transition-colors hover:bg-primary/10 hover:text-primary ${tooltipActive ? 'text-primary' : 'text-muted-foreground/40'}`}
                    title="Mostrar tooltip permanentemente"
                >
                    <MessageSquareText className="h-4 w-4" />
                </button>
                <Checkbox
                    checked={active}
                    className="pointer-events-none ml-1 opacity-100"
                    aria-hidden="true"
                />
            </span>
        </motion.div>
    )
}

// ─── Filter body (content shared by both shells) ────────────────────────────

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
    /** Only show types that exist in the current dataset. */
    const presentTypes = useMemo(
        () => FEATURE_TYPES.filter((t) => features.some((f) => f.type === t)),
        [features],
    )

    /** Hierarchical category list with recursive counts (from shared helper). */
    const treeItems = useMemo(
        () => buildCategoryTree(categories, features),
        [categories, features],
    )

    const visibleCount = useMemo(
        () => features.filter((f) => activeTypes.has(f.type) && activeCategories.has(f.categoryId)).length,
        [features, activeTypes, activeCategories],
    )

    return (
        <>
            {/* ── Type filters ── */}
            <div className="border-b border-border px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo
                </p>
                <div className="space-y-1.5">
                    {presentTypes.map((type, i) => (
                        <FilterRow
                            key={type}
                            index={i}
                            active={activeTypes.has(type)}
                            tooltipActive={forcedTooltipTypes.has(type)}
                            count={features.filter((f) => f.type === type).length}
                            onToggle={() => onToggleType(type)}
                            onToggleTooltip={() => onToggleForcedTooltipType(type)}
                        >
                            <span className={activeTypes.has(type) ? 'text-primary' : 'text-muted-foreground'}>
                                {TYPE_ICONS[type] ?? <MapPin className="h-3.5 w-3.5" />}
                            </span>
                            <span className="capitalize">{TYPE_LABELS[type] ?? type}</span>
                        </FilterRow>
                    ))}
                </div>
            </div>

            {/* ── Category filters (hierarchical) ── */}
            <div className="overflow-y-auto px-4 py-3 md:max-h-64">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Categoría
                </p>
                <div className="space-y-1.5">
                    {treeItems.map(({ cat, depth, count }, i) => {
                        const active = activeCategories.has(cat.id)
                        const catColor = categoryColorById(cat.id, categories)

                        return (
                            <FilterRow
                                key={cat.id}
                                index={i}
                                active={active}
                                tooltipActive={forcedTooltipCategories.has(cat.id)}
                                count={count}
                                depth={depth}
                                onToggle={() => onToggleCategory(cat.id)}
                                onToggleTooltip={() => onToggleForcedTooltipCategory(cat.id)}
                            >
                                {depth > 0 && (
                                    <span className="-mt-3 mr-1 h-3 w-2 border-b border-l border-muted-foreground/30 opacity-50" />
                                )}
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                                    style={{ backgroundColor: active ? catColor : '#D1D5DB' }}
                                />
                                {cat.name}
                            </FilterRow>
                        )
                    })}
                </div>
            </div>

            {/* ── Footer summary ── */}
            <div className="border-t border-border bg-muted/40 px-4 py-2">
                <p className="text-xs text-muted-foreground">
                    {visibleCount} de {features.length} elementos visibles
                </p>
            </div>
        </>
    )
}
