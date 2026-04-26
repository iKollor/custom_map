import { Tree, NodeRendererProps, MoveHandler } from 'react-arborist'
import { ChevronRight, GripVertical, FileText, Palette, FolderPlus, Edit2, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { HexColorPicker } from '@workspace/ui/components/color-picker'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@workspace/ui/components/alert-dialog'
import useMeasure from 'react-use-measure'
import { categoryColorById } from './helpers'
import { TYPE_ICONS } from './constants'
import { useMemo, useState, createContext, useContext, useCallback, memo, useEffect, useRef } from 'react'
import type { CategoryDef, ParsedFeature } from './types'

export type TreeNodeData = {
    id: string
    name: string
    type: 'category' | 'feature'
    categoryData?: CategoryDef
    featureData?: ParsedFeature
    usedCount?: number
    inheritedColor?: string
    children?: TreeNodeData[]
}

interface EditPanelTreeProps {
    features: ParsedFeature[]
    categories: CategoryDef[]
    onSetCategoryParent: (id: string, parentId: string | null) => void
    onSetFeatureCategory: (id: string, categoryId: string | null) => void
    onRenameCategory: (id: string, name: string) => void
    onRecolorCategory: (id: string, color: string) => void
    onAddSubcategory: (parentId: string) => void
    onDeleteCategory: (id: string) => void
    onEditFeature: (feature: ParsedFeature) => void
    onDeleteFeature: (id: string) => void
    onSelectFeature?: (featureId: string) => void
    selectedFeatureId?: string | null
    onClearSelectedFeature?: () => void
}

interface EditTreeContextValue {
    renamingId: string | null
    renameValue: string
    setRenamingId: (id: string | null) => void
    setRenameValue: (val: string) => void
    colorPickerId: string | null
    setColorPickerId: (id: string | null) => void
    onRenameCategory: (id: string, name: string) => void
    onRecolorCategory: (id: string, color: string) => void
    onAddSubcategory: (parentId: string) => void
    onDeleteCategory: (id: string) => void
    onEditFeature: (feature: ParsedFeature) => void
    onDeleteFeature: (id: string) => void
    onSelectFeature: ((featureId: string) => void) | undefined
    selectedFeatureId: string | null
}



const EditTreeContext = createContext<EditTreeContextValue | null>(null)

export function EditPanelTree({
    features,
    categories,
    onSetCategoryParent,
    onSetFeatureCategory,
    onRenameCategory,
    onRecolorCategory,
    onAddSubcategory,
    onDeleteCategory,
    onEditFeature,
    onDeleteFeature,
    onSelectFeature,
    selectedFeatureId,
    onClearSelectedFeature
}: EditPanelTreeProps) {
    const [ref, bounds] = useMeasure()
    const [searchTerm] = useState('')
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [colorPickerId, setColorPickerId] = useState<string | null>(null)

    const data = useMemo(() => {
        const root: TreeNodeData[] = []
        const byId = new Map<string, TreeNodeData>()

        for (const cat of categories) {
            byId.set(cat.id, {
                id: cat.id,
                name: cat.name,
                type: 'category',
                categoryData: cat,
                inheritedColor: categoryColorById(cat.id, categories),
                usedCount: features.filter(f => f.categoryId === cat.id).length,
                children: []
            })
        }

        for (const f of features) {
            const node: TreeNodeData = {
                id: f._id,
                name: f.name,
                type: 'feature',
                featureData: f,
                children: undefined // Features cannot have children (leaf node)
            }

            if (f.categoryId && byId.has(f.categoryId)) {
                byId.get(f.categoryId)!.children!.push(node)
            } else {
                root.push(node)
            }
        }

        for (const cat of categories) {
            const node = byId.get(cat.id)!
            if (cat.parentId && byId.has(cat.parentId)) {
                byId.get(cat.parentId)!.children!.push(node)
            } else {
                root.push(node)
            }
        }

        return root
    }, [categories, features])

    const handleMove: MoveHandler<TreeNodeData> = useCallback(({ dragIds, parentId }) => {
        for (const draggedId of dragIds) {
            const isDraggingCategory = categories.some(c => c.id === draggedId)
            if (isDraggingCategory) {
                onSetCategoryParent(draggedId, parentId ?? null)
            } else {
                onSetFeatureCategory(draggedId, parentId ?? null)
            }
        }
    }, [categories, onSetCategoryParent, onSetFeatureCategory])

    const disableDrop = useCallback(({ parentNode }: any) => parentNode.data.type === 'feature', [])

    const contextValue = useMemo<EditTreeContextValue>(() => ({
        renamingId,
        renameValue,
        setRenamingId,
        setRenameValue,
        colorPickerId,
        setColorPickerId,
        onRenameCategory,
        onRecolorCategory,
        onAddSubcategory,
        onDeleteCategory,
        onEditFeature,
        onDeleteFeature,
        onSelectFeature,
        selectedFeatureId: selectedFeatureId ?? null
    }), [renamingId, renameValue, colorPickerId, onRenameCategory, onRecolorCategory, onAddSubcategory, onDeleteCategory, onEditFeature, onDeleteFeature, onSelectFeature, selectedFeatureId])

    const treeRef = useRef<any>(null)

    // Open ancestors & scroll into view (centered) when selectedFeatureId changes
    const ROW_HEIGHT = 36
    useEffect(() => {
        if (!selectedFeatureId || !treeRef.current) return
        const tree = treeRef.current
        const node = tree.get(selectedFeatureId)
        if (!node) return

        // Deselect any tree-internal selection so we don't show two
        // competing highlights (tree multi-select vs map highlight).
        tree.deselectAll()

        // Open all parent nodes so the feature row exists in the DOM
        let parent = node.parent
        while (parent && parent.id !== '__REACT_ARBORIST_INTERNAL_ROOT__') {
            if (!parent.isOpen) parent.open()
            parent = parent.parent
        }

        // Scroll the row to the vertical centre of the container.
        // react-arborist virtualises rows, so we need to wait until the
        // tree re-renders after opening ancestors before the row exists.
        let attempt = 0
        const maxAttempts = 5
        const tryScroll = () => {
            attempt++
            try {
                const freshNode = tree.get(selectedFeatureId)
                if (!freshNode) throw new Error('node missing')

                // Find the scroll container: react-arborist renders a
                // div[role="tree"] > div (the scroll wrapper).
                const listEl: HTMLElement | null =
                    (tree.listEl as HTMLElement | undefined) ?? // public in some versions
                    document.querySelector(`[role="tree"][data-testid]`)?.parentElement ?? null

                if (listEl) {
                    const rowTop = freshNode.rowIndex * ROW_HEIGHT
                    const centeredTop = rowTop - (bounds.height / 2) + (ROW_HEIGHT / 2)
                    listEl.scrollTop = Math.max(0, centeredTop)
                } else {
                    // Fallback: use the built-in scrollTo (won't centre)
                    freshNode.scrollTo()
                }
                return
            } catch { /* ignore */ }
            if (attempt < maxAttempts) {
                timerId = window.setTimeout(tryScroll, 80)
            }
        }
        let timerId = window.setTimeout(tryScroll, 30)
        return () => window.clearTimeout(timerId)
    }, [selectedFeatureId, bounds.height])

    return (
        <EditTreeContext.Provider value={contextValue}>
            <div className="flex min-h-0 flex-1 flex-col" ref={ref}>
                <Tree<TreeNodeData>
                    ref={treeRef}
                    data={data}
                    width={bounds.width}
                    height={bounds.height}
                    indent={20}
                    rowHeight={36}
                    onMove={handleMove}
                    disableDrop={disableDrop}
                    searchTerm={searchTerm}
                    padding={8}
                >
                    {TreeNodeRenderer}
                </Tree>
            </div>
        </EditTreeContext.Provider>
    )
}

function CategoryColorPopover({
    id,
    inheritedColor,
    initialColor,
    onRecolorCategory,
    colorPickerId,
    setColorPickerId
}: {
    id: string
    inheritedColor?: string
    initialColor?: string
    onRecolorCategory: (id: string, color: string) => void
    colorPickerId: string | null
    setColorPickerId: (id: string | null) => void
}) {
    const open = colorPickerId === id
    const fallbackColor = initialColor || inheritedColor || '#ffffff'
    const [localColor, setLocalColor] = useState(fallbackColor)

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setLocalColor(fallbackColor)
                    setColorPickerId(id)
                } else {
                    setColorPickerId(null)
                    // If closed without hitting "Heredar" button, apply the color
                    // But we won't auto-apply here just in case they cancelled. Let's let the save button do it, 
                    // or auto-save if they interacted and clicked away.
                    if (localColor !== fallbackColor) {
                        onRecolorCategory(id, localColor)
                    }
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground"
                    variant="ghost"
                    title="Cambiar color"
                    style={{ color: fallbackColor }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <Palette className="h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-4 p-4 flex flex-col items-center" align="end" onClick={(e) => e.stopPropagation()}>
                <div className="w-full">
                    <HexColorPicker
                        color={localColor}
                        onChange={setLocalColor}
                        className="w-full!"
                    />
                </div>
                <div className="flex w-full gap-2 mt-4">
                    <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="flex-1 text-xs"
                        onClick={() => {
                            onRecolorCategory(id, localColor)
                            setColorPickerId(null)
                        }}
                    >
                        Guardar
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => {
                            onRecolorCategory(id, '')
                            setColorPickerId(null)
                        }}
                    >
                        Heredar
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

const TreeNodeRenderer = memo(function TreeNodeRenderer({ node, style, dragHandle }: NodeRendererProps<TreeNodeData>) {
    const ctx = useContext(EditTreeContext)
    if (!ctx) throw new Error('TreeNodeRenderer must be used within EditTreeContext')

    const {
        renamingId,
        renameValue,
        setRenamingId,
        setRenameValue,
        colorPickerId,
        setColorPickerId,
        onRenameCategory,
        onRecolorCategory,
        onAddSubcategory,
        onDeleteCategory,
        onEditFeature,
        onDeleteFeature,
        onSelectFeature,
        selectedFeatureId
    } = ctx

    const { data, isOpen } = node
    const isCategory = data.type === 'category'
    const inheritedColor = data.inheritedColor || '#40a7f4'
    const state = node.state as { isOverDropTarget?: boolean }; // safe since internal arbor props are obscured
    const isOver = state && state.isOverDropTarget;
    const isHighlighted = !isCategory && selectedFeatureId === data.id;

    return (
        <div
            style={style}
            className={`group flex items-center pr-3 py-1 transition-colors relative ${isOver ? 'bg-primary/10' : 'hover:bg-accent/40'} ${node.isSelected && !isHighlighted ? 'bg-accent/60' : ''} ${isHighlighted ? 'bg-[#6e00a3]/15 ring-1 ring-[#6e00a3]/30' : ''}`}
        >
            {/* Drag Handle */}
            <div
                ref={dragHandle}
                className="cursor-grab p-1 text-muted-foreground/30 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <GripVertical className="h-3.5 w-3.5" />
            </div>

            {/* Main Content */}
            <button
                type="button"
                className="flex min-w-0 flex-1 items-center py-1 text-left"
                onClick={() => {
                    if (isCategory) {
                        node.toggle()
                    } else if (data.featureData && onSelectFeature) {
                        onSelectFeature(data.featureData._id)
                    }
                }}
            >
                {isCategory ? (
                    <>
                        <motion.span
                            initial={false}
                            animate={{ rotate: isOpen ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="shrink-0 mr-2 text-muted-foreground transition-colors group-hover:text-foreground"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </motion.span>
                        {renamingId === data.id ? (
                            <Input
                                autoFocus
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onBlur={() => {
                                    if (renameValue.trim()) onRenameCategory(data.id, renameValue.trim())
                                    setRenamingId(null)
                                }}
                                onKeyDown={(event) => {
                                    event.stopPropagation()
                                    if (event.key === 'Enter') {
                                        if (renameValue.trim()) onRenameCategory(data.id, renameValue.trim())
                                        setRenamingId(null)
                                    }
                                    if (event.key === 'Escape') setRenamingId(null)
                                }}
                                className="h-6 min-w-0 flex-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="truncate text-xs font-medium text-foreground">{data.name}</span>
                        )}

                        {/* Visual info specifically for categories */}
                        {data.usedCount !== undefined && (
                            <span className="ml-auto flex items-center gap-2">
                                <span
                                    className="flex shrink-0 h-2 w-2 rounded-full"
                                    style={{ backgroundColor: inheritedColor }}
                                />
                                <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground/60">{data.usedCount}</span>
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        <span className="shrink-0 mr-2 text-muted-foreground/60 transition-colors group-hover:text-foreground">
                            {data.featureData && TYPE_ICONS[data.featureData.type] ? TYPE_ICONS[data.featureData.type] : <FileText className="h-4 w-4" />}
                        </span>
                        {renamingId === data.id ? (
                            <Input
                                autoFocus
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onBlur={() => {
                                    setRenamingId(null)
                                }}
                                onKeyDown={(event) => {
                                    event.stopPropagation()
                                    if (event.key === 'Enter' || event.key === 'Escape') setRenamingId(null)
                                }}
                                className="h-6 min-w-0 flex-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">{data.name}</span>
                        )}
                    </>
                )}
            </button>

            {/* Actions */}
            <div className="ml-2 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                {isCategory ? (
                    <>
                        <CategoryColorPopover
                            id={data.id}
                            inheritedColor={inheritedColor}
                            initialColor={data.categoryData?.color}
                            onRecolorCategory={onRecolorCategory}
                            colorPickerId={colorPickerId}
                            setColorPickerId={setColorPickerId}
                        />

                        <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground"
                            variant="ghost"
                            title="Nueva subcarpeta"
                            onClick={(event) => {
                                event.stopPropagation()
                                onAddSubcategory(data.id)
                            }}
                        >
                            <FolderPlus className="h-3 w-3" />
                        </Button>

                        <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground"
                            variant="ghost"
                            onClick={(event) => {
                                event.stopPropagation()
                                setRenamingId(data.id)
                                setRenameValue(data.name)
                            }}
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-destructive"
                                    variant="ghost"
                                    title="Eliminar carpeta"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar carpeta</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Se eliminará {data.name}. Los elementos conservarán su categoría textual.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => onDeleteCategory(data.id)}>
                                        Eliminar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                ) : (
                    <>
                        <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); if (data.featureData) onEditFeature(data.featureData) }}
                            title="Editar"
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-destructive"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); if (data.featureData) onDeleteFeature(data.featureData._id) }}
                            title="Eliminar"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
})
