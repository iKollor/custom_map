import type { StoredState, MapProject, ParsedFeature, CategoryDef } from '@/components/map/editor/types'

export type ProjectBaseline = {
    id: string
    featureIds: string[]
    categoryIds: string[]
}

export type BaselineMeta = {
    updatedAt?: string | null
    /** IDs of all projects the client knew about at the time of the baseline. */
    projectIds?: string[]
    projects: ProjectBaseline[]
}

/**
 * Merges an incoming snapshot from a client with the current canonical snapshot
 * stored on the server.
 *
 * Strategy (last-write-wins per entity, with concurrent-addition preservation):
 * - For each project present in both: prefer incoming for known entities
 *   (client's edits win), but keep entities added by other clients after this
 *   client's baseline (concurrent additions are NOT lost).
 * - For each project only in current: keep (project deletions across clients
 *   are not supported — would need explicit signaling).
 * - For each project only in incoming: add.
 *
 * Deletion semantics:
 * - If `baseline` includes an entity id and incoming does NOT, the entity is
 *   considered deleted by this client → it is removed from the merged state.
 * - If `baseline` is missing for a project, current entities not in incoming
 *   are conservatively kept (avoids data loss when client did not send a
 *   baseline).
 */
export function mergeStoredState(
    current: StoredState | null,
    incoming: StoredState,
    baseline?: BaselineMeta,
): StoredState {
    if (!current || !current.projects.length) {
        return incoming
    }

    const currentProjects = new Map(current.projects.map((p) => [p.id, p]))
    const incomingProjects = new Map(incoming.projects.map((p) => [p.id, p]))
    const baselineByProject = new Map((baseline?.projects ?? []).map((b) => [b.id, b]))
    const baselineProjectIds = new Set(baseline?.projectIds ?? [])
    const hasBaselineProjectIds = !!baseline?.projectIds

    const allIds = new Set<string>([...currentProjects.keys(), ...incomingProjects.keys()])
    const mergedProjects: MapProject[] = []

    for (const id of allIds) {
        const cur = currentProjects.get(id)
        const inc = incomingProjects.get(id)

        if (cur && !inc) {
            // Project exists on server but client did not send it.
            if (hasBaselineProjectIds && baselineProjectIds.has(id)) {
                // Client knew about this project and intentionally removed it → delete.
                continue
            }
            // Client never saw this project → keep server's copy.
            mergedProjects.push(cur)
            continue
        }
        if (!cur && inc) {
            mergedProjects.push(inc)
            continue
        }
        if (!cur || !inc) continue

        const base = baselineByProject.get(id)
        const hasBaseline = !!base
        const baseFeatureIds = new Set(base?.featureIds ?? [])
        const baseCategoryIds = new Set(base?.categoryIds ?? [])

        const incomingFeatureIds = new Set(inc.features.map((f) => f._id))
        const incomingCategoryIds = new Set(inc.categories.map((c) => c.id))

        // Start with incoming (client's edits win on shared ids).
        const mergedFeatures: ParsedFeature[] = [...inc.features]
        for (const f of cur.features) {
            if (incomingFeatureIds.has(f._id)) continue
            // Without baseline → keep (avoid losing data).
            // With baseline → keep only if NOT in baseline (= concurrent addition).
            if (hasBaseline && baseFeatureIds.has(f._id)) {
                // Client knew about this feature and didn't include it → deletion.
                continue
            }
            mergedFeatures.push(f)
        }

        const mergedCategories: CategoryDef[] = [...inc.categories]
        for (const c of cur.categories) {
            if (incomingCategoryIds.has(c.id)) continue
            if (hasBaseline && baseCategoryIds.has(c.id)) continue
            mergedCategories.push(c)
        }

        mergedProjects.push({
            ...inc,
            features: mergedFeatures,
            categories: mergedCategories,
        })
    }

    const activeFromIncoming = mergedProjects.some((p) => p.id === incoming.activeProjectId)
        ? incoming.activeProjectId
        : null
    const activeFromCurrent = mergedProjects.some((p) => p.id === current.activeProjectId)
        ? current.activeProjectId
        : null
    const activeProjectId = activeFromIncoming ?? activeFromCurrent ?? mergedProjects[0]?.id ?? ''

    return { activeProjectId, projects: mergedProjects }
}

/** Build a compact baseline descriptor from a StoredState. */
export function buildBaselineMeta(state: StoredState, updatedAt?: string | null): BaselineMeta {
    return {
        updatedAt: updatedAt ?? null,
        projectIds: state.projects.map((project) => project.id),
        projects: state.projects.map((project) => ({
            id: project.id,
            featureIds: project.features.map((feature) => feature._id),
            categoryIds: project.categories.map((category) => category.id),
        })),
    }
}
