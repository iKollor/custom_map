'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { X, Edit2, Trash2, Plus, MapPin, Route, Square, Copy, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { cn } from '@workspace/ui/lib/utils'

import { useIsMobile } from '@/hooks/use-is-mobile'
import { featureCategoryName, categoryBreadcrumb, type CategoryDef } from './editor'
import type { ParsedFeature } from './editor'

type FeatureInfoPanelProps = {
    featureId: string | null
    features: ParsedFeature[]
    categories: CategoryDef[]
    onCloseAction: () => void
    onEditAction: (feature: ParsedFeature) => void
    onDeleteAction: (id: string) => void
    onUpdateCustomFieldsAction: (id: string, customFields: Record<string, string>) => void
}

const TYPE_LABELS = { point: 'Punto', route: 'Ruta', section: 'Sector' } as const
const TYPE_ICONS = { point: MapPin, route: Route, section: Square }
const STANDARD_FIELDS = new Set(['type', 'name', 'category', 'subcategory', 'description', 'coordinates'])

function haversineKm(start: [number, number], end: [number, number]) {
    const R = 6371
    const dLat = ((end[1] - start[1]) * Math.PI) / 180
    const dLng = ((end[0] - start[0]) * Math.PI) / 180
    const lat1 = (start[1] * Math.PI) / 180
    const lat2 = (end[1] * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function routeDistanceKm(feature: ParsedFeature) {
    const rawDistance =
        feature.customFields?.distance_km ??
        feature.customFields?.distancia_km ??
        feature._raw?.distance_km ??
        feature._raw?.distancia_km

    if (rawDistance) {
        const parsed = Number(String(rawDistance).replace(/[^\d.]/g, ''))
        if (Number.isFinite(parsed) && parsed > 0) return parsed
    }

    const coords = feature._coords
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return 0

    const line = coords as [number, number][]
    let total = 0
    for (let index = 1; index < line.length; index += 1) {
        const from = line[index - 1]
        const to = line[index]
        if (!from || !to) continue
        total += haversineKm(from, to)
    }
    return total
}

function routeEtaText(feature: ParsedFeature, distanceKm: number) {
    const rawEta =
        feature.customFields?.eta_min ??
        feature.customFields?.eta_minutes ??
        feature.customFields?.tiempo_estimado ??
        feature._raw?.eta_min ??
        feature._raw?.eta_minutes ??
        feature._raw?.tiempo_estimado

    if (rawEta) {
        const parsed = Number(String(rawEta).replace(/[^\d.]/g, ''))
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed >= 60 ? `${(parsed / 60).toFixed(1)} h` : `${Math.round(parsed)} min`
        }
    }

    const averageSpeedKmH = 32
    const minutes = (distanceKm / averageSpeedKmH) * 60
    return minutes >= 60 ? `${(minutes / 60).toFixed(1)} h aprox.` : `${Math.max(1, Math.round(minutes))} min aprox.`
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {children}
        </h3>
    )
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn('text-xs text-foreground', mono && 'font-mono break-all')}>{value}</p>
        </div>
    )
}

function PanelContent({
    feature,
    categories,
    onCloseAction,
    onEditAction,
    onDeleteAction,
    onUpdateCustomFieldsAction,
}: {
    feature: ParsedFeature
    categories: CategoryDef[]
    onCloseAction: () => void
    onEditAction: (f: ParsedFeature) => void
    onDeleteAction: (id: string) => void
    onUpdateCustomFieldsAction: (id: string, fields: Record<string, string>) => void
}) {
    const [addingField, setAddingField] = useState(false)
    const [newKey, setNewKey] = useState('')
    const [newValue, setNewValue] = useState('')
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editingValue, setEditingValue] = useState('')

    const customFields = useMemo(() => (feature.customFields as Record<string, string>) ?? {}, [feature.customFields])

    const handleAddField = useCallback(() => {
        const trimmedKey = newKey.trim()
        if (!trimmedKey) return
        onUpdateCustomFieldsAction(feature._id, { ...customFields, [trimmedKey]: newValue.trim() })
        setNewKey('')
        setNewValue('')
        setAddingField(false)
    }, [feature._id, customFields, newKey, newValue, onUpdateCustomFieldsAction])

    const handleDeleteField = useCallback(
        (key: string) => {
            const updated = { ...customFields }
            delete updated[key]
            onUpdateCustomFieldsAction(feature._id, updated)
        },
        [feature._id, customFields, onUpdateCustomFieldsAction],
    )

    const handleSaveEditField = useCallback(() => {
        if (!editingKey) return
        onUpdateCustomFieldsAction(feature._id, { ...customFields, [editingKey]: editingValue.trim() })
        setEditingKey(null)
        setEditingValue('')
    }, [feature._id, customFields, editingKey, editingValue, onUpdateCustomFieldsAction])

    const copyCoordinates = useCallback(() => {
        if (!feature._coords) return
        let text: string
        if (Array.isArray(feature._coords[0])) {
            text = (feature._coords as [number, number][])
                .map(([lng, lat]) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                .join('\n')
        } else {
            const [lng, lat] = feature._coords as [number, number]
            text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        }
        navigator.clipboard.writeText(text).catch(() => { })
    }, [feature._coords])

    const openInMaps = useCallback(() => {
        if (!feature._coords) return
        const firstCoord = Array.isArray(feature._coords[0])
            ? (feature._coords as [number, number][])[0]
            : (feature._coords as [number, number])
        if (!firstCoord) return
        window.open(
            `https://www.google.com/maps?q=${firstCoord[1]},${firstCoord[0]}`,
            '_blank',
            'noopener,noreferrer',
        )
    }, [feature._coords])

    const extraRawFields = Object.entries(feature._raw).filter(
        ([key, value]) => !STANDARD_FIELDS.has(key) && String(value).trim(),
    )

    const coordString = feature._coords
        ? Array.isArray(feature._coords[0])
            ? `${(feature._coords as [number, number][]).length} vértices`
            : `${(feature._coords as [number, number])[0].toFixed(5)}, ${(feature._coords as [number, number])[1].toFixed(5)}`
        : null

    const routeDistance = feature.type === 'route' ? routeDistanceKm(feature) : null
    const routeEta = feature.type === 'route' && routeDistance !== null ? routeEtaText(feature, routeDistance) : null

    const TypeIcon = TYPE_ICONS[feature.type]

    return (
        <>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                            <TypeIcon className="size-3 shrink-0 text-muted-foreground" />
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {TYPE_LABELS[feature.type]}
                            </span>
                        </div>
                        <p className="truncate text-sm font-semibold">{feature.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCloseAction}
                        className="shrink-0 rounded-sm p-1 hover:bg-muted"
                        aria-label="Cerrar panel"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Quick actions */}
                <div className="mt-2 flex gap-1.5">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-xs"
                        onClick={() => onEditAction(feature)}
                    >
                        <Edit2 className="mr-1 size-3" />
                        Editar
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            onDeleteAction(feature._id)
                            onCloseAction()
                        }}
                        title="Eliminar"
                    >
                        <Trash2 className="size-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={copyCoordinates}
                        title="Copiar coordenadas"
                    >
                        <Copy className="size-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={openInMaps}
                        title="Abrir en Google Maps"
                    >
                        <ExternalLink className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="space-y-4 overflow-y-auto p-4">
                {/* Basic info */}
                <section className="space-y-2">
                    <FieldRow label="Categoría" value={featureCategoryName(feature, categories) || '—'} />
                    {feature.description && <FieldRow label="Descripción" value={feature.description} />}
                    {coordString && <FieldRow label="Coordenadas" value={coordString} mono />}
                    {feature.type === 'route' && routeDistance !== null && (
                        <FieldRow label="Distancia" value={`${routeDistance.toFixed(2)} km`} />
                    )}
                    {feature.type === 'route' && routeEta && <FieldRow label="ETA" value={routeEta} />}
                </section>

                {/* Extra raw CSV fields */}
                {extraRawFields.length > 0 && (
                    <section>
                        <SectionTitle>Datos originales</SectionTitle>
                        <div className="mt-2 space-y-2">
                            {extraRawFields.map(([key, value]) => (
                                <FieldRow key={key} label={key} value={String(value)} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Custom fields */}
                <section>
                    <div className="flex items-center justify-between">
                        <SectionTitle>Campos personalizados</SectionTitle>
                        <button
                            type="button"
                            onClick={() => {
                                setAddingField(true)
                                setNewKey('')
                                setNewValue('')
                            }}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <Plus className="size-3" />
                            Agregar
                        </button>
                    </div>

                    {Object.keys(customFields).length === 0 && !addingField && (
                        <p className="mt-2 text-[11px] text-muted-foreground">Sin campos personalizados</p>
                    )}

                    <div className="mt-2 space-y-2">
                        {Object.entries(customFields).map(([key, value]) => (
                            <div key={key} className="group flex items-start gap-1.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                        {key}
                                    </p>
                                    {editingKey === key ? (
                                        <div className="mt-0.5 flex gap-1">
                                            <Input
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                className="h-6 text-xs"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEditField()
                                                    if (e.key === 'Escape') setEditingKey(null)
                                                }}
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={handleSaveEditField}
                                            >
                                                ✓
                                            </Button>
                                        </div>
                                    ) : (
                                        <p
                                            className="cursor-pointer text-xs text-foreground hover:underline"
                                            onClick={() => {
                                                setEditingKey(key)
                                                setEditingValue(value)
                                            }}
                                            title="Clic para editar"
                                        >
                                            {value || '—'}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteField(key)}
                                    className="mt-4 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                    aria-label={`Eliminar campo ${key}`}
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {addingField && (
                        <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
                            <Input
                                placeholder="Nombre del campo"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                            />
                            <Input
                                placeholder="Valor"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="h-7 text-xs"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddField()
                                }}
                            />
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    className="h-6 flex-1 text-xs"
                                    onClick={handleAddField}
                                    disabled={!newKey.trim()}
                                >
                                    Agregar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 flex-1 text-xs"
                                    onClick={() => setAddingField(false)}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </>
    )
}

export function FeatureInfoPanel({
    featureId,
    features,
    categories,
    onCloseAction,
    onEditAction,
    onDeleteAction,
    onUpdateCustomFieldsAction,
}: FeatureInfoPanelProps) {
    const feature = featureId ? (features.find((f) => f._id === featureId) ?? null) : null
    const isMobile = useIsMobile()
    const openedAtRef = useRef(0)

    useEffect(() => {
        if (!feature) return
        openedAtRef.current = Date.now()
    }, [feature?._id, feature])

    const handleBackdropClose = useCallback((event?: React.PointerEvent | React.MouseEvent) => {
        // Ignore the opening tap/click so the panel does not flicker-close
        // on the same interaction that selected the marker. Tap-outside still
        // works because real "outside" taps happen well after open.
        if (Date.now() - openedAtRef.current < 300) return
        event?.preventDefault()
        event?.stopPropagation()
        onCloseAction()
    }, [onCloseAction])

    return (
        <AnimatePresence>
            {feature && (
                <>
                    {isMobile && (
                        <motion.div
                            role="button"
                            tabIndex={0}
                            aria-label="Cerrar información"
                            className="fixed inset-0 z-20 bg-black/30"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            onPointerDown={handleBackdropClose}
                        />
                    )}

                    <motion.div
                        key={feature._id}
                        initial={isMobile ? { y: '100%', opacity: 0 } : { x: -16, opacity: 0 }}
                        animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
                        exit={isMobile ? { y: '100%', opacity: 0 } : { x: -16, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                            'z-30 flex flex-col overflow-hidden bg-background/98 shadow-[0_-18px_55px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5 backdrop-blur-md',
                            isMobile
                                ? 'fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t border-x border-border/80'
                                : 'absolute top-14 left-3 max-h-[calc(100vh-8rem)] w-72 rounded-2xl border border-border/80',
                        )}
                        style={isMobile ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
                    >
                        {isMobile && (
                            <div
                                className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
                                aria-hidden="true"
                            />
                        )}
                        <PanelContent
                            feature={feature}
                            categories={categories}
                            onCloseAction={onCloseAction}
                            onEditAction={onEditAction}
                            onDeleteAction={onDeleteAction}
                            onUpdateCustomFieldsAction={onUpdateCustomFieldsAction}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
