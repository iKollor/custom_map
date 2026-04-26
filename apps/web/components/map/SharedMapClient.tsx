'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { Filter, User } from 'lucide-react'

import { MapProject } from './editor/types'
import { Map, MapControls } from '@/components/ui/map'
import { Button } from '@workspace/ui/components/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { ClusterToggle } from '@/components/cluster-toggle'
import { TooltipProvider } from '@/components/animate-ui/components/animate/tooltip'

import { useSharedMapClientController } from './useSharedMapClientController'
import { MapFeatureLayers } from './MapFeatureLayers'
import { MapAutoFocus } from './MapAutoFocus'
import { FeatureInfoPanel } from './FeatureInfoPanel'
import { FilterPanel } from './editor/FilterPanel'
import { MapStatusOverlay } from './MapStatusOverlay'

export default function SharedMapClient({ project }: { project: MapProject }) {
    const { state, selection, derived, mapConfig, actions } = useSharedMapClientController(project)

    const activeInfoId = selection.activeInfoPanelFeatureId
    const filtersOpen = state.filtersOpen
    const prevFiltersOpenRef = useRef(filtersOpen)
    const prevInfoIdRef = useRef(activeInfoId)

    useEffect(() => {
        const filtersJustOpened = filtersOpen && !prevFiltersOpenRef.current
        const infoJustOpened = activeInfoId !== null && prevInfoIdRef.current === null

        if (filtersJustOpened && activeInfoId !== null) {
            selection.openFeatureInfo(null)
        } else if (infoJustOpened && filtersOpen) {
            actions.setFiltersOpen(false)
        }

        prevFiltersOpenRef.current = filtersOpen
        prevInfoIdRef.current = activeInfoId
    }, [filtersOpen, activeInfoId, selection, actions])

    return (
        <TooltipProvider>
            <div className="relative h-screen w-full overflow-hidden">
                {/* Simplified Toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-start justify-between gap-3 px-3">
                <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border/60 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                    <span className="text-sm font-semibold">{project.name}</span>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button
                        type="button"
                        size="sm"
                        variant={filtersOpen ? 'default' : 'ghost'}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={() => actions.setFiltersOpen(!filtersOpen)}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Filtros</span>
                    </Button>
                </div>
                
                <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
                    <ThemeToggle />
                    <ClusterToggle clusteringEnabled={mapConfig.clusteringEnabled} onToggleClustering={actions.toggleClustering} />
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button asChild type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs font-medium">
                        <Link href="/login">
                            <User className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden sm:inline">Iniciar sesión</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Read-only Badge Overlay */}
            <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20">
                <div className="pointer-events-auto rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[10px] font-medium text-primary backdrop-blur-md shadow-sm">
                    Vista pública · Solo lectura
                </div>
            </div>

            <FilterPanel
                open={state.filtersOpen}
                onClose={() => actions.setFiltersOpen(false)}
                features={project.features}
                activeTypes={state.activeTypes}
                activeCategories={state.activeCategories}
                forcedTooltipTypes={state.forcedTooltipTypes}
                forcedTooltipCategories={state.forcedTooltipCategories}
                onToggleType={actions.toggleType}
                onToggleCategory={actions.toggleCategory}
                onToggleForcedTooltipType={actions.toggleForcedTooltipType}
                onToggleForcedTooltipCategory={actions.toggleForcedTooltipCategory}
                categories={project.categories}
            />

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
                    showSearch
                    showSatellite
                    isSatellite={mapConfig.isSatelliteView}
                    onToggleSatellite={actions.toggleSatelliteView}
                    position="bottom-right"
                />

                <MapAutoFocus
                    features={derived.deferredVisibleFeatures}
                    resolvedRoutes={derived.resolvedRoutes}
                    selectedFeatureId={selection.activeSelectedRouteId ?? selection.activeInfoPanelFeatureId ?? null}
                    editMode={false}
                    contextKey={project.id}
                />

                <MapFeatureLayers
                    categories={project.categories}
                    clusterData={derived.clusterData}
                    editMode={false}
                    clusteringEnabled={mapConfig.clusteringEnabled}
                    linearFeatures={derived.linearFeatures}
                    pointFeatures={derived.pointFeatures}
                    resolvedRoutes={derived.resolvedRoutes}
                    activeInfoPanelFeatureId={selection.activeInfoPanelFeatureId}
                    activeSelectedRouteId={selection.activeSelectedRouteId}
                    forcedTooltipTypes={state.forcedTooltipTypes}
                    forcedTooltipCategories={state.forcedTooltipCategories}
                    onOpenFeatureInfoAction={(id) => selection.openFeatureInfo(id)}
                    onSelectRouteAction={selection.setSelectedRouteId}
                    onOpenContextMenuAction={() => {}} 
                    onUpdateFeatureCoordinatesAction={() => {}} 
                    onDuplicatePointFeatureAction={() => null} 
                />
            </Map>

            <FeatureInfoPanel
                featureId={selection.activeInfoPanelFeatureId}
                features={project.features}
                categories={project.categories}
                onCloseAction={() => selection.openFeatureInfo(null)}
                onEditAction={() => {}}
                onDeleteAction={() => {}}
                onUpdateCustomFieldsAction={() => {}}
                readOnly={true}
            />

                <MapStatusOverlay
                    editMode={false}
                    visibleCount={derived.deferredVisibleFeatures.length}
                    totalCount={project.features.length}
                    activeTypesCount={state.activeTypes.size}
                    activeCategoriesCount={state.activeCategories.size}
                    summary={derived.summary}
                    visibilityRatio={derived.visibilityRatio}
                    routingCount={derived.routingIds.size}
                />
            </div>
        </TooltipProvider>
    )
}
