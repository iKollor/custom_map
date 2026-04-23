import Papa from 'papaparse'
import { FEATURE_TYPES, PALETTE } from './constants'
import type { CategoryDef, CsvRow, FeatureType, ParsedFeature } from './types'

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
    return categories.find((c) => c.name === catName)?.color ?? '#40A7F4'
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
    return m[1].split(',').map((pair) => {
        const parts = pair.trim().split(/\s+/)
        return [parseFloat(parts[0] ?? '0'), parseFloat(parts[1] ?? '0')] as [number, number]
    })
}

// Parse WKT Point format
function parsePOINT(wkt: string): [number, number] | null {
    const m = wkt.match(/POINT\s*\(([^)]+)\)/i)
    if (!m || !m[1]) return null
    const parts = m[1].trim().split(/\s+/)
    return [parseFloat(parts[0] ?? '0'), parseFloat(parts[1] ?? '0')]
}

export function parseCoordinates(wkt: string, type: string): [number, number][] | [number, number] | null {
    const t = normalizeFeatureType(type, wkt)
    if (t === 'route' || t === 'section') return parseLINESTRING(wkt)
    if (t === 'point') return parsePOINT(wkt)
    if (wkt.toUpperCase().includes('LINESTRING')) return parseLINESTRING(wkt)
    if (wkt.toUpperCase().includes('POINT')) return parsePOINT(wkt)
    return null
}

export function coordsToWKT(pts: [number, number][], type: string): string {
    const t = normalizeFeatureType(type)
    if (t === 'point') {
        const p = pts[0]
        return p ? `POINT(${p[0]} ${p[1]})` : ''
    }
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
        .filter((r) => r['name'] && r['coordinates'])
        .map((r, i) => ({
            type: normalizeFeatureType(r['type'], r['coordinates']),
            _id: `csv-${i}-${makeId()}`,
            _coords: parseCoordinates(r['coordinates'] ?? '', r['type'] ?? ''),
            _raw: r,
            name: r['name'] ?? '',
            category: r['category'] ?? '',
            subcategory: r['subcategory'] ?? '',
            coordinates: r['coordinates'] ?? '',
            description: r['description'] ?? '',
        }))
}

export function downloadCSV(features: ParsedFeature[], filename: string) {
    const csv = Papa.unparse(features.map((f) => f._raw))
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
    const next = existing.map((category) => ({
        ...category,
        subcategories: Array.from(new Set(category.subcategories ?? [])),
    }))

    // Add missing categories
    for (const name of features.map((f) => f.category).filter(Boolean)) {
        if (existingByName.has(name)) continue
        const idx = next.length
        next.push({ id: makeId(), name, color: PALETTE[idx % PALETTE.length] ?? '#40A7F4', subcategories: [] })
        existingByName.add(name)
    }

    // Add subcategories
    for (const feature of features) {
        if (!feature.category || !feature.subcategory) continue
        const category = next.find((c) => c.name === feature.category)
        if (!category) continue
        const set = new Set(category.subcategories ?? [])
        set.add(feature.subcategory)
        category.subcategories = Array.from(set)
    }

    return next
}
