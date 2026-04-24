import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { PALETTE } from './constants'
import {
    catsFromFeatures,
    coordsToWKT,
    csvRowsToParsed,
    downloadCSV,
    makeId,
    normalizeFeatureType,
    parseCoordinates,
} from './helpers'
import type {
    CategoryDef,
    CsvRow,
    DrawMode,
    FeatureType,
    FeatureFormValues,
    MapProject,
    ParsedFeature,
} from './types'

const STORAGE_KEY = 'map-editor-projects-v1'

type StoredState = {
    activeProjectId: string
    projects: MapProject[]
}

function createProject(name: string): MapProject {
    const now = new Date().toISOString()
    return {
        id: makeId(),
        name,
        createdAt: now,
        updatedAt: now,
        categories: [],
        features: [],
    }
}

function safeParseStoredState(raw: string): StoredState | null {
    try {
        const parsed = JSON.parse(raw) as StoredState
        if (!parsed || !Array.isArray(parsed.projects) || typeof parsed.activeProjectId !== 'string') {
            return null
        }

        const projects = parsed.projects
            .filter((project) => project && typeof project.id === 'string' && typeof project.name === 'string')
            .map((project) => {
                const rawFeatures = Array.isArray(project.features) ? project.features : []
                // Dedupe features by name+coordinates (defensive against past duplicates)
                const seen = new Set<string>()
                const features = rawFeatures.filter((feature: ParsedFeature) => {
                    const key = `${feature?.name ?? ''}::${feature?.coordinates ?? ''}`
                    if (seen.has(key)) return false
                    seen.add(key)
                    return true
                })
                return {
                    ...project,
                    categories: Array.isArray(project.categories) ? project.categories : [],
                    features,
                }
            })

        if (!projects.length) return null

        const activeProjectId = projects.some((project) => project.id === parsed.activeProjectId)
            ? parsed.activeProjectId
            : projects[0]?.id ?? ''

        return { activeProjectId, projects }
    } catch {
        return null
    }
}

function mergeCategories(base: CategoryDef[], incoming: CategoryDef[]): CategoryDef[] {
    const byName = new Map<string, CategoryDef>()

    for (const category of base) {
        byName.set(category.name, {
            ...category,
            subcategories: Array.from(new Set(category.subcategories ?? [])),
        })
    }

    for (const category of incoming) {
        const existing = byName.get(category.name)
        if (!existing) {
            byName.set(category.name, {
                ...category,
                id: makeId(),
                subcategories: Array.from(new Set(category.subcategories ?? [])),
            })
            continue
        }

        byName.set(category.name, {
            ...existing,
            subcategories: Array.from(
                new Set([...(existing.subcategories ?? []), ...(category.subcategories ?? [])]),
            ),
        })
    }

    return Array.from(byName.values())
}

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline'

export function useMapEditor() {
    const [projects, setProjects] = useState<MapProject[]>(() => [createProject('Proyecto principal')])
    const [activeProjectId, setActiveProjectId] = useState<string>(() => '')
    const csvLoadedProjectsRef = useRef<Set<string>>(new Set())
    const hydratedRef = useRef(false)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingPayloadRef = useRef<StoredState | null>(null)
    const inFlightRef = useRef(false)
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

    const [activeTypes, setActiveTypes] = useState<Set<FeatureType>>(new Set())
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())

    const [filtersOpen, setFiltersOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    const [editMode, setEditMode] = useState(false)
    const [drawMode, setDrawMode] = useState<DrawMode>(null)
    const [pendingPoints, setPendingPoints] = useState<[number, number][]>([])
    const [formOpen, setFormOpen] = useState(false)
    const [formInitial, setFormInitial] = useState<Partial<FeatureFormValues>>({})

    useEffect(() => {
        let cancelled = false

        const applyLocalFallback = () => {
            const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
            const parsed = stored ? safeParseStoredState(stored) : null

            if (parsed) {
                setProjects(parsed.projects)
                setActiveProjectId(parsed.activeProjectId)
                return
            }

            const defaultProject = createProject('Proyecto principal')
            setProjects([defaultProject])
            setActiveProjectId(defaultProject.id)
        }

        setSyncStatus('loading')

        fetch('/api/projects', { credentials: 'same-origin', cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json() as Promise<{ data: unknown; updatedAt: string | null }>
            })
            .then((result) => {
                if (cancelled) return

                const serverState =
                    result.data && typeof result.data === 'object'
                        ? safeParseStoredState(JSON.stringify(result.data))
                        : null

                if (serverState) {
                    setProjects(serverState.projects)
                    setActiveProjectId(serverState.activeProjectId)
                    setLastSyncedAt(result.updatedAt)
                    setSyncStatus('saved')
                } else {
                    applyLocalFallback()
                    setSyncStatus('idle')
                }

                hydratedRef.current = true
            })
            .catch(() => {
                if (cancelled) return
                applyLocalFallback()
                hydratedRef.current = true
                setSyncStatus('offline')
            })

        return () => {
            cancelled = true
        }
    }, [])

    // Load routes from CSV if active project is empty (once per project id)
    useEffect(() => {
        if (!activeProjectId || !projects.length) return
        if (csvLoadedProjectsRef.current.has(activeProjectId)) return

        const activeProject = projects.find((p) => p.id === activeProjectId)
        if (!activeProject || activeProject.features.length > 0) return

        csvLoadedProjectsRef.current.add(activeProjectId)

        fetch('/data/routes.csv')
            .then((response) => response.text())
            .then((text) => {
                const result = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true })
                const parsedFeatures = csvRowsToParsed(result.data)

                setProjects((prev) =>
                    prev.map((project) => {
                        if (project.id !== activeProjectId || project.features.length > 0) return project
                        const mergedFeatures = [...project.features, ...parsedFeatures]
                        const mergedCategories = catsFromFeatures(mergedFeatures, project.categories)
                        return {
                            ...project,
                            updatedAt: new Date().toISOString(),
                            features: mergedFeatures,
                            categories: mergedCategories,
                        }
                    }),
                )
            })
            .catch(() => { })
    }, [activeProjectId, projects])

    useEffect(() => {
        if (!activeProjectId || !projects.length || typeof window === 'undefined') return
        const payload: StoredState = { activeProjectId, projects }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

        // Only push to server after the initial hydration (avoid overwriting
        // server state with the empty default before we loaded it).
        if (!hydratedRef.current) return

        pendingPayloadRef.current = payload

        const flush = async () => {
            if (inFlightRef.current) return
            const payloadToSend = pendingPayloadRef.current
            if (!payloadToSend) return

            inFlightRef.current = true
            pendingPayloadRef.current = null
            setSyncStatus('saving')

            try {
                const response = await fetch('/api/projects', {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadToSend),
                })

                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = (await response.json()) as { updatedAt?: string }
                setLastSyncedAt(result.updatedAt ?? new Date().toISOString())
                setSyncStatus('saved')
            } catch {
                setSyncStatus('offline')
            } finally {
                inFlightRef.current = false
                // If more changes piled up while we were saving, flush again.
                if (pendingPayloadRef.current) {
                    setTimeout(flush, 0)
                }
            }
        }

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(flush, 800)

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [activeProjectId, projects])

    const activeProject = useMemo(
        () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
        [projects, activeProjectId],
    )

    const features = activeProject?.features ?? []
    const categories = activeProject?.categories ?? []

    useEffect(() => {
        const nextTypes = new Set(features.map((feature) => feature.type))
        const nextCategories = new Set(categories.map((category) => category.name))

        setActiveTypes(nextTypes)
        setActiveCategories(nextCategories)
    }, [features, categories])

    const updateActiveProject = useCallback((updater: (project: MapProject) => MapProject) => {
        setProjects((prev) =>
            prev.map((project) => {
                if (project.id !== activeProjectId) return project
                const next = updater(project)
                return {
                    ...next,
                    updatedAt: new Date().toISOString(),
                }
            }),
        )
    }, [activeProjectId])

    const addFeatures = useCallback((newFeatures: ParsedFeature[]) => {
        if (!newFeatures.length) return
        updateActiveProject((project) => {
            const mergedFeatures = [...project.features, ...newFeatures]
            const mergedCategories = catsFromFeatures(mergedFeatures, project.categories)
            return {
                ...project,
                features: mergedFeatures,
                categories: mergedCategories,
            }
        })
    }, [updateActiveProject])

    const selectProject = useCallback((projectId: string) => {
        setActiveProjectId(projectId)
        setDrawMode(null)
        setPendingPoints([])
        setFormOpen(false)
    }, [])

    const createNewProject = useCallback((name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return null

        const duplicated = projects.some((project) => project.name.toLowerCase() === trimmed.toLowerCase())
        const projectName = duplicated ? `${trimmed} (${projects.length + 1})` : trimmed

        const project = createProject(projectName)
        setProjects((prev) => [...prev, project])
        setActiveProjectId(project.id)
        setDrawMode(null)
        setPendingPoints([])
        return project
    }, [projects])

    const importFromProject = useCallback((sourceProjectId: string) => {
        const source = projects.find((project) => project.id === sourceProjectId)
        const target = activeProject
        if (!source || !target || source.id === target.id) return

        const includeFeatures = window.confirm(
            `Importar desde "${source.name}".\n\nAceptar: categorias y elementos.\nCancelar: solo categorias y subcategorias.`,
        )

        updateActiveProject((project) => {
            const categoriesMerged = mergeCategories(project.categories, source.categories)

            if (!includeFeatures) {
                return {
                    ...project,
                    categories: categoriesMerged,
                }
            }

            const importedFeatures = source.features.map((feature) => ({
                ...feature,
                _id: makeId(),
                _raw: { ...feature._raw },
            }))

            const mergedFeatures = [...project.features, ...importedFeatures]
            return {
                ...project,
                features: mergedFeatures,
                categories: catsFromFeatures(mergedFeatures, categoriesMerged),
            }
        })
    }, [activeProject, projects, updateActiveProject])

    const handleAddPoint = useCallback(
        (point: [number, number]) => {
            setPendingPoints((prev) => {
                const next = [...prev, point]
                if (drawMode === 'point' && next.length === 1) {
                    setFormInitial({
                        type: 'point',
                        coordinates: coordsToWKT(next, 'point'),
                        category: categories[0]?.name ?? '',
                    })
                    setFormOpen(true)
                }
                return next
            })
        },
        [drawMode, categories],
    )

    const handleFinishDraw = useCallback(() => {
        if (pendingPoints.length < 2) return
        setFormInitial({
            type: drawMode ?? 'route',
            coordinates: coordsToWKT(pendingPoints, drawMode ?? 'route'),
            category: categories[0]?.name ?? '',
        })
        setFormOpen(true)
    }, [pendingPoints, drawMode, categories])

    const handleCancelDraw = useCallback(() => {
        setDrawMode(null)
        setPendingPoints([])
    }, [])

    const handleFormSave = useCallback((values: FeatureFormValues) => {
        const type = normalizeFeatureType(values.type, values.coordinates)
        const coords = parseCoordinates(values.coordinates, type)

        const raw: CsvRow = {
            type,
            name: values.name,
            category: values.category,
            subcategory: values.subcategory,
            description: values.description,
            coordinates: values.coordinates,
        }

        updateActiveProject((project) => {
            let nextFeatures = project.features

            if (values._editId) {
                nextFeatures = nextFeatures.map((feature) =>
                    feature._id === values._editId
                        ? { ...feature, ...raw, type, _coords: coords, _raw: raw }
                        : feature,
                )
            } else {
                const newFeature: ParsedFeature = {
                    _id: makeId(),
                    _coords: coords,
                    _raw: raw,
                    type,
                    name: values.name,
                    category: values.category,
                    subcategory: values.subcategory,
                    description: values.description,
                    coordinates: values.coordinates,
                }
                nextFeatures = [...nextFeatures, newFeature]
            }

            let nextCategories = project.categories
            const selectedCategory = values.category.trim()

            if (selectedCategory && !nextCategories.find((category) => category.name === selectedCategory)) {
                const color = PALETTE[nextCategories.length % PALETTE.length] ?? '#40A7F4'
                nextCategories = [...nextCategories, { id: makeId(), name: selectedCategory, color, subcategories: [] }]
            }

            if (selectedCategory && values.subcategory.trim()) {
                nextCategories = nextCategories.map((category) => {
                    if (category.name !== selectedCategory) return category
                    const set = new Set(category.subcategories ?? [])
                    set.add(values.subcategory.trim())
                    return { ...category, subcategories: Array.from(set) }
                })
            }

            nextCategories = catsFromFeatures(nextFeatures, nextCategories)

            return {
                ...project,
                features: nextFeatures,
                categories: nextCategories,
            }
        })

        setFormOpen(false)
        setDrawMode(null)
        setPendingPoints([])
    }, [updateActiveProject])

    const handleFormCancel = useCallback(() => {
        setFormOpen(false)
        if (!formInitial._editId) {
            setDrawMode(null)
            setPendingPoints([])
        }
    }, [formInitial])

    const handleEditFeature = useCallback((feature: ParsedFeature) => {
        setFormInitial({
            _editId: feature._id,
            name: feature.name,
            type: feature.type,
            category: feature.category,
            subcategory: feature.subcategory,
            description: feature.description,
            coordinates: feature.coordinates,
        })
        setFormOpen(true)
    }, [])

    const handleDeleteFeature = useCallback((id: string) => {
        updateActiveProject((project) => ({
            ...project,
            features: project.features.filter((feature) => feature._id !== id),
        }))
    }, [updateActiveProject])

    const handleUpdateFeatureCoordinates = useCallback(
        (id: string, coords: [number, number][] | [number, number]) => {
            updateActiveProject((project) => ({
                ...project,
                features: project.features.map((feature) => {
                    if (feature._id !== id) return feature

                    const nextCoords = Array.isArray(coords[0])
                        ? (coords as [number, number][])
                        : (coords as [number, number])
                    const normalizedCoords = Array.isArray(nextCoords[0])
                        ? (nextCoords as [number, number][])
                        : [nextCoords as [number, number]]
                    const coordinates = coordsToWKT(normalizedCoords, feature.type)
                    const parsedCoords = feature.type === 'point'
                        ? (normalizedCoords[0] ?? null)
                        : normalizedCoords

                    return {
                        ...feature,
                        coordinates,
                        _coords: parsedCoords,
                        _raw: {
                            ...feature._raw,
                            coordinates,
                            type: feature.type,
                        },
                    }
                }),
            }))
        },
        [updateActiveProject],
    )

    const handleDuplicatePointFeature = useCallback(
        (id: string, nextPoint: [number, number]) => {
            const duplicatedId = makeId()
            let duplicated = false

            updateActiveProject((project) => {
                const source = project.features.find((feature) => feature._id === id)
                if (!source || source.type !== 'point' || !Array.isArray(source._coords) || Array.isArray(source._coords[0])) {
                    return project
                }

                duplicated = true
                const coordinates = coordsToWKT([nextPoint], source.type)
                const duplicate: ParsedFeature = {
                    ...source,
                    _id: duplicatedId,
                    _coords: nextPoint,
                    coordinates,
                    _raw: {
                        ...source._raw,
                        coordinates,
                        type: source.type,
                    },
                    customFields: source.customFields ? { ...source.customFields } : undefined,
                }

                const nextFeatures = [...project.features, duplicate]

                return {
                    ...project,
                    features: nextFeatures,
                    categories: catsFromFeatures(nextFeatures, project.categories),
                }
            })

            return duplicated ? duplicatedId : null
        },
        [updateActiveProject],
    )

    const handleUpdateFeatureCustomFields = useCallback(
        (id: string, customFields: Record<string, string>) => {
            updateActiveProject((project) => ({
                ...project,
                features: project.features.map((feature) =>
                    feature._id === id ? { ...feature, customFields } : feature,
                ),
            }))
        },
        [updateActiveProject],
    )

    const handleAddCategory = useCallback(() => {
        updateActiveProject((project) => {
            const name = `Categoria ${project.categories.length + 1}`
            const color = PALETTE[project.categories.length % PALETTE.length] ?? '#40A7F4'
            return {
                ...project,
                categories: [...project.categories, { id: makeId(), name, color, subcategories: [] }],
            }
        })
    }, [updateActiveProject])

    const handleRenameCategory = useCallback((id: string, name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return

        updateActiveProject((project) => {
            const oldCategory = project.categories.find((category) => category.id === id)
            if (!oldCategory) return project

            const nextCategories = project.categories.map((category) =>
                category.id === id ? { ...category, name: trimmed } : category,
            )

            const nextFeatures = project.features.map((feature) =>
                feature.category === oldCategory.name
                    ? { ...feature, category: trimmed, _raw: { ...feature._raw, category: trimmed } }
                    : feature,
            )

            return {
                ...project,
                categories: nextCategories,
                features: nextFeatures,
            }
        })
    }, [updateActiveProject])

    const handleRecolorCategory = useCallback((id: string, color: string) => {
        updateActiveProject((project) => ({
            ...project,
            categories: project.categories.map((category) =>
                category.id === id ? { ...category, color } : category,
            ),
        }))
    }, [updateActiveProject])

    const handleMoveCategory = useCallback((id: string, direction: 'up' | 'down') => {
        updateActiveProject((project) => {
            const index = project.categories.findIndex((category) => category.id === id)
            if (index < 0) return project

            const next = [...project.categories]
            const swapIndex = direction === 'up' ? index - 1 : index + 1
            if (swapIndex < 0 || swapIndex >= next.length) return project

                ;[next[index], next[swapIndex]] = [next[swapIndex] as CategoryDef, next[index] as CategoryDef]

            return {
                ...project,
                categories: next,
            }
        })
    }, [updateActiveProject])

    const handleDeleteCategory = useCallback((id: string) => {
        updateActiveProject((project) => ({
            ...project,
            categories: project.categories.filter((category) => category.id !== id),
        }))

        setActiveCategories((prev) => {
            const category = categories.find((item) => item.id === id)
            if (!category) return prev
            const next = new Set(prev)
            next.delete(category.name)
            return next
        })
    }, [categories, updateActiveProject])

    const handleImportRows = useCallback((rows: CsvRow[]) => {
        addFeatures(csvRowsToParsed(rows))
    }, [addFeatures])

    const handleExport = useCallback(() => {
        if (!features.length) return
        downloadCSV(features, `${(activeProject?.name ?? 'proyecto').replace(/\s+/g, '_').toLowerCase()}_export.csv`)
    }, [features, activeProject])

    const toggleType = useCallback((type: FeatureType) => {
        setActiveTypes((prev) => {
            const next = new Set(prev)
            next.has(type) ? next.delete(type) : next.add(type)
            return next
        })
    }, [])

    const toggleCategory = useCallback((category: string) => {
        setActiveCategories((prev) => {
            const next = new Set(prev)
            next.has(category) ? next.delete(category) : next.add(category)
            return next
        })
    }, [])

    const handleToggleEdit = useCallback(() => {
        setEditMode((active) => {
            if (active) {
                setDrawMode(null)
                setPendingPoints([])
            }
            return !active
        })
    }, [])

    const visibleFeatures = useMemo(
        () =>
            features.filter(
                (feature) =>
                    activeTypes.has(feature.type) && activeCategories.has(feature.category),
            ),
        [features, activeTypes, activeCategories],
    )

    const projectOptions = useMemo(
        () => projects.map((project) => ({ id: project.id, name: project.name })),
        [projects],
    )

    return {
        projects: projectOptions,
        activeProject,
        features,
        categories,
        visibleFeatures,
        activeTypes,
        activeCategories,
        filtersOpen,
        importOpen,
        editMode,
        drawMode,
        pendingPoints,
        formOpen,
        formInitial,
        syncStatus,
        lastSyncedAt,
        setFiltersOpen,
        setImportOpen,
        setDrawMode,
        setPendingPoints,
        selectProject,
        createNewProject,
        importFromProject,
        handleAddPoint,
        handleFinishDraw,
        handleCancelDraw,
        handleFormSave,
        handleFormCancel,
        handleEditFeature,
        handleDeleteFeature,
        handleUpdateFeatureCoordinates,
        handleDuplicatePointFeature,
        handleUpdateFeatureCustomFields,
        handleAddCategory,
        handleRenameCategory,
        handleRecolorCategory,
        handleMoveCategory,
        handleDeleteCategory,
        handleImportRows,
        handleExport,
        toggleType,
        toggleCategory,
        handleToggleEdit,
    }
}
