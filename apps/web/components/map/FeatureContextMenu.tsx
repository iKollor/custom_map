'use client'

import { useEffect, useRef } from 'react'
import { Info, Edit2, Trash2, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'

import { useIsMobile } from '@/hooks/use-is-mobile'
import { CONTEXT_MENU_LABELS, type FeatureType } from './editor'
import type { ContextMenuState } from './map-client-types'

type FeatureContextMenuProps = {
    state: ContextMenuState | null
    featureType?: FeatureType
    onCloseAction: () => void
    onViewInfoAction: () => void
    onEditAction: () => void
    onDeleteAction: () => void
    onCopyCoordsAction: () => void
    onOpenInMapsAction: () => void
}

export function FeatureContextMenu({
    state,
    featureType,
    onCloseAction,
    onViewInfoAction,
    onEditAction,
    onDeleteAction,
    onCopyCoordsAction,
    onOpenInMapsAction,
}: FeatureContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const isMobile = useIsMobile()

    useEffect(() => {
        if (!state) return

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onCloseAction()
            }
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseAction()
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [state, onCloseAction])

    if (!state) return null

    const MENU_DIMENSIONS = { width: 192, height: 220 } as const
    const { x, y } = state.screenPosition
    const viewportWidth = typeof window === 'undefined' ? Number.MAX_SAFE_INTEGER : window.innerWidth
    const viewportHeight = typeof window === 'undefined' ? Number.MAX_SAFE_INTEGER : window.innerHeight
    const adjustedX = x + MENU_DIMENSIONS.width > viewportWidth ? x - MENU_DIMENSIONS.width : x
    const adjustedY = y + MENU_DIMENSIONS.height > viewportHeight ? y - MENU_DIMENSIONS.height : y

    const items = [
        {
            icon: Info,
            label: 'Ver información',
            onClick: () => {
                onViewInfoAction()
                onCloseAction()
            },
        },
        {
            icon: Edit2,
            label: 'Editar',
            onClick: () => {
                onEditAction()
                onCloseAction()
            },
        },
        {
            icon: Copy,
            label: 'Copiar coordenadas',
            onClick: () => {
                onCopyCoordsAction()
                onCloseAction()
            },
        },
        {
            icon: ExternalLink,
            label: 'Ver en Google Maps',
            onClick: () => {
                onOpenInMapsAction()
                onCloseAction()
            },
        },
        {
            icon: Trash2,
            label: 'Eliminar',
            danger: true,
            onClick: () => {
                onDeleteAction()
                onCloseAction()
            },
        },
    ] as const

    if (isMobile) {
        return (
            <>
                <div
                    className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0"
                    onClick={onCloseAction}
                    aria-hidden="true"
                />
                <div
                    ref={menuRef}
                    className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-2xl border-t border-x border-border bg-popover shadow-2xl animate-in slide-in-from-bottom-8 duration-200"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                    <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                    {featureType && (
                        <div className="border-b border-border px-4 pt-2 pb-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {CONTEXT_MENU_LABELS[featureType]}
                            </p>
                        </div>
                    )}
                    <div className="py-2">
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={item.onClick}
                                className={cn(
                                    'flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors',
                                    'active:bg-accent',
                                    'danger' in item && item.danger && 'text-destructive active:bg-destructive/10',
                                )}
                            >
                                <item.icon className="size-5 shrink-0" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </>
        )
    }

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-48 overflow-hidden rounded-md border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: adjustedX, top: adjustedY }}
        >
            {featureType && (
                <div className="border-b border-border px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {CONTEXT_MENU_LABELS[featureType]}
                    </p>
                </div>
            )}
            <div className="py-1">
                {items.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                            'hover:bg-accent',
                            'danger' in item && item.danger && 'text-destructive hover:bg-destructive/10',
                        )}
                    >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
