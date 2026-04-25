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
import {
    FeatureFormValuesSchema,
    MapProjectSchema,
    StoredStateSchema,
    type CategoryDef,
    type CsvRow,
    type DrawMode,
    type FeatureType,
    type FeatureFormValues,
    type MapProject,
    type ParsedFeature,
    type StoredState,
} from './types'
import { z } from 'zod'
import { buildBaselineMeta, type BaselineMeta } from '@/lib/projectsMerge'

const STORAGE_KEY = 'map-editor-projects-v1'

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
        const parsedData = JSON.parse(raw)
        const parsed = StoredStateSchema.safeParse(parsedData)
        if (!parsed.success) {
            console.warn('[safeParseStoredState] Storage structure invalid:', parsed.error.issues)
            return null
        }

        const projects = parsed.data.projects.map((project) => {
            // Dedupe features by name+coordinates (defensive against past duplicates)
            const seen = new Set<string>()
            const features = project.features.filter((feature) => {
                const key = `${feature.name}::${feature.coordinates}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            return {
                ...project,
                categories: project.categories.map((category) => ({
                    ...category,
                    parentId: category.parentId ?? null,
                })),
                features,
            }
        })

        if (!projects.length) return null

        const activeProjectId = projects.some((project) => project.id === parsed.data.activeProjectId)
            ? parsed.data.activeProjectId
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
            parentId: category.parentId ?? null,
            subcategories: Array.from(new Set(category.subcategories ?? [])),
        })
    }

    for (const category of incoming) {
        const existing = byName.get(category.name)
        if (!existing) {
            byName.set(category.name, {
                ...category,
                id: makeId(),
                parentId: category.parentId ?? null,
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
    // Identificador estable de este cliente para que el servidor no nos eco-envie
    // por SSE nuestras propias escrituras.
    const clientIdRef = useRef<string>('')
    if (!clientIdRef.current) {
        clientIdRef.current =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
    // Cuando aplicamos un snapshot recibido por SSE no debemos volver a hacer PUT
    // (evita loops eco entre clientes).
    const applyingRemoteRef = useRef(false)
    // Baseline = vista del estado tal como esta confirmada en el servidor segun
    // este cliente. Se envia al server en cada PUT para que pueda hacer merge
    // correcto: distingue entre "feature que no incluyo porque la borre" y
    // "feature que no conozco porque otro la agrego en paralelo".
    const baselineRef = useRef<BaselineMeta | null>(null)
    // Cola de un snapshot remoto recibido por SSE mientras teniamos cambios
    // locales sin guardar. Se descarta cuando aplicamos la respuesta fusionada
    // del PUT (que ya contiene esos cambios remotos).
    const queuedRemoteRef = useRef<{ data: StoredState; updatedAt: string } | null>(null)
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

    const [activeTypes, setActiveTypes] = useState<Set<FeatureType>>(new Set())
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())
    const [forcedTooltipTypes, setForcedTooltipTypes] = useState<Set<string>>(new Set())
    const [forcedTooltipCategories, setForcedTooltipCategories] = useState<Set<string>>(new Set())

    const [filtersOpen, setFiltersOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    const [editMode, setEditMode] = useState(false)
    const [drawMode, setDrawMode] = useState<DrawMode>(null)
    const [pendingPoints, setPendingPoints] = useState<[number, number][]>([])
    const [formOpen, setFormOpen] = useState(false)
    const [formInitial, setFormInitial] = useState<Partial<FeatureFormValues>>({})

    // Aplica un snapshot recibido del servidor (via SSE o respuesta de PUT) sin
    // que el effect que persiste vuelva a hacer PUT (evita loop eco) y
    // actualizando el baseline con el que el server hara merge en futuros PUTs.
    const applyRemoteState = useCallback(
        (state: StoredState, updatedAt: string | null) => {
            applyingRemoteRef.current = true
            setProjects(state.projects)
            setActiveProjectId((current) =>
                state.projects.some((project) => project.id === current)
                    ? current
                    : state.activeProjectId,
            )
            setLastSyncedAt(updatedAt)
            baselineRef.current = buildBaselineMeta(state, updatedAt)
            setSyncStatus('saved')
        },
        [],
    )

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
                    baselineRef.current = buildBaselineMeta(serverState, result.updatedAt)
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

    // Suscripcion en tiempo real: escucha snapshots emitidos por otros clientes
    // a traves de Server-Sent Events y los aplica localmente sin recargar.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

        let source: EventSource | null = null
        let openedOnce = false
        let cancelled = false

        const refetchSnapshot = async () => {
            try {
                const response = await fetch('/api/projects', {
                    credentials: 'same-origin',
                    cache: 'no-store',
                })
                if (!response.ok) return
                const result = (await response.json()) as { data: unknown; updatedAt: string | null }
                if (cancelled || !result.data) return
                const parsed = safeParseStoredState(JSON.stringify(result.data))
                if (!parsed) return
                applyRemoteState(parsed, result.updatedAt)
            } catch {
                /* ignore */
            }
        }

        const connect = () => {
            source = new EventSource('/api/projects/stream', { withCredentials: true })

            source.addEventListener('open', () => {
                if (openedOnce) {
                    // Reconexion: pudimos habernos perdido eventos. Resincroniza desde DB.
                    void refetchSnapshot()
                }
                openedOnce = true
            })

            source.addEventListener('update', (event) => {
                try {
                    const payload = JSON.parse((event as MessageEvent).data) as {
                        senderId: string | null
                        data: unknown
                        updatedAt: string
                    }
                    if (payload.senderId && payload.senderId === clientIdRef.current) return

                    const parsed = safeParseStoredState(JSON.stringify(payload.data))
                    if (!parsed) return

                    // Si tenemos cambios locales sin guardar (debounce o PUT en
                    // vuelo), NO sobrescribimos el estado: encolamos el remoto.
                    // Cuando nuestro PUT llegue al server, este hara merge y nos
                    // devolvera el snapshot fusionado (que ya incluye estos
                    // cambios remotos). Evita el bug de "los demas pierden sus
                    // edits porque se reemplaza su estado en memoria".
                    const hasLocalDirty =
                        pendingPayloadRef.current !== null || inFlightRef.current
                    if (hasLocalDirty) {
                        queuedRemoteRef.current = { data: parsed, updatedAt: payload.updatedAt }
                        return
                    }

                    applyRemoteState(parsed, payload.updatedAt)
                } catch {
                    /* ignore malformed event */
                }
            })

            // EventSource reconecta solo en error; nada que hacer aqui.
        }

        connect()

        return () => {
            cancelled = true
            if (source) source.close()
        }
    }, [applyRemoteState])

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

        // Si este render fue resultado de aplicar un snapshot remoto (SSE o
        // respuesta merged de un PUT), NO debemos hacer un nuevo PUT con esos
        // datos: causaria un eco/loop. Importante: NO tocamos el timer ni el
        // pendingPayloadRef existente — si el usuario tenia cambios locales
        // sin guardar deben seguir su curso al server.
        if (applyingRemoteRef.current) {
            applyingRemoteRef.current = false
            return
        }

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
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Client-Id': clientIdRef.current,
                    },
                    body: JSON.stringify({
                        state: payloadToSend,
                        baseline: baselineRef.current ?? undefined,
                    }),
                })

                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const result = (await response.json()) as {
                    updatedAt?: string
                    data?: unknown
                }

                // El server puede devolver un estado fusionado (merge con
                // adiciones concurrentes de otros clientes). Aplicarlo localmente
                // para que este cliente vea los cambios remotos sin recargar.
                if (result.data) {
                    const merged = safeParseStoredState(JSON.stringify(result.data))
                    if (merged) {
                        // Solo aplicar el merge si NO hay un nuevo cambio local
                        // pendiente: si el usuario siguio editando mientras el
                        // PUT estaba en vuelo, su edicion ya esta en
                        // pendingPayloadRef y reemplazar el estado lo perderia.
                        if (!pendingPayloadRef.current) {
                            applyRemoteState(merged, result.updatedAt ?? null)
                        } else {
                            // Solo refrescamos el baseline para que el siguiente
                            // PUT lleve el descriptor correcto.
                            baselineRef.current = buildBaselineMeta(
                                merged,
                                result.updatedAt ?? null,
                            )
                            setLastSyncedAt(result.updatedAt ?? new Date().toISOString())
                            setSyncStatus('saved')
                        }
                    }
                } else {
                    setLastSyncedAt(result.updatedAt ?? new Date().toISOString())
                    setSyncStatus('saved')
                }

                // Despues de aplicar el merge ya tenemos lo de los demas. La
                // cola de remoto deferido es redundante.
                queuedRemoteRef.current = null
            } catch {
                setSyncStatus('offline')
            } finally {
                inFlightRef.current = false
                // Si se acumularon mas cambios locales mientras guardabamos,
                // disparar otro flush.
                if (pendingPayloadRef.current) {
                    setTimeout(() => {
                        void flush()
                    }, 0)
                } else if (queuedRemoteRef.current) {
                    // Habia un snapshot remoto encolado (raro tras aplicar la
                    // respuesta merged, pero por completitud).
                    const queued = queuedRemoteRef.current
                    queuedRemoteRef.current = null
                    applyRemoteState(queued.data, queued.updatedAt)
                }
            }
        }

        // (Re)programa debounce. Reemplaza el timer existente para extender el
        // periodo cada vez que llega un cambio local nuevo.
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null
            void flush()
        }, 800)

        // Sin cleanup: el timer DEBE sobrevivir a re-renders provocados por
        // applyRemoteState. De lo contrario se pierden los cambios locales del
        // cliente que esta editando concurrentemente.
    }, [activeProjectId, projects, applyRemoteState])

    // Cleanup al desmontar: cancelar cualquier timer pendiente.
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [])

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
                if (drawMode === 'section' && prev.length >= 4) {
                    const first = prev[0]
                    const last = prev[prev.length - 1]
                    const alreadyClosed = !!first && !!last && first[0] === last[0] && first[1] === last[1]
                    if (alreadyClosed) return prev
                }

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

    const handleCreatePointAtCoordinates = useCallback(
        (point: [number, number]) => {
            setDrawMode(null)
            setPendingPoints([point])
            setFormInitial({
                type: 'point',
                coordinates: coordsToWKT([point], 'point'),
                category: categories[0]?.name ?? '',
            })
            setFormOpen(true)
        },
        [categories],
    )

    const handleFinishDraw = useCallback(() => {
        if (!drawMode) return

        if (drawMode === 'route' && pendingPoints.length < 2) return

        if (drawMode === 'section') {
            if (pendingPoints.length < 4) return
            const first = pendingPoints[0]
            const last = pendingPoints[pendingPoints.length - 1]
            const closed = !!first && !!last && first[0] === last[0] && first[1] === last[1]
            if (!closed) return
        }

        const coordinatesForSave =
            drawMode === 'section' && pendingPoints.length >= 3
                ? (() => {
                    const first = pendingPoints[0]
                    const last = pendingPoints[pendingPoints.length - 1]
                    if (!first || !last) return pendingPoints
                    const closed = first[0] === last[0] && first[1] === last[1]
                    return closed ? pendingPoints : [...pendingPoints, first]
                })()
                : pendingPoints

        setFormInitial({
            type: drawMode,
            coordinates: coordsToWKT(coordinatesForSave, drawMode),
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
                        ? ({ ...feature, ...raw, type, _coords: coords, _raw: raw } as ParsedFeature)
                        : feature,
                )
            } else {
                const newFeature = {
                    _id: makeId(),
                    _coords: coords,
                    _raw: raw,
                    type,
                    name: values.name,
                    category: values.category,
                    subcategory: values.subcategory,
                    description: values.description,
                    coordinates: values.coordinates,
                } as ParsedFeature
                nextFeatures = [...nextFeatures, newFeature]
            }

            const nextCategories = catsFromFeatures(nextFeatures, project.categories)

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
                        : (normalizedCoords as [number, number][])

                    return {
                        ...feature,
                        coordinates,
                        _coords: parsedCoords,
                        _raw: {
                            ...feature._raw,
                            coordinates,
                            type: feature.type,
                        },
                    } as ParsedFeature
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

    const handleAddCategory = useCallback((parentId: string | null = null) => {
        updateActiveProject((project) => {
            const name = `Categoria ${project.categories.length + 1}`
            const color = PALETTE[project.categories.length % PALETTE.length] ?? '#40A7F4'
            return {
                ...project,
                categories: [
                    ...project.categories,
                    { id: makeId(), name, color, parentId, subcategories: [] },
                ],
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

    const handleSetCategoryParent = useCallback((id: string, parentId: string | null) => {
        if (id === parentId) return

        updateActiveProject((project) => {
            const byId = new Map(project.categories.map((category) => [category.id, category]))

            // Avoid cycles in hierarchy
            let current = parentId
            while (current) {
                if (current === id) return project
                current = byId.get(current)?.parentId ?? null
            }

            return {
                ...project,
                categories: project.categories.map((category) =>
                    category.id === id ? { ...category, parentId } : category,
                ),
            }
        })
    }, [updateActiveProject])

    const handleSetFeatureCategory = useCallback((id: string, categoryId: string | null) => {
        updateActiveProject((project) => {
            const feature = project.features.find(f => f._id === id)
            if (!feature) return project

            const targetCategory = categoryId ? project.categories.find(c => c.id === categoryId) : null

            // Si el drop fue directo en raíz o sin categoría
            if (!targetCategory) {
                return {
                    ...project,
                    features: project.features.map(f =>
                        f._id === id ? {
                            ...f,
                            category: '',
                            subcategory: '',
                            _raw: { ...f._raw, category: '', subcategory: '' }
                        } : f
                    )
                }
            }

            // Identificar el padreen caso de ser subcategoría
            let categoryName = targetCategory.name
            let subcategoryName = ''

            if (targetCategory.parentId) {
                const parent = project.categories.find(c => c.id === targetCategory.parentId)
                if (parent) {
                    categoryName = parent.name
                    subcategoryName = targetCategory.name
                }
            }

            return {
                ...project,
                features: project.features.map(f =>
                    f._id === id ? {
                        ...f,
                        category: categoryName,
                        subcategory: subcategoryName,
                        _raw: { ...f._raw, category: categoryName, subcategory: subcategoryName }
                    } : f
                )
            }
        })
    }, [updateActiveProject])

    const handleReorderCategory = useCallback(
        (draggedId: string, targetId: string, placement: 'before' | 'after' | 'inside') => {
            if (draggedId === targetId) return

            updateActiveProject((project) => {
                const categories = [...project.categories]
                const draggedIndex = categories.findIndex((category) => category.id === draggedId)
                const targetIndex = categories.findIndex((category) => category.id === targetId)
                if (draggedIndex < 0 || targetIndex < 0) return project

                const dragged = categories[draggedIndex]
                const target = categories[targetIndex]
                if (!dragged || !target) return project

                const byId = new Map(categories.map((category) => [category.id, category]))
                let current: string | null = target.id
                while (current) {
                    if (current === dragged.id) return project
                    current = byId.get(current)?.parentId ?? null
                }

                const withoutDragged = categories.filter((category) => category.id !== dragged.id)
                const normalizedDragged = {
                    ...dragged,
                    parentId:
                        placement === 'inside'
                            ? target.id
                            : (target.parentId ?? null),
                }

                if (placement === 'inside') {
                    return {
                        ...project,
                        categories: [...withoutDragged, normalizedDragged],
                    }
                }

                const insertAt = withoutDragged.findIndex((category) => category.id === target.id)
                if (insertAt < 0) return project

                const finalIndex = placement === 'before' ? insertAt : insertAt + 1
                withoutDragged.splice(finalIndex, 0, normalizedDragged)

                return {
                    ...project,
                    categories: withoutDragged,
                }
            })
        },
        [updateActiveProject],
    )

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
        downloadCSV(features, categories, `${(activeProject?.name ?? 'proyecto').replace(/\s+/g, '_').toLowerCase()}_export.csv`)
    }, [features, categories, activeProject])

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

    const toggleForcedTooltipType = useCallback((type: string) => {
        setForcedTooltipTypes((prev) => {
            const next = new Set(prev)
            next.has(type) ? next.delete(type) : next.add(type)
            return next
        })
    }, [])

    const toggleForcedTooltipCategory = useCallback((category: string) => {
        setForcedTooltipCategories((prev) => {
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
        handleCreatePointAtCoordinates,
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
        handleSetCategoryParent,
        handleSetFeatureCategory,
        handleReorderCategory,
        handleDeleteCategory,
        handleImportRows,
        handleExport,
        toggleType,
        toggleCategory,
        forcedTooltipTypes,
        forcedTooltipCategories,
        toggleForcedTooltipType,
        toggleForcedTooltipCategory,
        handleToggleEdit,
    }
}
