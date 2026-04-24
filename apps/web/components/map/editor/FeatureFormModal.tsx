import { CheckCheck, Edit2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@workspace/ui/components/select'
import { Textarea } from '@workspace/ui/components/textarea'
import { FEATURE_TYPES, TYPE_ICONS, TYPE_LABELS } from './constants'
import { FeatureFormValuesSchema, type CategoryDef, type FeatureFormValues } from './types'

interface FeatureFormModalProps {
    open: boolean
    initial: Partial<FeatureFormValues>
    categories: CategoryDef[]
    onSave: (values: FeatureFormValues) => void
    onCancel: () => void
}

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
        category: '',
        newCategory: '',
        subcategory: '',
        description: '',
        coordinates: '',
    })
    const [errors, setErrors] = useState<Partial<Record<keyof FeatureFormValues, string>>>({})

    useEffect(() => {
        if (!open) return

        setForm({
            name: initial.name ?? '',
            type: initial.type ?? 'point',
            category: initial.category ?? (categories[0]?.name ?? ''),
            newCategory: '',
            subcategory: initial.subcategory ?? '',
            description: initial.description ?? '',
            coordinates: initial.coordinates ?? '',
            _editId: initial._editId,
        })
        setErrors({})
    }, [open, initial, categories])

    function setField(key: keyof FeatureFormValues, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }))
        setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

    function handleSave() {
        const parsed = FeatureFormValuesSchema.safeParse(form)
        if (!parsed.success) {
            const nextErrors: Partial<Record<keyof FeatureFormValues, string>> = {}
            for (const issue of parsed.error.issues) {
                const path = issue.path[0] as keyof FeatureFormValues
                if (!nextErrors[path]) nextErrors[path] = issue.message
            }
            setErrors(nextErrors)
            return
        }

        onSave({
            ...parsed.data,
            category: parsed.data.category === '__new__' ? parsed.data.newCategory.trim() : parsed.data.category,
        })
    }

    const isNewCategory = form.category === '__new__'

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
                        <Label>Categoria</Label>
                        <Select value={form.category} onValueChange={(value) => setField('category', value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona una categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.name}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                                <SelectItem value="__new__">+ Nueva categoria...</SelectItem>
                            </SelectContent>
                        </Select>
                        {isNewCategory && (
                            <div className="space-y-2">
                                <Input
                                    value={form.newCategory}
                                    onChange={(event) => setField('newCategory', event.target.value)}
                                    placeholder="Nombre de la nueva categoria"
                                    aria-invalid={Boolean(errors.newCategory)}
                                />
                                {errors.newCategory && <p className="text-xs text-red-500">{errors.newCategory}</p>}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Subcategoria</Label>
                        <Input
                            value={form.subcategory}
                            onChange={(event) => setField('subcategory', event.target.value)}
                            placeholder="Opcional"
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
