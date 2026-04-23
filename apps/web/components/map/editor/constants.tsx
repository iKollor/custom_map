import { MapPin, Route, Square } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FeatureType } from './types'

// Color palette for categories
export const PALETTE = [
    '#6E00A3', '#40A7F4', '#8C33BF', '#2D8FDE',
    '#5A1F88', '#71BCF7', '#A05BDD', '#1F6DB3',
    '#B47FE6', '#3C93CE', '#4A2D73', '#8ED0FB',
]

// Theme colors for features and UI
export const THEME_COLORS = {
    point: '#6E00A3',
    route: '#40A7F4',
    section: '#6E00A3',
    primary: '#6E00A3',
    secondary: '#40A7F4',
    accent: '#8C33BF',
} as const

// Feature types
export const FEATURE_TYPES: FeatureType[] = ['point', 'route', 'section']

// Feature display labels
export const TYPE_LABELS: Record<FeatureType, string> = {
    point: 'Punto',
    route: 'Ruta',
    section: 'Seccion',
}

// Feature context menu labels
export const CONTEXT_MENU_LABELS: Record<FeatureType, string> = {
    point: 'Punto',
    route: 'Ruta',
    section: 'Sector',
}

export const TYPE_ICONS: Record<FeatureType, ReactNode> = {
    route: <Route className="h-3.5 w-3.5" />,
    section: <Square className="h-3.5 w-3.5" />,
    point: <MapPin className="h-3.5 w-3.5" />,
}
