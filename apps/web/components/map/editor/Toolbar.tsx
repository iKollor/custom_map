'use client'

import {
    ChevronDown,
    Download,
    Filter,
    FolderOpen,
    Layers,
    LogOut,
    Menu,
    Pencil,
    Plus,
    Upload,
    User,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@workspace/ui/components/select'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer'
import { Separator } from '@workspace/ui/components/separator'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/animate-ui/components/animate/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { ClusterToggle } from '@/components/cluster-toggle'

interface ToolbarProps {
    username: string
    projects: Array<{ id: string; name: string }>
    activeProjectId: string
    onSelectProject: (projectId: string) => void
    onCreateProject: () => void
    onImportFromProject: (sourceProjectId: string) => void
    onToggleFilters: () => void
    filtersOpen: boolean
    clusteringEnabled: boolean
    onToggleClustering: () => void
    onImport: () => void
    onExport: () => void
    onLogout: () => void
    editMode: boolean
    onToggleEdit: () => void
}

export function Toolbar(props: ToolbarProps) {
    return (
        <TooltipProvider>
            {/* Desktop toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 hidden items-start justify-between gap-3 px-3 md:flex">
                <DesktopLeftGroup {...props} />
                <DesktopRightGroup {...props} />
            </div>

            {/* Mobile toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 md:hidden">
                <MobileBar {...props} />
            </div>
        </TooltipProvider>
    )
}

/* -------------------------------------------------------------------------- */
/*                               Desktop (≥ md)                               */
/* -------------------------------------------------------------------------- */

function DesktopLeftGroup({
    projects,
    activeProjectId,
    onSelectProject,
    onCreateProject,
    onImportFromProject,
    onToggleFilters,
    filtersOpen,
    onImport,
    onExport,
    editMode,
    onToggleEdit,
}: ToolbarProps) {
    const sourceProjects = projects.filter((project) => project.id !== activeProjectId)

    return (
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
            <Select value={activeProjectId} onValueChange={onSelectProject}>
                <SelectTrigger
                    size="sm"
                    className="h-8 min-w-44 border-0 bg-transparent px-2 text-xs font-medium shadow-none focus:ring-0"
                    aria-label="Seleccionar proyecto"
                >
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Proyecto..." />
                </SelectTrigger>
                <SelectContent>
                    {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                            {project.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={onCreateProject}
                        aria-label="Nuevo proyecto"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Nuevo proyecto</TooltipContent>
            </Tooltip>

            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 px-2 text-xs"
                                aria-label="Traer de proyecto"
                            >
                                Traer
                                <ChevronDown className="h-3 w-3 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Copiar elementos de otro proyecto</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-52">
                    {sourceProjects.length === 0 ? (
                        <DropdownMenuItem disabled>Sin proyectos disponibles</DropdownMenuItem>
                    ) : (
                        sourceProjects.map((project) => (
                            <DropdownMenuItem key={project.id} onClick={() => onImportFromProject(project.id)}>
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                {project.name}
                            </DropdownMenuItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <span className="mx-1 h-5 w-px bg-border" />

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant={filtersOpen ? 'default' : 'ghost'}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={onToggleFilters}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Filtros
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Filtrar por tipo / categoria</TooltipContent>
            </Tooltip>

            <span className="mx-1 h-5 w-px bg-border" />

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={onImport}
                    >
                        <Upload className="h-3.5 w-3.5" />
                        Importar
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Importar CSV</TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={onExport}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Exportar
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
            </Tooltip>

            <span className="mx-1 h-5 w-px bg-border" />

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant={editMode ? 'default' : 'ghost'}
                        className={`h-8 gap-1.5 px-2.5 text-xs ${editMode ? 'bg-[#6e00a3] text-white hover:bg-[#560080]' : ''}`}
                        onClick={onToggleEdit}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        {editMode ? 'Editando' : 'Editar'}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{editMode ? 'Salir del modo edicion' : 'Entrar en modo edicion'}</TooltipContent>
            </Tooltip>
        </div>
    )
}

function DesktopRightGroup({ username, onLogout, clusteringEnabled, onToggleClustering }: ToolbarProps) {
    return (
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
            <ThemeToggle />

            <ClusterToggle clusteringEnabled={clusteringEnabled} onToggleClustering={onToggleClustering} />

            <span className="mx-1 h-5 w-px bg-border" />

            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                            >
                                <User className="h-3.5 w-3.5 text-primary" />
                                {username}
                                <ChevronDown className="h-3 w-3 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Cuenta</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-700">
                        <LogOut className="h-3.5 w-3.5" />
                        Cerrar sesion
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/*                                Mobile (< md)                               */
/* -------------------------------------------------------------------------- */

function MobileBar({
    username,
    projects,
    activeProjectId,
    onSelectProject,
    onCreateProject,
    onImportFromProject,
    onToggleFilters,
    filtersOpen,
    clusteringEnabled,
    onToggleClustering,
    onImport,
    onExport,
    onLogout,
    editMode,
    onToggleEdit,
}: ToolbarProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const sourceProjects = projects.filter((project) => project.id !== activeProjectId)
    const activeProject = projects.find((p) => p.id === activeProjectId)

    const closeAnd = (fn: () => void) => () => {
        setMenuOpen(false)
        // Defer action so the drawer closes smoothly before other UI opens.
        requestAnimationFrame(() => fn())
    }

    return (
        <>
            {/* Hamburger + Project */}
            <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-border/60 bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
                <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
                    <DrawerTrigger asChild>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            aria-label="Abrir menú"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent className="p-0">
                        <DrawerHeader className="border-b">
                            <DrawerTitle className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                {username}
                            </DrawerTitle>
                            <DrawerDescription className="truncate">
                                Proyecto: {activeProject?.name ?? 'Sin proyecto'}
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto p-3">
                            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Proyecto
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-11 w-full justify-start gap-3"
                                onClick={closeAnd(onCreateProject)}
                            >
                                <Plus className="h-4 w-4" />
                                Nuevo proyecto
                            </Button>

                            {sourceProjects.length > 0 && (
                                <>
                                    <p className="px-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Traer elementos de
                                    </p>
                                    {sourceProjects.map((project) => (
                                        <Button
                                            key={project.id}
                                            type="button"
                                            variant="ghost"
                                            className="h-11 w-full justify-start gap-3"
                                            onClick={closeAnd(() => onImportFromProject(project.id))}
                                        >
                                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{project.name}</span>
                                        </Button>
                                    ))}
                                </>
                            )}

                            <Separator className="my-2" />

                            <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Datos
                            </p>
                            <Button
                                type="button"
                                variant={filtersOpen ? 'default' : 'ghost'}
                                className="h-11 w-full justify-start gap-3"
                                onClick={closeAnd(onToggleFilters)}
                            >
                                <Filter className="h-4 w-4" />
                                Filtros
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-11 w-full justify-start gap-3"
                                onClick={closeAnd(onImport)}
                            >
                                <Upload className="h-4 w-4" />
                                Importar CSV
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-11 w-full justify-start gap-3"
                                onClick={closeAnd(onExport)}
                            >
                                <Download className="h-4 w-4" />
                                Exportar CSV
                            </Button>

                            <Separator className="my-2" />

                            <Button
                                type="button"
                                variant={editMode ? 'default' : 'outline'}
                                className={`h-11 w-full justify-start gap-3 ${editMode ? 'bg-[#6e00a3] text-white hover:bg-[#560080]' : ''}`}
                                onClick={closeAnd(onToggleEdit)}
                            >
                                <Pencil className="h-4 w-4" />
                                {editMode ? 'Salir de edición' : 'Modo edición'}
                            </Button>

                            <Separator className="my-2" />

                            <div className="flex items-center justify-between px-2 py-1">
                                <span className="text-xs font-medium text-muted-foreground">Tema</span>
                                <ThemeToggle />
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                className="mt-2 h-11 w-full justify-start gap-3 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                                onClick={closeAnd(onLogout)}
                            >
                                <LogOut className="h-4 w-4" />
                                Cerrar sesión
                            </Button>
                        </div>
                    </DrawerContent>
                </Drawer>

                <Select value={activeProjectId} onValueChange={onSelectProject}>
                    <SelectTrigger
                        size="sm"
                        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-xs font-medium shadow-none focus:ring-0"
                        aria-label="Seleccionar proyecto"
                    >
                        <FolderOpen className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Proyecto..." />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                                {project.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Quick actions (edit + filters) */}
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
                <Button
                    type="button"
                    size="icon-sm"
                    variant={filtersOpen ? 'default' : 'ghost'}
                    className="h-9 w-9"
                    onClick={onToggleFilters}
                    aria-label="Filtros"
                    aria-pressed={filtersOpen}
                >
                    <Filter className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    size="icon-sm"
                    variant={editMode ? 'default' : 'ghost'}
                    className={`h-9 w-9 ${editMode ? 'bg-[#6e00a3] text-white hover:bg-[#560080]' : ''}`}
                    onClick={onToggleEdit}
                    aria-label={editMode ? 'Salir de edición' : 'Modo edición'}
                    aria-pressed={editMode}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </div>

            <div className="pointer-events-auto fixed left-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-30 md:hidden">
                <div className="rounded-xl border border-border/60 bg-background/95 px-2.5 py-2 shadow-lg backdrop-blur-sm">
                    <ClusterToggle clusteringEnabled={clusteringEnabled} onToggleClustering={onToggleClustering} />
                </div>
            </div>
        </>
    )
}
