'use client'

import { useState, useCallback } from 'react'
import { Check, Copy, Share2, AlertCircle } from 'lucide-react'
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

interface ShareDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    projectName: string
    shareToken: string | null | undefined
    onGenerateToken: (projectId: string) => void
    onRevokeToken: (projectId: string) => void
}

export function ShareDialog({
    open,
    onOpenChange,
    projectId,
    projectName,
    shareToken,
    onGenerateToken,
    onRevokeToken,
}: ShareDialogProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = useCallback(() => {
        if (!shareToken) return
        const url = `${window.location.origin}/shared/${shareToken}`
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [shareToken])

    const shareUrl = shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${shareToken}` : ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        Compartir proyecto
                    </DialogTitle>
                    <DialogDescription>
                        Permite a cualquier persona ver los datos del proyecto "{projectName}" sin necesidad de iniciar sesión.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!shareToken ? (
                        <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                            <p className="mb-4 text-sm text-muted-foreground">
                                Este proyecto es privado. Genera un enlace público para compartirlo en modo de solo lectura.
                            </p>
                            <Button onClick={() => onGenerateToken(projectId)} className="w-full">
                                Generar enlace público
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-foreground">Enlace público (Solo lectura)</label>
                                <div className="flex gap-2">
                                    <Input readOnly value={shareUrl} className="font-mono text-xs" />
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        onClick={handleCopy}
                                        className="shrink-0"
                                        title="Copiar enlace"
                                    >
                                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-md border border-amber-200/50 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                                    <p className="text-xs text-amber-800 dark:text-amber-400">
                                        Cualquier persona con este enlace podrá ver todos los elementos del mapa de este proyecto. No podrán realizar cambios.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                    {shareToken && (
                        <Button
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de que quieres revocar el acceso? El enlace actual dejará de funcionar.')) {
                                    onRevokeToken(projectId)
                                }
                            }}
                        >
                            Revocar enlace
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
