import {
    Check,
    ChevronDown,
    ChevronUp,
    Edit2,
    FolderOpen,
    Layers,
    MapPin,
    MousePointerClick,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@workspace/ui/components/alert-dialog'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@workspace/ui/components/popover'
import {
    Tabs,
    TabsContent,
    TabsContents,
    TabsList,
    TabsTrigger,
} from '@/components/animate-ui/components/radix/tabs'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { FEATURE_TYPES, PALETTE, TYPE_ICONS, TYPE_LABELS } from './constants'
import { categoryColor } from './helpers'
import type { CategoryDef, DrawMode, ParsedFeature } from './types'

type EditTab = 'create' | 'features' | 'categories'

interface EditPanelProps {
    drawMode: DrawMode
    pendingPoints: [number, number][]
    features: ParsedFeature[]
    categories: CategoryDef[]
    onSelectDrawMode: (mode: DrawMode) => void
    onFinishDraw: () => void
    onCancelDraw: () => void
    onEditFeature: (feature: ParsedFeature) => void
    onDeleteFeature: (id: string) => void
    onAddCategory: () => void
    onRenameCategory: (id: string, name: string) => void
    onRecolorCategory: (id: string, color: string) => void
    onMoveCategory: (id: string, direction: 'up' | 'down') => void
    onDeleteCategory: (id: string) => void
}

export function EditPanel({
    drawMode,
    pendingPoints,
    features,
    categories,
    onSelectDrawMode,
    onFinishDraw,
    onCancelDraw,
    onEditFeature,
    onDeleteFeature,
    onAddCategory,
    onRenameCategory,
    onRecolorCategory,
    onMoveCategory,
    onDeleteCategory,
}: EditPanelProps) {
    const [activeTab, setActiveTab] = useState<EditTab>('create')
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
    const [colorPickerId, setColorPickerId] = useState<string | null>(null)

    const tabs = [
        { key: 'create' as const, label: 'Crear', icon: <Plus className="h-3.5 w-3.5" /> },
        { key: 'features' as const, label: 'Elementos', icon: <Layers className="h-3.5 w-3.5" /> },
        { key: 'categories' as const, label: 'Categorias', icon: <FolderOpen className="h-3.5 w-3.5" /> },
    ]

    const featuresByCategory: Record<string, ParsedFeature[]> = {}
    for (const feature of features) {
        const category = feature.category || '(Sin categoria)'
            ; (featuresByCategory[category] ??= []).push(feature)
    }

    const drawInstructions: Record<string, string> = {
        point: 'Haz clic en el mapa para colocar el punto.',
        route: 'Haz clic para agregar vertices. Cuando termines pulsa "Finalizar".',
        section: 'Haz clic para agregar vertices. Cuando termines pulsa "Finalizar".',
    }

    function toggleCategory(category: string) {
        setExpandedCategories((prev) => {
            const next = new Set(prev)
            if (next.has(category)) next.delete(category)
            else next.add(category)
            return next
        })
    }

    return (
        <EditPanelShell>
            <div className="flex items-center gap-2 border-b border-[#6e00a3]/18 bg-linear-to-r from-[#6e00a3]/10 to-[#40a7f4]/12 px-4 py-3">
                <Pencil className="h-4 w-4 text-[#6e00a3]" />
                <span className="text-sm font-semibold text-[#4f2076] dark:text-[#d9b6fb]">Modo Edicion</span>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as EditTab)}
                className="flex min-h-0 flex-1 gap-0"
            >
                <TabsList className="w-full justify-around rounded-none border-b border-border bg-muted/40 p-1">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.key} value={tab.key} className="gap-1 text-xs">
                            {tab.icon}
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContents className="min-h-0 flex-1 overflow-y-auto">
                <TabsContent value="create" className="p-4">
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

                <TabsContent value="features" className="py-2">
                    {features.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                            No hay elementos. Crea uno desde la pestana Crear.
                        </p>
                    ) : (
                        Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
                            <div key={category}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => toggleCategory(category)}
                                    className="h-auto w-full justify-between rounded-none px-4 py-2"
                                >
                                    <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: categoryColor(category, categories) }}
                                        />
                                        {category}
                                        <span className="text-gray-400">({categoryFeatures.length})</span>
                                    </span>
                                    {expandedCategories.has(category) ? (
                                        <ChevronUp className="h-3 w-3 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="h-3 w-3 text-gray-400" />
                                    )}
                                </Button>
                                {expandedCategories.has(category) &&
                                    categoryFeatures.map((feature) => (
                                        <div
                                            key={feature._id}
                                            className="group flex items-center gap-2 border-t border-border/40 px-4 py-2 hover:bg-muted/40"
                                        >
                                            <span className="shrink-0 text-muted-foreground">
                                                {TYPE_ICONS[feature.type] ?? (
                                                    <MapPin className="h-3.5 w-3.5" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                                                {feature.name}
                                            </span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    type="button"
                                                    size="icon-xs"
                                                    variant="ghost"
                                                    onClick={() => onEditFeature(feature)}
                                                    title="Editar"
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button type="button" size="icon-xs" variant="ghost" title="Eliminar">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent size="sm">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Eliminar elemento</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta accion quitara a {feature.name} del proyecto actual.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                variant="destructive"
                                                                onClick={() => onDeleteFeature(feature._id)}
                                                            >
                                                                Eliminar
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="categories" className="py-2">
                    {categories.map((category, index) => {
                        const usedCount = features.filter((f) => f.category === category.name).length
                        return (
                            <div
                                key={category.id}
                                className="group flex items-center gap-2 border-b border-border/40 px-3 py-2 hover:bg-muted/40"
                            >
                                <Popover
                                    open={colorPickerId === category.id}
                                    onOpenChange={(nextOpen) => {
                                        setColorPickerId(nextOpen ? category.id : null)
                                    }}
                                >
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 border-white shadow transition-transform hover:scale-110"
                                            style={{ backgroundColor: category.color }}
                                            title="Cambiar color"
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 gap-3 p-3" align="start">
                                        <PopoverHeader>
                                            <PopoverTitle>Color de categoria</PopoverTitle>
                                            <PopoverDescription>
                                                Selecciona el color para {category.name}.
                                            </PopoverDescription>
                                        </PopoverHeader>
                                        <div className="flex flex-wrap gap-2">
                                            {PALETTE.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => {
                                                        onRecolorCategory(category.id, color)
                                                        setColorPickerId(null)
                                                    }}
                                                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                                                    style={{
                                                        backgroundColor: color,
                                                        borderColor:
                                                            category.color === color ? '#40A7F4' : 'white',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                {renamingId === category.id ? (
                                    <Input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(event) => setRenameValue(event.target.value)}
                                        onBlur={() => {
                                            if (renameValue.trim()) {
                                                onRenameCategory(category.id, renameValue.trim())
                                            }
                                            setRenamingId(null)
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                if (renameValue.trim()) {
                                                    onRenameCategory(category.id, renameValue.trim())
                                                }
                                                setRenamingId(null)
                                            }
                                            if (event.key === 'Escape') setRenamingId(null)
                                        }}
                                        className="h-7 min-w-0 flex-1 text-xs"
                                    />
                                ) : (
                                    <span
                                        className="min-w-0 flex-1 cursor-text truncate text-xs text-foreground"
                                        onDoubleClick={() => {
                                            setRenamingId(category.id)
                                            setRenameValue(category.name)
                                        }}
                                        title="Doble clic para renombrar"
                                    >
                                        {category.name}
                                    </span>
                                )}

                                <span className="shrink-0 text-xs text-muted-foreground">{usedCount}</span>

                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        type="button"
                                        size="icon-xs"
                                        variant="ghost"
                                        onClick={() => onMoveCategory(category.id, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-xs"
                                        variant="ghost"
                                        onClick={() => onMoveCategory(category.id, 'down')}
                                        disabled={index === categories.length - 1}
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-xs"
                                        variant="ghost"
                                        onClick={() => {
                                            setRenamingId(category.id)
                                            setRenameValue(category.name)
                                        }}
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="ghost"
                                                title={
                                                    usedCount > 0
                                                        ? `Usado en ${usedCount} elemento(s)`
                                                        : 'Eliminar'
                                                }
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent size="sm">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Eliminar categoria</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {usedCount > 0
                                                        ? `La categoria ${category.name} esta usada en ${usedCount} elemento(s).`
                                                        : `La categoria ${category.name} sera eliminada del proyecto actual.`}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    variant="destructive"
                                                    onClick={() => onDeleteCategory(category.id)}
                                                >
                                                    Eliminar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        )
                    })}

                    <div className="px-3 py-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onAddCategory}
                            className="w-full border-dashed text-xs"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Nueva categoria
                        </Button>
                    </div>
                </TabsContent>
                </TabsContents>
            </Tabs>
        </EditPanelShell>
    )
}

/**
 * EditPanelShell - Contenedor responsive del modo edición.
 * - Mobile: bottom sheet con altura ~85vh, drag-to-close estilo nativo.
 * - Desktop: panel flotante a la derecha con animación de entrada.
 */
function EditPanelShell({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <div
                className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-x border-[#6e00a3]/28 bg-background/98 shadow-[0_-18px_50px_-20px_rgba(110,0,163,0.45)] backdrop-blur-md"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                    {children}
                </motion.div>
            </div>
        )
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