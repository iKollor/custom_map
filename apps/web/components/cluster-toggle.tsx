"use client"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/animate-ui/components/animate/tooltip'
import { Switch } from '@/components/animate-ui/components/radix/switch'

type ClusterToggleProps = {
    clusteringEnabled: boolean
    onToggleClustering: () => void
    className?: string
}

export function ClusterToggle({
    clusteringEnabled,
    onToggleClustering,
    className,
}: ClusterToggleProps) {
    const label = clusteringEnabled ? 'Cluster activo' : 'Cluster desactivado'
    const hint = clusteringEnabled ? 'Ver todos los puntos' : 'Ver puntos agrupados'

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Cluster</span>
                    <Switch
                        checked={clusteringEnabled}
                        onCheckedChange={onToggleClustering}
                        aria-label={label}
                        title={hint}
                        className={className}
                    />
                </div>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
    )
}
