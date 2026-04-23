import type {
    Feature as GeoJSONFeature,
    Geometry,
    LineString,
    Point,
    Polygon,
} from 'geojson'
import type { LayerSpecification } from 'maplibre-gl'

export enum FeatureType {
    SECTION = 'SECTION',
    ROUTE = 'ROUTE',
    POINT = 'POINT',
}

export interface MarkerUIConfig {
    color?: string
    opacity?: number
    strokeWidth?: number
    animate?: boolean
    animationType?: 'pulse' | 'bounce' | 'glow' | 'none'
    popupComponent?: string
    iconUrl?: string
    dashArray?: number[]
    fillPattern?: string
}

export interface Category {
    id: string
    name: string
    color: string
    uiConfig?: MarkerUIConfig | null
    subcategories?: Subcategory[]
    features?: Feature[]
    createdAt: Date
    updatedAt: Date
}

export interface Subcategory {
    id: string
    name: string
    categoryId: string
    category?: Category
    features?: Feature[]
    uiConfig?: MarkerUIConfig | null
    createdAt: Date
    updatedAt: Date
}

export interface Feature {
    id: string
    name: string
    type: FeatureType
    geometry: Geometry
    properties: Record<string, unknown>
    categoryId?: string | null
    category?: Category | null
    subcategoryId?: string | null
    subcategory?: Subcategory | null
    createdAt: Date
    updatedAt: Date
}

export interface ParsedFeature {
    name: string
    type: FeatureType
    category: string
    subcategory?: string
    geometry: Geometry
    properties: Record<string, unknown>
}

export interface IMarker {
    getData(): Feature
    getGeoJSON(): GeoJSONFeature
    getLayerConfig(): LayerSpecification
    getUIConfig(): MarkerUIConfig
}

export type SectionGeometry = Polygon
export type RouteGeometry = LineString
export type PointGeometry = Point

export interface APIResponse<T> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface FeaturesResponse {
    features: Feature[]
    total: number
    page: number
    pageSize: number
}

export interface BboxParams {
    minLng: number
    minLat: number
    maxLng: number
    maxLat: number
}

export interface FeaturesFilterParams {
    type?: FeatureType
    categoryId?: string
    subcategoryId?: string
    bbox?: BboxParams
    limit?: number
    offset?: number
}
