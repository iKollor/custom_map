import { EventEmitter } from 'node:events'

export type ProjectsUpdateEvent = {
    senderId: string | null
    data: unknown
    updatedAt: string
}

declare global {
    // eslint-disable-next-line no-var
    var __projectsBus: EventEmitter | undefined
}

// Bus singleton process-wide. Permite que el handler PUT publique snapshots
// y que el endpoint SSE los reenvie a todos los clientes conectados.
// Single-instance only: si en el futuro se escala a multiples nodos, mover a Redis pub/sub.
export const projectsBus = global.__projectsBus ?? new EventEmitter()
projectsBus.setMaxListeners(0)

if (!global.__projectsBus) {
    global.__projectsBus = projectsBus
}

export const PROJECTS_UPDATE_EVENT = 'projects:update' as const
