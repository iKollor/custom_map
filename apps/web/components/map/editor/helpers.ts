import Papa from 'papaparse'
import { FEATURE_TYPES, PALETTE } from './constants'
import {
    ParsedFeatureSchema,
    type CategoryDef,
    type CsvRow,
    type FeatureType,
    type LegacyParsedFeature,
    type MapProject,
    type ParsedFeature,
    type StoredState,
    LegacyStoredStateSchema,
} from './types'

const FEATURE_TYPE_SET = new Set(FEATURE_TYPES)

// Type aliases for normalization (supports multiple input formats)
const FEATURE_TYPE_ALIASES: Record<string, FeatureType> = {
    point: 'point', points: 'point', punto: 'point', puntos: 'point', marker: 'point', markers: 'point',
    route: 'route', routes: 'route', ruta: 'route', rutas: 'route', line: 'route', linestring: 'route',
    section: 'section', sections: 'section', seccion: 'section', secciones: 'section', sección: 'section',
}

export function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Category resolution helpers ────────────────────────────────────────────

/** Resolve a category by its ID. */
export function categoryById(catId: string, categories: CategoryDef[]): CategoryDef | undefined {
    return categories.find(c => c.id === catId)
}

/** Build the full breadcrumb path for a category: ["Rutas", "Principales"]. */
export function categoryBreadcrumb(catId: string, categories: CategoryDef[]): string[] {
    const byId = new Map(categories.map(c => [c.id, c]))
    const trail: string[] = []
    let current = byId.get(catId)
    let depth = 0
    while (current && depth < 10) {
        trail.unshift(current.name)
        current = current.parentId ? byId.get(current.parentId) : undefined
        depth++
    }
    return trail
}

/** Resolve the effective color for a category (walks up inheritance chain). */
export function categoryColorById(catId: string, categories: CategoryDef[]): string {
    const byId = new Map(categories.map(c => [c.id, c]))
    const resolve = (cat: CategoryDef | undefined, depth: number): string | null => {
        if (!cat || depth > 8) return null
        if (cat.color?.trim()) return cat.color
        if (!cat.parentId) return null
        return resolve(byId.get(cat.parentId), depth + 1)
    }
    return resolve(byId.get(catId), 0) ?? '#40A7F4'
}

/** Get the display name for a feature's category (resolves to deepest name). */
export function featureCategoryName(feature: ParsedFeature, categories: CategoryDef[]): string {
    const cat = categoryById(feature.categoryId, categories)
    return cat?.name ?? ''
}

/** Get the display label for a feature's category with breadcrumb (e.g. "Rutas > Principales"). */
export function featureCategoryLabel(feature: ParsedFeature, categories: CategoryDef[]): string {
    if (!feature.categoryId) return 'Sin categoría'
    const trail = categoryBreadcrumb(feature.categoryId, categories)
    return trail.length > 0 ? trail.join(' > ') : 'Sin categoría'
}

// ─── Legacy helpers (backward compat) ───────────────────────────────────────

/** @deprecated Use categoryColorById instead. Kept for legacy callers during transition. */
export function categoryColor(catName: string, categories: CategoryDef[]): string {
    const byName = new Map(categories.map((category) => [category.name, category]))
    const byId = new Map(categories.map((category) => [category.id, category]))

    const resolveColor = (category: CategoryDef | undefined, depth = 0): string | null => {
        if (!category || depth > 8) return null
        if (category.color?.trim()) return category.color
        if (!category.parentId) return null
        return resolveColor(byId.get(category.parentId), depth + 1)
    }

    // Try by name first, then by ID (for transition period)
    return resolveColor(byName.get(catName) ?? byId.get(catName)) ?? '#40A7F4'
}

// ─── Feature type normalization ─────────────────────────────────────────────

export function normalizeFeatureType(type: string | null | undefined, wkt = ''): FeatureType {
    const normalized = (type ?? '').trim().toLowerCase()
    if (FEATURE_TYPE_SET.has(normalized as FeatureType)) {
        return normalized as FeatureType
    }

    const aliased = FEATURE_TYPE_ALIASES[normalized]
    if (aliased) return aliased

    const upperWkt = wkt.toUpperCase()
    if (upperWkt.includes('POINT')) return 'point'
    if (upperWkt.includes('LINESTRING')) return 'route'

    return 'point'
}

// ─── WKT parsing ────────────────────────────────────────────────────────────

function parseLINESTRING(wkt: string): [number, number][] {
    const m = wkt.match(/LINESTRING\s*\(([^)]+)\)/i)
    if (!m || !m[1]) return []
    return m[1].split(',').reduce<[number, number][]>((acc, pair) => {
        const parts = pair.trim().split(/\s+/)
        const lng = parseFloat(parts[0] ?? '')
        const lat = parseFloat(parts[1] ?? '')
        if (!isNaN(lng) && !isNaN(lat)) acc.push([lng, lat])
        return acc
    }, [])
}

function parsePOINT(wkt: string): [number, number] | null {
    const m = wkt.match(/POINT\s*\(([^)]+)\)/i)
    if (!m || !m[1]) return null
    const parts = m[1].trim().split(/\s+/)
    const lng = parseFloat(parts[0] ?? '')
    const lat = parseFloat(parts[1] ?? '')
    if (isNaN(lng) || isNaN(lat)) return null
    return [lng, lat]
}

export function parseCoordinates(wkt: string, type: string): [number, number][] | [number, number] | null {
    const t = normalizeFeatureType(type, wkt)
    if (t === 'route' || t === 'section') return parseLINESTRING(wkt)
    if (t === 'point') return parsePOINT(wkt)
    if (wkt.toUpperCase().includes('LINESTRING')) return parseLINESTRING(wkt)
    if (wkt.toUpperCase().includes('POINT')) return parsePOINT(wkt)
    return null
}

export function coordsToWKT(coords: [number, number][] | [number, number] | null, type: string): string {
    if (!coords) return ''
    const t = normalizeFeatureType(type)
    if (t === 'point') {
        const p = (Array.isArray(coords[0]) ? (coords as [number, number][])[0] : coords) as [number, number] | undefined
        return p && !isNaN(p[0]) && !isNaN(p[1]) ? `POINT(${p[0]} ${p[1]})` : ''
    }
    const pts = coords as [number, number][]
    if (!pts.length) return ''
    return `LINESTRING(${pts.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`
}

export function isLineCoordinates(coords: ParsedFeature['_coords']): coords is [number, number][] {
    return Array.isArray(coords) && Array.isArray(coords[0])
}

export function isPointCoordinates(coords: ParsedFeature['_coords']): coords is [number, number] {
    return Array.isArray(coords) && !Array.isArray(coords[0])
}

// ─── V1 → V2 Migration ─────────────────────────────────────────────────────

/**
 * Migrate a legacy StoredState (features have category/subcategory strings)
 * to the new format (features have categoryId UUIDs).
 * 
 * - For each feature, finds the matching CategoryDef by name.
 * - If feature has a subcategory, finds the child category with that name
 *   under the parent category.
 * - If no matching category exists, creates one.
 * - Returns a fully migrated StoredState.
 */
export function migrateV1toV2(raw: unknown): StoredState | null {
    const legacy = LegacyStoredStateSchema.safeParse(raw)
    if (!legacy.success) return null

    const migratedProjects: MapProject[] = legacy.data.projects.map((project) => {
        const categories = [...project.categories]
        const catByName = new Map<string, CategoryDef>()
        for (const c of categories) catByName.set(c.name, c)

        const findOrCreateCat = (name: string, parentId: string | null): CategoryDef => {
            // For subcategories, search by name AND parentId to avoid collisions
            if (parentId) {
                const existing = categories.find(c => c.name === name && c.parentId === parentId)
                if (existing) return existing
            } else {
                const existing = categories.find(c => c.name === name && !c.parentId)
                if (existing) return existing
            }
            const idx = categories.length
            const parentColor = parentId
                ? categories.find(c => c.id === parentId)?.color
                : null
            const newCat: CategoryDef = {
                id: makeId(),
                name,
                color: (parentColor || PALETTE[idx % PALETTE.length]) ?? '#40A7F4',
                parentId,
                subcategories: [],
            }
            categories.push(newCat)
            catByName.set(name, newCat)
            return newCat
        }

        const features: ParsedFeature[] = project.features.map((f: LegacyParsedFeature) => {
            let targetCatId = ''

            if (f.category) {
                const parentCat = findOrCreateCat(f.category, null)
                targetCatId = parentCat.id

                if (f.subcategory) {
                    const subCat = findOrCreateCat(f.subcategory, parentCat.id)
                    targetCatId = subCat.id
                }
            }

            return {
                _id: f._id,
                _raw: f._raw,
                name: f.name,
                categoryId: targetCatId,
                coordinates: f.coordinates,
                description: f.description,
                customFields: f.customFields,
                type: f.type,
                _coords: f._coords,
            } as ParsedFeature
        })

        return {
            ...project,
            categories,
            features,
        }
    })

    return {
        activeProjectId: legacy.data.activeProjectId,
        projects: migratedProjects,
    }
}

// ─── CSV Import/Export ──────────────────────────────────────────────────────

/** Separator used in the `category_path` column to encode nested hierarchies. */
const PATH_SEP = ' > '

/**
 * Resolve the full breadcrumb path for a category as a single string.
 * E.g. "Comercio > Tiendas > Informal"
 */
function buildCategoryPath(catId: string, byId: Map<string, CategoryDef>): string {
    const trail: string[] = []
    let current = byId.get(catId)
    let depth = 0
    while (current && depth < 10) {
        trail.unshift(current.name)
        current = current.parentId ? byId.get(current.parentId) : undefined
        depth++
    }
    return trail.join(PATH_SEP)
}

export function csvRowsToParsed(rows: CsvRow[], existingCategories: CategoryDef[] = []): { features: ParsedFeature[], categories: CategoryDef[] } {
    const categories = [...existingCategories]

    const findOrCreateCat = (name: string, parentId: string | null): CategoryDef => {
        if (parentId) {
            const existing = categories.find(c => c.name === name && c.parentId === parentId)
            if (existing) return existing
        } else {
            const existing = categories.find(c => c.name === name && !c.parentId)
            if (existing) return existing
        }
        const idx = categories.length
        const parentColor = parentId
            ? categories.find(c => c.id === parentId)?.color
            : null
        const newCat: CategoryDef = {
            id: makeId(),
            name,
            color: (parentColor || PALETTE[idx % PALETTE.length]) ?? '#40A7F4',
            parentId,
            subcategories: [],
        }
        categories.push(newCat)
        return newCat
    }

    /**
     * Walk a path like ["Comercio", "Tiendas", "Informal"] and find-or-create
     * each level, returning the deepest category's ID.
     */
    const resolvePathToCategoryId = (segments: string[]): string => {
        let parentId: string | null = null
        let lastId = ''
        for (const seg of segments) {
            const cat = findOrCreateCat(seg, parentId)
            parentId = cat.id
            lastId = cat.id
        }
        return lastId
    }

    const features = rows
        .map((r, i) => {
            const rawType = normalizeFeatureType(r['type'], r['coordinates'])

            let categoryId = ''

            // Prefer the new `category_path` column (supports N levels).
            const categoryPath = r['category_path']?.trim()

            if (categoryPath) {
                const segments = categoryPath.split(PATH_SEP).map(s => s.trim()).filter(Boolean)
                if (segments.length > 0) {
                    categoryId = resolvePathToCategoryId(segments)
                }
            } else {
                // Backward compat: old `category` + `subcategory` columns (2 levels max).
                const catName = r['category']?.trim()
                const subName = r['subcategory']?.trim()

                if (catName) {
                    const segments = [catName]
                    if (subName) segments.push(subName)
                    categoryId = resolvePathToCategoryId(segments)
                }
            }

            const rawBody = {
                type: rawType,
                _id: `csv-${i}-${makeId()}`,
                _coords: parseCoordinates(r['coordinates'] ?? '', rawType),
                _raw: r,
                name: r['name'] ?? '',
                categoryId,
                coordinates: r['coordinates'] ?? '',
                description: r['description'] ?? '',
            }

            const parsed = ParsedFeatureSchema.safeParse(rawBody)
            if (parsed.success) return parsed.data

            console.warn(`[csvRowsToParsed] Dropping invalid feature row ${i}:`, parsed.error.issues)
            return null
        })
        .filter((f): f is ParsedFeature => f !== null)

    return { features, categories }
}

/** Column order used when exporting CSVs. */
const CSV_COLUMNS = ['name', 'type', 'category_path', 'coordinates', 'description']

export function downloadCSV(features: ParsedFeature[], categories: CategoryDef[], filename: string) {
    const byId = new Map(categories.map(c => [c.id, c]))

    const rows = features.map((f) => {
        const row = { ...f._raw } as Record<string, unknown>

        row.name = f.name
        row.description = f.description ?? ''
        row.type = f.type
        row.coordinates = coordsToWKT(f._coords, f.type)

        // Resolve full category hierarchy into a single path column
        row.category_path = f.categoryId ? buildCategoryPath(f.categoryId, byId) : ''

        // Remove internal / legacy fields
        delete row.categoryId
        delete row._id
        delete row._raw
        delete row._coords
        delete row.category
        delete row.subcategory
        delete row.formality

        return row
    })

    const csv = Papa.unparse(rows, { columns: CSV_COLUMNS })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Category helpers ───────────────────────────────────────────────────────

/**
 * Ensures all features have valid categoryId references.
 * Creates missing categories from features that reference non-existent IDs.
 */
export function ensureCategoryIntegrity(features: ParsedFeature[], categories: CategoryDef[]): CategoryDef[] {
    const catIds = new Set(categories.map(c => c.id))
    const next = [...categories]

    for (const f of features) {
        if (f.categoryId && !catIds.has(f.categoryId)) {
            // Feature references a category that doesn't exist — create a placeholder
            const newCat: CategoryDef = {
                id: f.categoryId,
                name: `Categoria desconocida`,
                color: PALETTE[next.length % PALETTE.length] ?? '#40A7F4',
                parentId: null,
                subcategories: [],
            }
            next.push(newCat)
            catIds.add(f.categoryId)
        }
    }

    return next
}
