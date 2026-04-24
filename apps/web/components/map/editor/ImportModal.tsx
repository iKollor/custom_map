import { AlertCircle, FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import Papa from 'papaparse'
import type { ChangeEvent, DragEvent } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@workspace/ui/components/dialog'
import type { CsvRow } from './types'

interface ImportModalProps {
    open: boolean
    onClose: () => void
    onImport: (rows: CsvRow[]) => void
}

export function ImportModal({ open, onClose, onImport }: ImportModalProps) {
    const [preview, setPreview] = useState<CsvRow[] | null>(null)
    const [fileName, setFileName] = useState('')
    const [parseError, setParseError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    function reset() {
        setPreview(null)
        setFileName('')
        setParseError('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    function handleFile(file: File) {
        setParseError('')
        setFileName(file.name)

        Papa.parse<CsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data
                if (!rows.length) {
                    setParseError('El archivo CSV esta vacio.')
                    return
                }

                const firstRow = rows[0]
                if (!firstRow) {
                    setParseError('El archivo CSV esta vacio.')
                    return
                }

                const missing = ['name', 'coordinates'].filter((key) => !(key in firstRow))
                if (missing.length) {
                    setParseError(`Columnas faltantes: ${missing.join(', ')}`)
                    return
                }

                setPreview(rows)
            },
            error: () => setParseError('Error al leer el archivo CSV.'),
        })
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (file) handleFile(file)
    }

    function handleImport() {
        if (!preview) return
        onImport(preview)
        reset()
        onClose()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    reset()
                    onClose()
                }
            }}
        >
            <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto sm:w-full" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Upload className="h-4 w-4 text-blue-600" />
                        Importar CSV
                    </DialogTitle>
                    <DialogDescription>
                        Carga un archivo CSV para incorporar elementos al proyecto activo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!preview && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(event) => event.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                        >
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    Arrastra tu CSV aqui o{' '}
                                    <span className="text-blue-600 underline underline-offset-2">
                                        haz clic para seleccionar
                                    </span>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Columnas requeridas:{' '}
                                    <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                                        type, name, category, coordinates
                                    </code>
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    {parseError && (
                        <Alert variant="destructive">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <AlertTitle>Error al procesar el CSV</AlertTitle>
                            <AlertDescription>{parseError}</AlertDescription>
                        </Alert>
                    )}

                    {preview && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">
                                    Vista previa - <span className="text-blue-600">{fileName}</span>
                                </span>
                                <span className="text-xs text-muted-foreground">{preview.length} filas</span>
                            </div>
                            <div className="max-h-52 overflow-auto rounded-lg border border-border text-xs">
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-muted/60">
                                        <tr>
                                            {['type', 'name', 'category', 'coordinates'].map((col) => (
                                                <th
                                                    key={col}
                                                    className="border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground"
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 10).map((row, index) => (
                                            <tr
                                                key={index}
                                                className="border-b border-border/50 last:border-0 hover:bg-muted/40"
                                            >
                                                <td className="px-2 py-1.5 text-foreground capitalize">{row.type}</td>
                                                <td className="max-w-35 truncate px-2 py-1.5 text-foreground">
                                                    {row.name}
                                                </td>
                                                <td className="px-2 py-1.5 text-muted-foreground">{row.category}</td>
                                                <td className="max-w-25 truncate px-2 py-1.5 font-mono text-muted-foreground">
                                                    {row.coordinates?.slice(0, 30)}...
                                                </td>
                                            </tr>
                                        ))}
                                        {preview.length > 10 && (
                                            <tr>
                                                <td colSpan={4} className="px-2 py-1.5 text-center text-muted-foreground">
                                                    y {preview.length - 10} filas mas...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            reset()
                            onClose()
                        }}
                    >
                        Cancelar
                    </Button>
                    {preview ? (
                        <Button
                            type="button"
                            onClick={handleImport}
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Importar {preview.length} filas
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            disabled
                        >
                            Importar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
