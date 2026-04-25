import Papa from 'papaparse'
import { FEATURE_TYPES, PALETTE } from './constants'
import { ParsedFeatureSchema, type CategoryDef, type CsvRow, type FeatureType, type ParsedFeature } from './types'

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

export function categoryColor(catName: string, categories: CategoryDef[]): string {
    const byName = new Map(categories.map((category) => [category.name, category]))
    const byId = new Map(categories.map((category) => [category.id, category]))

    const resolveColor = (category: CategoryDef | undefined, depth = 0): string | null => {
        if (!category || depth > 8) return null
        if (category.color?.trim()) return category.color
        if (!category.parentId) return null
        return resolveColor(byId.get(category.parentId), depth + 1)
    }

    return resolveColor(byName.get(catName)) ?? '#40A7F4'
}

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

// Parse WKT LineString format
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

// Parse WKT Point format
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
        // Point _coords is [lng, lat], not [[lng, lat]]
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

export function csvRowsToParsed(rows: CsvRow[]): ParsedFeature[] {
    return rows
        .map((r, i) => {
            const rawType = normalizeFeatureType(r['type'], r['coordinates'])
            
            const rawBody = {
                type: rawType,
                _id: `csv-${i}-${makeId()}`,
                _coords: parseCoordinates(r['coordinates'] ?? '', rawType),
                _raw: r,
                name: r['name'] ?? '',
                category: r['category'] ?? '',
                subcategory: r['subcategory'] ?? '',
                coordinates: r['coordinates'] ?? '',
                description: r['description'] ?? '',
            }

            const parsed = ParsedFeatureSchema.safeParse(rawBody)
            if (parsed.success) return parsed.data
            
            console.warn(`[csvRowsToParsed] Dropping invalid feature row ${i}:`, parsed.error.issues)
            return null
        })
        .filter((f): f is ParsedFeature => f !== null)
}

export function downloadCSV(features: ParsedFeature[], categories: CategoryDef[], filename: string) {
    const byId = new Map(categories.map(c => [c.id, c]))
    const byName = new Map(categories.map(c => [c.name, c]))

    const rows = features.map((f) => {
        const row = { ...f._raw }
        const cat = byName.get(f.category)

        row.name = f.name
        row.description = f.description ?? ''
        row.type = f.type
        row.coordinates = coordsToWKT(f._coords, f.type)

        if (cat) {
            if (cat.parentId) {
                const parent = byId.get(cat.parentId)
                if (parent) {
                    row.category = parent.name
                    row.subcategory = cat.name
                } else {
                    row.category = cat.name
                    row.subcategory = ''
                }
            } else {
                row.category = cat.name
                row.subcategory = ''
            }
        }

        return row
    })

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Deduplicates and merges categories with subcategories
export function catsFromFeatures(features: ParsedFeature[], existing: CategoryDef[]): CategoryDef[] {
    const existingByName = new Set(existing.map((c) => c.name))
    const next: CategoryDef[] = existing.map((category) => ({
        ...category,
        subcategories: Array.from(new Set(category.subcategories ?? [])),
    }))

    const getOrCreate = (name: string, parentId: string | null): CategoryDef => {
        const cat = next.find((c) => c.name === name)
        if (cat) {
            if (parentId && !cat.parentId) {
                cat.parentId = parentId
            }
            return cat
        }
        const idx = next.length
        const newCat: CategoryDef = {
            id: makeId(),
            name,
            color: PALETTE[idx % PALETTE.length] ?? '#40A7F4',
            parentId,
            subcategories: [],
        }
        next.push(newCat)
        existingByName.add(name)
        return newCat
    }

    for (const feature of features) {
        if (!feature.category) continue

        const parent = getOrCreate(feature.category, null)
        let finalCatName = parent.name

        if (feature.subcategory) {
            const sub = getOrCreate(feature.subcategory, parent.id)
            finalCatName = sub.name
        }

        feature.category = finalCatName
    }

    return next
}
