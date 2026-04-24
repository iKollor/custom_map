import { z } from 'zod'

export type CsvRow = Record<string, string>

export const FeatureTypeSchema = z.enum(['point', 'route', 'section'])
export type FeatureType = z.infer<typeof FeatureTypeSchema>

export const CategoryDefSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    parentId: z.string().nullish(),
    subcategories: z.array(z.string()).optional(),
})
export type CategoryDef = z.infer<typeof CategoryDefSchema>

export type DrawMode = FeatureType | null

const BaseFeatureSchema = z.object({
    _id: z.string(),
    _raw: z.record(z.string(), z.unknown()).catch({}),
    name: z.string(),
    category: z.string(),
    subcategory: z.string(),
    coordinates: z.string(),
    description: z.string(),
    customFields: z.record(z.string(), z.string()).optional(),
})

export const PointFeatureSchema = BaseFeatureSchema.extend({
    type: z.literal('point'),
    _coords: z.tuple([z.number(), z.number()]).nullable(),
})
export type PointFeature = z.infer<typeof PointFeatureSchema>

export const RouteFeatureSchema = BaseFeatureSchema.extend({
    type: z.literal('route'),
    _coords: z.array(z.tuple([z.number(), z.number()])).nullable(),
})
export type RouteFeature = z.infer<typeof RouteFeatureSchema>

export const SectionFeatureSchema = BaseFeatureSchema.extend({
    type: z.literal('section'),
    _coords: z.array(z.tuple([z.number(), z.number()])).nullable(),
})
export type SectionFeature = z.infer<typeof SectionFeatureSchema>

export const ParsedFeatureSchema = z.discriminatedUnion('type', [
    PointFeatureSchema,
    RouteFeatureSchema,
    SectionFeatureSchema,
])
export type ParsedFeature = z.infer<typeof ParsedFeatureSchema>

export const FeatureFormValuesSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    type: FeatureTypeSchema,
    category: z.string().min(1, 'La categoria es obligatoria'),
    newCategory: z.string(),
    subcategory: z.string(),
    description: z.string(),
    coordinates: z.string(),
    _editId: z.string().optional(),
}).refine(data => data.category !== '__new__' || data.newCategory.trim().length > 0, {
    message: "El nombre de la nueva categoria es requerido",
    path: ["newCategory"],
})
export type FeatureFormValues = z.infer<typeof FeatureFormValuesSchema>

export const MapProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    categories: z.array(CategoryDefSchema),
    features: z.array(ParsedFeatureSchema),
})
export type MapProject = z.infer<typeof MapProjectSchema>

export const StoredStateSchema = z.object({
    activeProjectId: z.string(),
    projects: z.array(MapProjectSchema),
})
export type StoredState = z.infer<typeof StoredStateSchema>
