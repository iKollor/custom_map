// UI Components
export { EditPanel } from './EditPanel'
export { FeatureFormModal } from './FeatureFormModal'
export { FilterPanel } from './FilterPanel'
export { ImportModal } from './ImportModal'
export { MapDrawLayer } from './MapDrawLayer'
export { Toolbar } from './Toolbar'

// Centralized Constants & Theme
export { CONTEXT_MENU_LABELS, FEATURE_TYPES, PALETTE, THEME_COLORS, TYPE_ICONS, TYPE_LABELS } from './constants'

// Utilities & Helpers
export {
    categoryBreadcrumb,
    categoryColorById,
    coordsToWKT,
    csvRowsToParsed,
    downloadCSV,
    ensureCategoryIntegrity,
    featureCategoryName,
    isLineCoordinates,
    isPointCoordinates,
    makeId,
    migrateV1toV2,
    normalizeFeatureType,
    parseCoordinates,
} from './helpers'

// Main Hook
export { useMapEditor } from './useMapEditor'

// Type Exports
export type {
    CategoryDef,
    CsvRow,
    DrawMode,
    FeatureType,
    FeatureFormValues,
    MapProject,
    ParsedFeature,
} from './types'

/**
 * Editor Module - Barrel Exports
 *
 * OPTIMIZATION NOTES:
 * - Constants centralized to avoid duplication
 * - THEME_COLORS used throughout components
 * - TYPE_LABELS and CONTEXT_MENU_LABELS for i18n support
 * - Helpers are pure functions, easily testable
 * - useMapEditor hook manages all editor state
 *
 * IMPROVEMENTS MADE:
 * ✓ Removed duplicate TYPE_LABELS from FeatureContextMenu
 * ✓ Added THEME_COLORS constant for consistent colors
 * ✓ Added CONTEXT_MENU_LABELS for context-specific labels
 * ✓ Organized exports by category (UI, Constants, Utils, Types)
 * ✓ Facilitates tree-shaking and code splitting
 *
 * USAGE:
 * import { THEME_COLORS, useMapEditor, type ParsedFeature } from './editor'
 */

