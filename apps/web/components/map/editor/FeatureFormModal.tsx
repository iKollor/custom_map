import { CheckCheck, ChevronRight, Edit2, FolderPlus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'motion/react'
import { Button } from '@workspace/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { FEATURE_TYPES, TYPE_ICONS, TYPE_LABELS } from './constants'
import { categoryBreadcrumb, categoryColorById, makeId } from './helpers'
import type { CategoryDef, FeatureFormValues } from './types'

interface FeatureFormModalProps {
    open: boolean
    initial: Partial<FeatureFormValues>
    categories: CategoryDef[]
    onSave: (values: FeatureFormValues, categories?: CategoryDef[]) => void
    onCancel: () => void
}

// ─── Tree data builder ──────────────────────────────────────────────────────
type CatTreeNode = {
    cat: CategoryDef
    children: CatTreeNode[]
    depth: number
}

function buildCategoryTree(categories: CategoryDef[]): CatTreeNode[] {
    const byId = new Map(categories.map(c => [c.id, c]))
    const childrenOf = new Map<string | null, CategoryDef[]>()
    for (const c of categories) {
        const key = c.parentId ?? null
        const list = childrenOf.get(key) ?? []
        list.push(c)
        childrenOf.set(key, list)
    }

    function build(parentId: string | null, depth: number): CatTreeNode[] {
        const children = childrenOf.get(parentId) ?? []
        return children.map(cat => ({
            cat,
            children: build(cat.id, depth + 1),
            depth,
        }))
    }

    return build(null, 0)
}

// ─── Category Tree Picker ───────────────────────────────────────────────────
function CategoryTreePicker({
    categories,
    selectedId,
    onSelect,
    onCreateChild,
    creatingUnder,
    setCreatingUnder,
    newCatName,
    setNewCatName,
}: {
    categories: CategoryDef[]
    selectedId: string
    onSelect: (id: string) => void
    onCreateChild: (parentId: string | null, name: string) => void
    creatingUnder: string | null | false
    setCreatingUnder: (val: string | null | false) => void
    newCatName: string
    setNewCatName: (val: string) => void
}) {
    const tree = useMemo(() => buildCategoryTree(categories), [categories])
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Auto-expand ancestors of selected category
    useEffect(() => {
        if (!selectedId) return
        const byId = new Map(categories.map(c => [c.id, c]))
        const expand = new Set<string>()
        let current = byId.get(selectedId)
        while (current?.parentId) {
            expand.add(current.parentId)
            current = byId.get(current.parentId)
        }
        if (expand.size > 0) {
            setExpandedIds(prev => new Set([...prev, ...expand]))
        }
    }, [selectedId, categories])

    function toggleExpand(id: string) {
        setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    function handleCreate() {
        const trimmed = newCatName.trim()
        if (!trimmed || creatingUnder === false) return
        onCreateChild(creatingUnder, trimmed)
        // onCreateChild will clear the text and creatingUnder state
    }

    function renderNode(node: CatTreeNode) {
        const isSelected = node.cat.id === selectedId
        const isExpanded = expandedIds.has(node.cat.id)
        const hasChildren = node.children.length > 0
        const color = categoryColorById(node.cat.id, categories)

        return (
            <div key={node.cat.id}>
                <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelect(node.cat.id)
                            if (hasChildren && !isExpanded) toggleExpand(node.cat.id)
                        }
                    }}
                    onClick={() => {
                        onSelect(node.cat.id)
                        if (hasChildren && !isExpanded) toggleExpand(node.cat.id)
                    }}
                    className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all cursor-pointer
                        ${isSelected
                            ? 'bg-[#6e00a3]/15 text-[#6e00a3] dark:bg-[#6e00a3]/25 dark:text-[#d9b6fb] ring-1 ring-[#6e00a3]/30'
                            : 'hover:bg-accent/50 text-foreground'
                        }`}
                    style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
                >
                    {hasChildren ? (
                        <motion.span
                            initial={false}
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                            className="shrink-0 text-muted-foreground cursor-pointer"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleExpand(node.cat.id) }}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </motion.span>
                    ) : (
                        <span className="w-3.5 shrink-0" />
                    )}
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                    <span className="truncate flex-1">{node.cat.name}</span>
                    <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity cursor-pointer"
                        title="Crear subcarpeta aquí"
                        onClick={(e) => {
                            e.stopPropagation()
                            setCreatingUnder(node.cat.id)
                            setNewCatName('')
                        }}
                    >
                        <FolderPlus className="h-3 w-3 text-muted-foreground" />
                    </button>
                </div>

                {/* Inline create form for child */}
                {creatingUnder === node.cat.id && (
                    <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: `${(node.depth + 1) * 16 + 8}px` }}>
                        <Input
                            autoFocus
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleCreate()
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault()
                                    setCreatingUnder(false)
                                    setNewCatName('')
                                }
                            }}
                            placeholder="Nombre..."
                            className="h-7 text-xs flex-1"
                        />
                        <Button type="button" size="sm" className="h-7 px-2" onClick={handleCreate} disabled={!newCatName.trim()}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                )}

                {/* Children */}
                {isExpanded && node.children.map(child => renderNode(child))}
            </div>
        )
    }

    const breadcrumb = selectedId ? categoryBreadcrumb(selectedId, categories) : []

    return (
        <div className="space-y-2">
            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground px-1">
                    {breadcrumb.map((segment, i) => (
                        <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="h-3 w-3" />}
                            <span className={i === breadcrumb.length - 1 ? 'font-medium text-foreground' : ''}>{segment}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* Tree */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-1.5 space-y-0.5">
                {/* Uncategorized option */}
                <button
                    type="button"
                    onClick={() => onSelect('')}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all
                        ${selectedId === '' ? 'bg-muted text-foreground ring-1 ring-border' : 'hover:bg-accent/50 text-muted-foreground'}`}
                >
                    <span className="w-3.5 shrink-0" />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-400" />
                    <span className="italic">Sin categoría</span>
                </button>

                {tree.map(node => renderNode(node))}

                {/* Root-level create */}
                {creatingUnder === null && (
                    <div className="flex items-center gap-1.5 py-1 px-2">
                        <Input
                            autoFocus
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate()
                                if (e.key === 'Escape') setCreatingUnder(false)
                            }}
                            placeholder="Nombre..."
                            className="h-7 text-xs flex-1"
                        />
                        <Button type="button" size="sm" className="h-7 px-2" onClick={handleCreate} disabled={!newCatName.trim()}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Add root category button */}
            {creatingUnder === false && (
                <button
                    type="button"
                    onClick={() => { setCreatingUnder(null); setNewCatName('') }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                >
                    <Plus className="h-3 w-3" />
                    Nueva categoría
                </button>
            )}
        </div>
    )
}

// ─── Main Modal ─────────────────────────────────────────────────────────────
export function FeatureFormModal({
    open,
    initial,
    categories,
    onSave,
    onCancel,
}: FeatureFormModalProps) {
    const [form, setForm] = useState<FeatureFormValues>({
        name: '',
        type: 'point',
        categoryId: '',
        description: '',
        coordinates: '',
    })
    const [errors, setErrors] = useState<Partial<Record<keyof FeatureFormValues, string>>>({})
    const [localCategories, setLocalCategories] = useState<CategoryDef[]>([])
    
    // Lift category creation state so we can flush it on save
    const [creatingUnder, setCreatingUnder] = useState<string | null | false>(false)
    const [newCatName, setNewCatName] = useState('')

    const prevOpen = useRef(false)
    
    useEffect(() => {
        // Only initialize form state when the modal transitions from closed to open
        if (open && !prevOpen.current) {
            setForm({
                name: initial.name ?? '',
                type: initial.type ?? 'point',
                categoryId: initial.categoryId ?? (categories[0]?.id ?? ''),
                description: initial.description ?? '',
                coordinates: initial.coordinates ?? '',
                _editId: initial._editId,
            })
            setLocalCategories(categories)
            setErrors({})
        }
        prevOpen.current = open
    }, [open, initial, categories])

    function setField(key: keyof FeatureFormValues, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }))
        setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

    function handleCreateCategory(parentId: string | null, name: string) {
        const parentColor = parentId
            ? localCategories.find(c => c.id === parentId)?.color
            : null
        const newCat: CategoryDef = {
            id: makeId(),
            name,
            color: parentColor || '#40A7F4',
            parentId,
            subcategories: [],
        }
        setLocalCategories(prev => [...prev, newCat])
        setForm(prev => ({ ...prev, categoryId: newCat.id }))
        setCreatingUnder(false)
        setNewCatName('')
    }

    function handleSave() {
        const nextErrors: Partial<Record<keyof FeatureFormValues, string>> = {}
        if (!form.name.trim()) nextErrors.name = 'El nombre es obligatorio'
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors)
            return
        }

        let finalCategoryId = form.categoryId
        let finalLocalCategories = [...localCategories]

        // If the user was in the middle of creating a category when they clicked save,
        // automatically create it and assign it.
        if (creatingUnder !== false && newCatName.trim()) {
            const parentColor = creatingUnder
                ? finalLocalCategories.find(c => c.id === creatingUnder)?.color
                : null
            const newCat: CategoryDef = {
                id: makeId(),
                name: newCatName.trim(),
                color: parentColor || '#40A7F4',
                parentId: creatingUnder,
                subcategories: [],
            }
            finalLocalCategories.push(newCat)
            finalCategoryId = newCat.id
            setLocalCategories(finalLocalCategories)
        }

        onSave({
            ...form,
            name: form.name.trim(),
            categoryId: finalCategoryId,
        }, finalLocalCategories)
        
        // Reset states
        setCreatingUnder(false)
        setNewCatName('')
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onCancel()
            }}
        >
            <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto sm:w-full" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Edit2 className="h-4 w-4 text-[#6e00a3]" />
                        {initial._editId ? 'Editar elemento' : 'Nuevo elemento'}
                    </DialogTitle>
                    <DialogDescription>
                        Completa la informacion del elemento y guarda los cambios.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>
                            Nombre <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={form.name}
                            onChange={(event) => setField('name', event.target.value)}
                            placeholder="Ej: Ruta Centro"
                            aria-invalid={Boolean(errors.name)}
                        />
                        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {FEATURE_TYPES.map((type) => (
                                <Button
                                    key={type}
                                    type="button"
                                    onClick={() => setField('type', type)}
                                    variant={form.type === type ? 'default' : 'outline'}
                                    className={form.type === type ? 'bg-[#6e00a3] hover:bg-[#560080]' : 'hover:border-[#40a7f4]/40 hover:bg-[#40a7f4]/10'}
                                >
                                    {TYPE_ICONS[type]}
                                    {TYPE_LABELS[type]}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Ubicación en carpetas</Label>
                        <CategoryTreePicker
                            categories={localCategories}
                            selectedId={form.categoryId}
                            onSelect={(id) => setField('categoryId', id)}
                            onCreateChild={handleCreateCategory}
                            creatingUnder={creatingUnder}
                            setCreatingUnder={setCreatingUnder}
                            newCatName={newCatName}
                            setNewCatName={setNewCatName}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Descripcion</Label>
                        <Textarea
                            value={form.description}
                            onChange={(event) => setField('description', event.target.value)}
                            rows={3}
                            placeholder="Opcional"
                        />
                    </div>

                    {form.coordinates && (
                        <div className="space-y-2">
                            <Label>Coordenadas (WKT)</Label>
                            <Textarea
                                value={form.coordinates}
                                onChange={(event) => setField('coordinates', event.target.value)}
                                rows={3}
                                className="font-mono text-xs text-muted-foreground"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleSave}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
