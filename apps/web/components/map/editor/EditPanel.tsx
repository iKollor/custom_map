import {
    Check,
    Layers,
    MousePointerClick,
    Pencil,
    Plus,
    X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import {
    Tabs,
    TabsContent,
    TabsContents,
    TabsList,
    TabsTrigger,
} from '@/components/animate-ui/components/radix/tabs'
import { FEATURE_TYPES, TYPE_ICONS, TYPE_LABELS } from './constants'
import { EditPanelTree } from './EditPanelTree'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type { CategoryDef, DrawMode, ParsedFeature } from './types'

type EditTab = 'create' | 'organize'

interface EditPanelProps {
    drawMode: DrawMode
    pendingPoints: [number, number][]
    features: ParsedFeature[]
    categories: CategoryDef[]
    onSelectDrawMode: (mode: DrawMode) => void
    onFinishDraw: () => void
    onCancelDraw: () => void
    onAddPoint: (point: [number, number]) => void
    onEditFeature: (feature: ParsedFeature) => void
    onDeleteFeature: (id: string) => void
    onAddCategory: (parentId?: string | null) => void
    onRenameCategory: (id: string, name: string) => void
    onRecolorCategory: (id: string, color: string) => void
    onMoveCategory: (id: string, direction: 'up' | 'down') => void
    onSetCategoryParent: (id: string, parentId: string | null) => void
    onSetFeatureCategory: (id: string, categoryId: string | null) => void
    onDeleteCategory: (id: string) => void
    onSelectFeature?: (featureId: string) => void
    selectedFeatureId?: string | null
    onClearSelectedFeature?: () => void
}

export function EditPanel({
    drawMode,
    pendingPoints,
    features,
    categories,
    onSelectDrawMode,
    onFinishDraw,
    onCancelDraw,
    onAddPoint,
    onEditFeature,
    onDeleteFeature,
    onAddCategory,
    onRenameCategory,
    onRecolorCategory,
    onSetCategoryParent,
    onSetFeatureCategory,
    onDeleteCategory,
    onSelectFeature,
    selectedFeatureId,
    onClearSelectedFeature,
}: EditPanelProps) {
    const [activeTab, setActiveTab] = useState<EditTab>('create')
    const [coordInput, setCoordInput] = useState('')

    // Auto-switch to organize tab when a feature is selected on the map
    useEffect(() => {
        if (selectedFeatureId) setActiveTab('organize')
    }, [selectedFeatureId])
    const [coordError, setCoordError] = useState<string | null>(null)

    function parseLatLng(value: string): [number, number] | null {
        const parts = value
            .split(/[,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        if (parts.length !== 2) return null
        const lat = Number(parts[0])
        const lng = Number(parts[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
        return [lng, lat]
    }

    function handleSubmitCoord() {
        const parsed = parseLatLng(coordInput)
        if (!parsed) {
            setCoordError('Formato invalido. Usa: lat, lng')
            return
        }
        setCoordError(null)
        setCoordInput('')
        onAddPoint(parsed)
    }

    const tabs = [
        { key: 'create' as const, label: 'Crear', icon: <Plus className="h-3.5 w-3.5" /> },
        { key: 'organize' as const, label: 'Elementos', icon: <Layers className="h-3.5 w-3.5" /> },
    ]

    const drawInstructions: Record<string, string> = {
        point: 'Haz clic en el mapa para colocar el punto.',
        route: 'Haz clic para agregar vertices. Cuando termines pulsa "Finalizar".',
        section: 'Haz clic para agregar vertices. Cuando termines pulsa "Finalizar".',
    }

    return (
        <EditPanelShell selectedFeatureId={selectedFeatureId}>
            <div className="flex items-center gap-2 border-b border-[#6e00a3]/18 bg-linear-to-r from-[#6e00a3]/10 to-[#40a7f4]/12 px-4 py-3">
                <Pencil className="h-4 w-4 text-[#6e00a3]" />
                <span className="text-sm font-semibold text-[#4f2076] dark:text-[#d9b6fb]">Modo Edicion</span>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as EditTab)}
                className="flex min-h-0 flex-1 flex-col gap-0"
            >
                <TabsList className="w-full justify-around rounded-none border-b border-border bg-muted/40 p-1">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.key} value={tab.key} className="gap-1 text-xs">
                            {tab.icon}
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContents mode="layout" className="relative min-h-0 flex-1 overflow-hidden">
                    <TabsContent value="create" className="absolute inset-0 flex flex-col overflow-y-auto p-4 outline-none">
                        <div className="space-y-4">
                            {!drawMode ? (
                                <>
                                    <p className="text-xs text-muted-foreground">Elige el tipo de elemento a crear:</p>
                                    <div className="space-y-2">
                                        {FEATURE_TYPES.map((type, index) => (
                                            <motion.div
                                                key={type}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05, duration: 0.22 }}
                                            >
                                                <Button
                                                    type="button"
                                                    onClick={() => onSelectDrawMode(type)}
                                                    variant="outline"
                                                    className="h-auto w-full justify-start gap-3 rounded-2xl border-border/70 py-3 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#6e00a3]/40 hover:bg-[#6e00a3]/8"
                                                >
                                                    <span className="text-[#6e00a3] dark:text-[#cda7f4]">{TYPE_ICONS[type]}</span>
                                                    {TYPE_LABELS[type]}
                                                </Button>
                                            </motion.div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2 rounded-lg border border-[#40a7f4]/25 bg-[#40a7f4]/10 px-3 py-2.5">
                                        <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-[#1679bf] dark:text-[#7ec8ff]" />
                                        <p className="text-xs text-[#1a5f96] dark:text-[#8fd2ff]">{drawInstructions[drawMode]}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            O ingresa coordenadas (lat, lng)
                                        </label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={coordInput}
                                                onChange={(e) => {
                                                    setCoordInput(e.target.value)
                                                    if (coordError) setCoordError(null)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        handleSubmitCoord()
                                                    }
                                                }}
                                                placeholder="-2.197422, -79.938401"
                                                className="h-8 font-mono text-xs"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleSubmitCoord}
                                                disabled={!coordInput.trim()}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        {coordError && (
                                            <p className="text-xs text-red-500">{coordError}</p>
                                        )}
                                    </div>

                                    {pendingPoints.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Puntos:{' '}
                                                <span className="font-bold text-foreground">{pendingPoints.length}</span>
                                            </p>
                                            {pendingPoints.map((point, index) => (
                                                <div
                                                    key={`${point[0]}-${point[1]}-${index}`}
                                                    className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground"
                                                >
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    {point[0].toFixed(5)}, {point[1].toFixed(5)}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {(drawMode === 'route' || drawMode === 'section') &&
                                            pendingPoints.length >= 2 && (
                                                <Button
                                                    type="button"
                                                    onClick={onFinishDraw}
                                                    className="flex-1"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    Finalizar
                                                </Button>
                                            )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={onCancelDraw}
                                            className="flex-1"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="organize" className="absolute inset-0 flex flex-col pt-1 pb-0 outline-none">
                        <div className="px-3 shrink-0 flex items-center justify-between pb-2 pt-1 border-b border-border/40">
                            <span className="text-xs font-medium text-muted-foreground">Gestionar elementos</span>
                            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAddCategory(null)}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Nueva Carpeta
                            </Button>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col relative w-full mt-2">
                            <EditPanelTree
                                features={features}
                                categories={categories}
                                onSetCategoryParent={onSetCategoryParent}
                                onSetFeatureCategory={onSetFeatureCategory}
                                onRenameCategory={onRenameCategory}
                                onRecolorCategory={onRecolorCategory}
                                onAddSubcategory={onAddCategory}
                                onDeleteCategory={onDeleteCategory}
                                onEditFeature={onEditFeature}
                                onDeleteFeature={onDeleteFeature}
                                onSelectFeature={onSelectFeature}
                                selectedFeatureId={selectedFeatureId}
                                onClearSelectedFeature={onClearSelectedFeature}
                            />
                        </div>
                    </TabsContent>
                </TabsContents>
            </Tabs>
        </EditPanelShell>
    )
}

/**
 * EditPanelShell - Contenedor responsive del modo edición.
 * - Mobile: bottom sheet con 3 snap points y drag nativo via touch events.
 * - Desktop: panel flotante a la derecha con animación de entrada.
 */
function EditPanelShell({ children, selectedFeatureId }: { children: ReactNode, selectedFeatureId?: string | null }) {
    const isMobile = useIsMobile()

    if (isMobile) {
        return <MobileBottomSheet selectedFeatureId={selectedFeatureId}>{children}</MobileBottomSheet>
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-14 right-3 bottom-16 z-20 flex w-80 flex-col overflow-hidden rounded-2xl border border-[#6e00a3]/28 bg-background/95 shadow-[0_24px_60px_-30px_rgba(110,0,163,0.52)] ring-1 ring-black/5 backdrop-blur-md"
        >
            {children}
        </motion.div>
    )
}

/** Snap heights as fractions of viewport height */
const SNAP_COLLAPSED = 0.18  // ~18vh – header + tabs visible
const SNAP_HALF = 0.50       // ~50vh
const SNAP_FULL = 0.85       // ~85vh

function MobileBottomSheet({ children, selectedFeatureId }: { children: ReactNode, selectedFeatureId?: string | null }) {
    const sheetRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<{ startY: number; startH: number } | null>(null)
    const [heightVh, setHeightVh] = useState(SNAP_COLLAPSED)
    const [isDragging, setIsDragging] = useState(false)

    // Expand the bottom sheet automatically when a feature is selected
    useEffect(() => {
        if (selectedFeatureId && heightVh === SNAP_COLLAPSED) {
            setHeightVh(SNAP_HALF)
        }
    }, [selectedFeatureId, heightVh])

    // Convert vh fraction to px for current viewport
    const toPx = useCallback((vhFrac: number) => window.innerHeight * vhFrac, [])

    const snapTo = useCallback((targetVh: number) => {
        setHeightVh(targetVh)
    }, [])

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0]
        if (!touch) return
        dragRef.current = { startY: touch.clientY, startH: toPx(heightVh) }
        setIsDragging(true)
    }, [heightVh, toPx])

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current) return
        const touch = e.touches[0]
        if (!touch) return
        e.preventDefault() // prevent page scroll
        const dy = dragRef.current.startY - touch.clientY  // positive = swipe up
        const newH = Math.max(
            toPx(SNAP_COLLAPSED),
            Math.min(toPx(SNAP_FULL), dragRef.current.startH + dy)
        )
        setHeightVh(newH / window.innerHeight)
    }, [toPx])

    const onTouchEnd = useCallback(() => {
        setIsDragging(false)
        if (!dragRef.current) return
        dragRef.current = null

        // Snap to nearest point
        const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL] as const
        let nearest: number = SNAP_COLLAPSED
        let minDist = Math.abs(heightVh - SNAP_COLLAPSED)
        for (const s of snaps) {
            const d = Math.abs(heightVh - s)
            if (d < minDist) { minDist = d; nearest = s }
        }
        snapTo(nearest)
    }, [heightVh, snapTo])

    return (
        <div
            ref={sheetRef}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-x border-[#6e00a3]/28 bg-background/98 shadow-[0_-18px_50px_-20px_rgba(110,0,163,0.45)] backdrop-blur-md"
            style={{
                height: `${heightVh * 100}vh`,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                overscrollBehavior: 'contain',
                transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >
            {/* Drag handle – touch-action:none prevents browser scroll */}
            <div
                className="flex w-full shrink-0 cursor-grab items-center justify-center py-2.5 active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
            </div>
        </div>
    )
}

