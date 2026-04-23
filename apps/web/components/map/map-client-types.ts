import type { CategoryDef, ParsedFeature } from './editor'

export type PointFeatureProperties = {
    id: string
    name: string
    category: string
    subcategory: string
    description: string
    color: string
}

export type SelectedPointState = {
    coordinates: [number, number]
    properties: PointFeatureProperties
}

export type ResolvedRoute = {
    signature: string
    coordinates: [number, number][]
}

export type ResolvedRouteState = Record<string, ResolvedRoute>

export type ClusterData = GeoJSON.FeatureCollection<GeoJSON.Point, PointFeatureProperties>

export type MapFeatureCollection = {
    pointFeatures: ParsedFeature[]
    linearFeatures: ParsedFeature[]
    routeFeatures: ParsedFeature[]
    clusterData: ClusterData
    summary: {
        points: number
        routes: number
        sections: number
    }
}

export type MapFeatureCollectionParams = {
    features: ParsedFeature[]
    categories: CategoryDef[]
}

export type ContextMenuState = {
    featureId: string
    coordinates: [number, number]
    screenPosition: { x: number; y: number }
}