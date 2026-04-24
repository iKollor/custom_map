export type CsvRow = Record<string, string>

export type FeatureType = 'point' | 'route' | 'section'

export interface CategoryDef {
    id: string
    name: string
    color: string
    parentId?: string | null
    subcategories?: string[]
}

export type DrawMode = FeatureType | null

export interface ParsedFeature {
    _id: string
    _coords: [number, number][] | [number, number] | null
    _raw: CsvRow
    type: FeatureType
    name: string
    category: string
    subcategory: string
    coordinates: string
    description: string
    customFields?: Record<string, string>
}

export interface FeatureFormValues {
    name: string
    type: FeatureType
    category: string
    newCategory: string
    subcategory: string
    description: string
    coordinates: string
    _editId?: string
}

export interface MapProject {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    categories: CategoryDef[]
    features: ParsedFeature[]
}
