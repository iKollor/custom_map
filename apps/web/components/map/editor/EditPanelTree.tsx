import { Tree, type NodeRendererProps, type MoveHandler } from 'react-arborist'
import { ChevronRight, GripVertical, FileText, Palette, FolderPlus, Edit2, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { HexColorPicker } from '@workspace/ui/components/color-picker'
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
import useMeasure from 'react-use-measure'
import { categoryColorById } from './helpers'
import { TYPE_ICONS } from './constants'
import { useMemo, useState, createContext, useContext, useCallback, memo, useEffect, useRef } from 'react'
import type { CategoryDef, ParsedFeature } from './types'

// ─── Tree node data model ───────────────────────────────────────────────────

export type TreeNodeData = {
    id: string
    name: string
    type: 'category' | 'feature'
    categoryData?: CategoryDef
    featureData?: ParsedFeature
    /** Recursive count of all descendant features. Only set for categories. */
    usedCount?: number
    inheritedColor?: string
    children?: TreeNodeData[]
}

// ─── Props ──────────────────────────────────────────────────────────────────

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

// ─── Context (avoids prop-drilling through react-arborist render props) ─────

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

function useEditTreeContext(): EditTreeContextValue {
    const ctx = useContext(EditTreeContext)
    if (!ctx) throw new Error('TreeNodeRenderer must be used within EditTreeContext')
    return ctx
}

// ─── Tree data builder ──────────────────────────────────────────────────────

/**
 * Build the tree data structure for react-arborist from flat categories + features.
 * Computes recursive usedCount via a post-order traversal.
 */
function buildTreeData(categories: CategoryDef[], features: ParsedFeature[]): TreeNodeData[] {
    const root: TreeNodeData[] = []
    const byId = new Map<string, TreeNodeData>()

    // 1. Create category nodes
    for (const cat of categories) {
        byId.set(cat.id, {
            id: cat.id,
            name: cat.name,
            type: 'category',
            categoryData: cat,
            inheritedColor: categoryColorById(cat.id, categories),
            usedCount: 0,
            children: [],
        })
    }

    // 2. Place feature nodes under their category (or root)
    for (const f of features) {
        const node: TreeNodeData = {
            id: f._id,
            name: f.name,
            type: 'feature',
            featureData: f,
            children: undefined, // leaf node
        }

        const parent = f.categoryId ? byId.get(f.categoryId) : undefined
        if (parent) {
            parent.children!.push(node)
        } else {
            root.push(node)
        }
    }

    // 3. Nest categories under their parents (or root)
    for (const cat of categories) {
        const node = byId.get(cat.id)!
        const parent = cat.parentId ? byId.get(cat.parentId) : undefined
        if (parent) {
            parent.children!.push(node)
        } else {
            root.push(node)
        }
    }

    // 4. Post-order traversal to compute recursive feature counts
    const computeCount = (n: TreeNodeData): number => {
        if (n.type === 'feature') return 1
        let total = 0
        for (const child of n.children ?? []) {
            total += computeCount(child)
        }
        n.usedCount = total
        return total
    }
    for (const node of root) {
        computeCount(node)
    }

    return root
}

// ─── Main component ─────────────────────────────────────────────────────────

const ROW_HEIGHT = 36

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
}: EditPanelTreeProps) {
    const [ref, bounds] = useMeasure()
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [colorPickerId, setColorPickerId] = useState<string | null>(null)
    const treeRef = useRef<any>(null)

    const data = useMemo(
        () => buildTreeData(categories, features),
        [categories, features],
    )

    const categoryIdSet = useMemo(
        () => new Set(categories.map(c => c.id)),
        [categories],
    )

    const handleMove: MoveHandler<TreeNodeData> = useCallback(({ dragIds, parentId }) => {
        for (const draggedId of dragIds) {
            if (categoryIdSet.has(draggedId)) {
                onSetCategoryParent(draggedId, parentId ?? null)
            } else {
                onSetFeatureCategory(draggedId, parentId ?? null)
            }
        }
    }, [categoryIdSet, onSetCategoryParent, onSetFeatureCategory])

    const disableDrop = useCallback(
        ({ parentNode }: { parentNode: { data: TreeNodeData } }) =>
            parentNode.data.type === 'feature',
        [],
    )

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
        selectedFeatureId: selectedFeatureId ?? null,
    }), [
        renamingId, renameValue, colorPickerId,
        onRenameCategory, onRecolorCategory, onAddSubcategory,
        onDeleteCategory, onEditFeature, onDeleteFeature,
        onSelectFeature, selectedFeatureId,
    ])

    // Open ancestors & scroll into view (centered) when selectedFeatureId changes
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

        // Wait for react-arborist and useMeasure to be ready
        let attempt = 0
        const maxAttempts = 15
        const tryScroll = () => {
            attempt++
            try {
                if (bounds.height === 0) throw new Error('bounds not ready')

                const freshNode = tree.get(selectedFeatureId)
                if (!freshNode) throw new Error('node missing')
                if (freshNode.rowIndex == null || freshNode.rowIndex < 0) {
                    throw new Error('rowIndex not ready')
                }

                if (tree.listEl?.current) {
                    tree.listEl.current.style.scrollBehavior = 'smooth'
                }

                tree.scrollTo(selectedFeatureId, 'center')
                return
            } catch { /* retry */ }
            if (attempt < maxAttempts) {
                timerId = window.setTimeout(tryScroll, 100)
            }
        }
        let timerId = window.setTimeout(tryScroll, 100)
        return () => window.clearTimeout(timerId)
    }, [selectedFeatureId, bounds.height])

    return (
        <EditTreeContext.Provider value={contextValue}>
            <div className="flex min-h-0 flex-1 flex-col" ref={ref} id="edit-panel-tree-container">
                <Tree<TreeNodeData>
                    ref={treeRef}
                    data={data}
                    width={bounds.width}
                    height={bounds.height}
                    indent={20}
                    rowHeight={ROW_HEIGHT}
                    onMove={handleMove}
                    disableDrop={disableDrop}
                    searchTerm=""
                    padding={8}
                >
                    {TreeNodeRenderer}
                </Tree>
            </div>
        </EditTreeContext.Provider>
    )
}

// ─── Category color popover ─────────────────────────────────────────────────

function CategoryColorPopover({
    id,
    inheritedColor,
    initialColor,
    onRecolorCategory,
    colorPickerId,
    setColorPickerId,
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
                    onClick={(e) => e.stopPropagation()}
                >
                    <Palette className="h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="flex w-64 flex-col items-center space-y-4 p-4"
                align="end"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-full">
                    <HexColorPicker
                        color={localColor}
                        onChange={setLocalColor}
                        className="w-full!"
                    />
                </div>
                <div className="mt-4 flex w-full gap-2">
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

// ─── Tree node renderer ─────────────────────────────────────────────────────

const TreeNodeRenderer = memo(function TreeNodeRenderer({
    node,
    style,
    dragHandle,
}: NodeRendererProps<TreeNodeData>) {
    const ctx = useEditTreeContext()

    const { data, isOpen } = node
    const isCategory = data.type === 'category'
    const inheritedColor = data.inheritedColor || '#40a7f4'
    const state = node.state as { isOverDropTarget?: boolean }
    const isOver = state?.isOverDropTarget
    const isHighlighted = !isCategory && ctx.selectedFeatureId === data.id

    return (
        <div
            style={style}
            className={`group flex items-center pr-3 py-1 transition-colors relative
                ${isOver ? 'bg-primary/10' : 'hover:bg-accent/40'}
                ${node.isSelected && !isHighlighted ? 'bg-accent/60' : ''}
                ${isHighlighted ? 'bg-[#6e00a3]/15 ring-1 ring-[#6e00a3]/30' : ''}`}
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
                    } else if (data.featureData && ctx.onSelectFeature) {
                        ctx.onSelectFeature(data.featureData._id)
                    }
                }}
            >
                {isCategory ? (
                    <CategoryNodeContent
                        node={node}
                        data={data}
                        isOpen={isOpen}
                        inheritedColor={inheritedColor}
                    />
                ) : (
                    <FeatureNodeContent data={data} />
                )}
            </button>

            {/* Actions (visible on hover) */}
            <div className="ml-2 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                {isCategory ? (
                    <CategoryActions data={data} inheritedColor={inheritedColor} />
                ) : (
                    <FeatureActions data={data} />
                )}
            </div>
        </div>
    )
})

// ─── Node sub-components ────────────────────────────────────────────────────

function CategoryNodeContent({
    node,
    data,
    isOpen,
    inheritedColor,
}: {
    node: any
    data: TreeNodeData
    isOpen: boolean
    inheritedColor: string
}) {
    const { renamingId, renameValue, setRenamingId, setRenameValue, onRenameCategory } =
        useEditTreeContext()

    return (
        <>
            <motion.span
                initial={false}
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="mr-2 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            >
                <ChevronRight className="h-4 w-4" />
            </motion.span>

            {renamingId === data.id ? (
                <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                        if (renameValue.trim()) onRenameCategory(data.id, renameValue.trim())
                        setRenamingId(null)
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') {
                            if (renameValue.trim()) onRenameCategory(data.id, renameValue.trim())
                            setRenamingId(null)
                        }
                        if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="h-6 min-w-0 flex-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="truncate text-xs font-medium text-foreground">{data.name}</span>
            )}

            {data.usedCount !== undefined && (
                <span className="ml-auto flex items-center gap-2">
                    <span
                        className="flex h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: inheritedColor }}
                    />
                    <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/60">
                        {data.usedCount}
                    </span>
                </span>
            )}
        </>
    )
}

function FeatureNodeContent({ data }: { data: TreeNodeData }) {
    const { renamingId, renameValue, setRenamingId, setRenameValue } = useEditTreeContext()

    return (
        <>
            <span className="mr-2 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground">
                {data.featureData && TYPE_ICONS[data.featureData.type]
                    ? TYPE_ICONS[data.featureData.type]
                    : <FileText className="h-4 w-4" />}
            </span>

            {renamingId === data.id ? (
                <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => setRenamingId(null)}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter' || e.key === 'Escape') setRenamingId(null)
                    }}
                    className="h-6 min-w-0 flex-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    {data.name}
                </span>
            )}
        </>
    )
}

function CategoryActions({
    data,
    inheritedColor,
}: {
    data: TreeNodeData
    inheritedColor: string
}) {
    const {
        colorPickerId,
        setColorPickerId,
        onRecolorCategory,
        onAddSubcategory,
        setRenamingId,
        setRenameValue,
        onDeleteCategory,
    } = useEditTreeContext()

    return (
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
                onClick={(e) => {
                    e.stopPropagation()
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
                onClick={(e) => {
                    e.stopPropagation()
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
                        onClick={(e) => e.stopPropagation()}
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
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => onDeleteCategory(data.id)}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function FeatureActions({ data }: { data: TreeNodeData }) {
    const { onEditFeature, onDeleteFeature } = useEditTreeContext()

    return (
        <>
            <Button
                type="button"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation()
                    if (data.featureData) onEditFeature(data.featureData)
                }}
                title="Editar"
            >
                <Edit2 className="h-3 w-3" />
            </Button>
            <Button
                type="button"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-destructive"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation()
                    if (data.featureData) onDeleteFeature(data.featureData._id)
                }}
                title="Eliminar"
            >
                <Trash2 className="h-3 w-3" />
            </Button>
        </>
    )
}
