'use client'

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

import { Map, MapControls } from '@/components/ui/map'

import { MapAutoFocus } from './MapAutoFocus'
import { FeatureContextMenu } from './FeatureContextMenu'
import { MapEditModeFrame } from './MapEditModeFrame'
import { FeatureInfoPanel } from './FeatureInfoPanel'
import { MapFeatureLayers } from './MapFeatureLayers'
import { MapStatusOverlay } from './MapStatusOverlay'
import {
    EditPanel,
    FeatureFormModal,
    FilterPanel,
    ImportModal,
    MapDrawLayer,
    Toolbar,
} from './editor'
import { useMapClientController } from './useMapClientController'

/**
 * MapClient - Main map application component
 *
 * Architecture:
 * - useMapClientController: Orchestrates all state (editor, selection, maps)
 * - Toolbar: Project & filter controls
 * - Map: Core map rendering with layers
 * - Overlays: Status, context menu, info panels
 * - Modals: Forms, import, project dialogs
 *
 * OPTIMIZATION NOTES:
 * ✓ useProjectDialog extracted to separate hook
 * ✓ All constants centralized in editor/constants.tsx
 * ✓ MapFeatureLayers modularized with RouteFeature component
 * ✓ State split between useMapEditor and useMapClientController
 * ✓ Memoization applied to derived data
 *
 * Performance:
 * - useDeferredValue for visible features (non-urgent updates)
 * - useMemo for clustering, routing, feature collections
 * - Component re-renders optimized with proper dependency arrays
 */
export default function MapClient({ username }: { username: string }) {
    const { editor, projectDialog, selection, derived, mapConfig, actions } = useMapClientController()
    const contextMenuFeature = selection.contextMenuState
        ? (editor.features.find((feature) => feature._id === selection.contextMenuState?.featureId) ?? null)
        : null

    const handleCopyContextCoordinates = () => {
        const coords = selection.contextMenuState?.coordinates
        if (!coords) return
        navigator.clipboard.writeText(`${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`).catch(() => { })
    }

    const handleOpenContextInMaps = () => {
        const coords = selection.contextMenuState?.coordinates
        if (!coords) return
        window.open(`https://www.google.com/maps?q=${coords[1]},${coords[0]}`, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="relative h-screen w-full overflow-hidden">
            <MapEditModeFrame active={editor.editMode} />

            <Toolbar
                username={username}
                projects={editor.projects}
                activeProjectId={editor.activeProject?.id ?? ''}
                onSelectProject={editor.selectProject}
                onCreateProject={() => projectDialog.setOpen(true)}
                onImportFromProject={editor.importFromProject}
                filtersOpen={editor.filtersOpen}
                onToggleFilters={() => editor.setFiltersOpen((open) => !open)}
                onImport={() => editor.setImportOpen(true)}
                onExport={editor.handleExport}
                onLogout={actions.logout}
                editMode={editor.editMode}
                onToggleEdit={editor.handleToggleEdit}
            />

            <FilterPanel
                open={editor.filtersOpen}
                onClose={() => editor.setFiltersOpen(false)}
                features={editor.features}
                activeTypes={editor.activeTypes}
                activeCategories={editor.activeCategories}
                onToggleType={editor.toggleType}
                onToggleCategory={editor.toggleCategory}
                categories={editor.categories}
            />

            {editor.editMode && (
                <EditPanel
                    drawMode={editor.drawMode}
                    pendingPoints={editor.pendingPoints}
                    features={editor.features}
                    categories={editor.categories}
                    onSelectDrawMode={(mode) => {
                        editor.setDrawMode(mode)
                        editor.setPendingPoints([])
                    }}
                    onFinishDraw={editor.handleFinishDraw}
                    onCancelDraw={editor.handleCancelDraw}
                    onEditFeature={editor.handleEditFeature}
                    onDeleteFeature={editor.handleDeleteFeature}
                    onAddCategory={editor.handleAddCategory}
                    onRenameCategory={editor.handleRenameCategory}
                    onRecolorCategory={editor.handleRecolorCategory}
                    onMoveCategory={editor.handleMoveCategory}
                    onDeleteCategory={editor.handleDeleteCategory}
                />
            )}

            <Map
                center={mapConfig.defaultCenter}
                zoom={mapConfig.defaultZoom}
                styles={mapConfig.mapStyles}
                className="h-full w-full"
            >
                <MapControls
                    showZoom
                    showCompass
                    showLocate
                    showSatellite
                    isSatellite={mapConfig.isSatelliteView}
                    onToggleSatellite={actions.toggleSatelliteView}
                    position="bottom-right"
                />

                <MapAutoFocus
                    features={derived.deferredVisibleFeatures}
                    resolvedRoutes={derived.resolvedRoutes}
                    selectedFeatureId={selection.activeSelectedRouteId ?? selection.activeInfoPanelFeatureId ?? null}
                    editMode={editor.editMode}
                />

                {editor.editMode && (
                    <MapDrawLayer
                        drawMode={editor.drawMode}
                        pendingPoints={editor.pendingPoints}
                        onAddPoint={editor.handleAddPoint}
                    />
                )}

                <MapFeatureLayers
                    categories={editor.categories}
                    clusterData={derived.clusterData}
                    editMode={editor.editMode}
                    linearFeatures={derived.linearFeatures}
                    pointFeatures={derived.pointFeatures}
                    resolvedRoutes={derived.resolvedRoutes}
                    activeInfoPanelFeatureId={selection.activeInfoPanelFeatureId}
                    activeSelectedRouteId={selection.activeSelectedRouteId}
                    onOpenFeatureInfoAction={selection.openFeatureInfo}
                    onSelectRouteAction={selection.setSelectedRouteId}
                    onOpenContextMenuAction={selection.openContextMenu}
                    onUpdateFeatureCoordinatesAction={editor.handleUpdateFeatureCoordinates}
                    onDuplicatePointFeatureAction={editor.handleDuplicatePointFeature}
                />
            </Map>

            <FeatureInfoPanel
                featureId={selection.activeInfoPanelFeatureId}
                features={editor.features}
                onCloseAction={() => selection.openFeatureInfo(null)}
                onEditAction={editor.handleEditFeature}
                onDeleteAction={editor.handleDeleteFeature}
                onUpdateCustomFieldsAction={editor.handleUpdateFeatureCustomFields}
            />

            <FeatureContextMenu
                state={selection.contextMenuState}
                featureType={contextMenuFeature?.type}
                onCloseAction={selection.closeContextMenu}
                onViewInfoAction={() => selection.openFeatureInfo(selection.contextMenuState?.featureId ?? null)}
                onEditAction={() => contextMenuFeature && editor.handleEditFeature(contextMenuFeature)}
                onDeleteAction={() => {
                    if (!selection.contextMenuState?.featureId) return
                    editor.handleDeleteFeature(selection.contextMenuState.featureId)
                    if (selection.activeInfoPanelFeatureId === selection.contextMenuState.featureId) {
                        selection.openFeatureInfo(null)
                    }
                }}
                onCopyCoordsAction={handleCopyContextCoordinates}
                onOpenInMapsAction={handleOpenContextInMaps}
            />

            <MapStatusOverlay
                editMode={editor.editMode}
                visibleCount={derived.deferredVisibleFeatures.length}
                totalCount={editor.features.length}
                activeTypesCount={editor.activeTypes.size}
                activeCategoriesCount={editor.activeCategories.size}
                summary={derived.summary}
                visibilityRatio={derived.visibilityRatio}
                routingCount={derived.routingIds.size}
            />

            <ImportModal
                open={editor.importOpen}
                onClose={() => editor.setImportOpen(false)}
                onImport={editor.handleImportRows}
            />

            <FeatureFormModal
                open={editor.formOpen}
                initial={editor.formInitial}
                categories={editor.categories}
                onSave={editor.handleFormSave}
                onCancel={editor.handleFormCancel}
            />

            <Dialog
                open={projectDialog.open}
                onOpenChange={(nextOpen) => {
                    projectDialog.setOpen(nextOpen)
                    if (!nextOpen) projectDialog.setName('')
                }}
            >
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Nuevo proyecto</DialogTitle>
                        <DialogDescription>
                            Crea un proyecto para separar categorias y elementos del mapa.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Input
                            value={projectDialog.name}
                            onChange={(event) => projectDialog.setName(event.target.value)}
                            placeholder="Nombre del nuevo proyecto"
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    projectDialog.submit()
                                }
                            }}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => projectDialog.setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={projectDialog.submit} disabled={!projectDialog.name.trim()}>
                            Crear proyecto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
