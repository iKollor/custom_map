import * as React from 'react'

import {
    Files as FilesPrimitive,
    FilesHighlight as FilesHighlightPrimitive,
    FolderItem as FolderItemPrimitive,
    FolderHeader as FolderHeaderPrimitive,
    FolderTrigger as FolderTriggerPrimitive,
    FolderContent as FolderContentPrimitive,
    FolderHighlight as FolderHighlightPrimitive,
    Folder as FolderPrimitive,
    FolderIcon as FolderIconPrimitive,
    FolderLabel as FolderLabelPrimitive,
    FileHighlight as FileHighlightPrimitive,
    File as FilePrimitive,
    FileIcon as FileIconPrimitive,
    FileLabel as FileLabelPrimitive,
    type FilesProps as FilesPrimitiveProps,
    type FilesHighlightProps as FilesHighlightPrimitiveProps,
    type FolderItemProps as FolderItemPrimitiveProps,
    type FolderHeaderProps as FolderHeaderPrimitiveProps,
    type FolderTriggerProps as FolderTriggerPrimitiveProps,
    type FolderContentProps as FolderContentPrimitiveProps,
    type FolderHighlightProps as FolderHighlightPrimitiveProps,
    type FolderProps as FolderPrimitiveProps,
    type FolderIconProps as FolderIconPrimitiveProps,
    type FolderLabelProps as FolderLabelPrimitiveProps,
    type FileHighlightProps as FileHighlightPrimitiveProps,
    type FileProps as FilePrimitiveProps,
    type FileIconProps as FileIconPrimitiveProps,
    type FileLabelProps as FileLabelPrimitiveProps,
} from '@/components/animate-ui/primitives/radix/files'
import { cn } from '@workspace/ui/lib/utils'

type FilesProps = FilesPrimitiveProps

function Files({ className, ...props }: FilesProps) {
    return <FilesPrimitive className={cn('space-y-1', className)} {...props} />
}

type FilesHighlightProps = FilesHighlightPrimitiveProps

function FilesHighlight({ className, ...props }: FilesHighlightProps) {
    return (
        <FilesHighlightPrimitive
            className={cn('rounded-md bg-muted/45', className)}
            {...props}
        />
    )
}

type FolderItemProps = FolderItemPrimitiveProps

function FolderItem({ className, ...props }: FolderItemProps) {
    return <FolderItemPrimitive className={cn('space-y-1', className)} {...props} />
}

type FolderHeaderProps = FolderHeaderPrimitiveProps

function FolderHeader({ className, ...props }: FolderHeaderProps) {
    return <FolderHeaderPrimitive className={cn('m-0', className)} {...props} />
}

type FolderTriggerProps = FolderTriggerPrimitiveProps

function FolderTrigger({ className, ...props }: FolderTriggerProps) {
    return (
        <FolderTriggerPrimitive
            className={cn('w-full text-left outline-none', className)}
            {...props}
        />
    )
}

type FolderContentProps = FolderContentPrimitiveProps

function FolderContent({ className, ...props }: FolderContentProps) {
    return <FolderContentPrimitive className={cn('space-y-1', className)} {...props} />
}

type FolderHighlightProps = FolderHighlightPrimitiveProps

function FolderHighlight({ className, ...props }: FolderHighlightProps) {
    return (
        <FolderHighlightPrimitive
            className={cn('rounded-md bg-muted/45', className)}
            {...props}
        />
    )
}

type FolderProps = FolderPrimitiveProps

function Folder({ className, ...props }: FolderProps) {
    return <FolderPrimitive className={cn('inline-flex items-center gap-2', className)} {...props} />
}

type FolderIconProps = FolderIconPrimitiveProps

function FolderIcon({ className, ...props }: FolderIconProps) {
    return <FolderIconPrimitive className={cn('inline-flex items-center', className)} {...props} />
}

type FolderLabelProps = FolderLabelPrimitiveProps

function FolderLabel({ className, ...props }: FolderLabelProps) {
    return <FolderLabelPrimitive className={cn('truncate', className)} {...props} />
}

type FileHighlightProps = FileHighlightPrimitiveProps

function FileHighlight({ className, ...props }: FileHighlightProps) {
    return <FileHighlightPrimitive className={cn('rounded-md bg-muted/40', className)} {...props} />
}

type FileProps = FilePrimitiveProps

function File({ className, ...props }: FileProps) {
    return <FilePrimitive className={cn('flex items-center gap-2', className)} {...props} />
}

type FileIconProps = FileIconPrimitiveProps

function FileIcon({ className, ...props }: FileIconProps) {
    return <FileIconPrimitive className={cn('inline-flex items-center', className)} {...props} />
}

type FileLabelProps = FileLabelPrimitiveProps

function FileLabel({ className, ...props }: FileLabelProps) {
    return <FileLabelPrimitive className={cn('truncate', className)} {...props} />
}

export {
    Files,
    FilesHighlight,
    FolderItem,
    FolderHeader,
    FolderTrigger,
    FolderContent,
    FolderHighlight,
    Folder,
    FolderIcon,
    FolderLabel,
    FileHighlight,
    File,
    FileIcon,
    FileLabel,
    type FilesProps,
    type FilesHighlightProps,
    type FolderItemProps,
    type FolderHeaderProps,
    type FolderTriggerProps,
    type FolderContentProps,
    type FolderHighlightProps,
    type FolderProps,
    type FolderIconProps,
    type FolderLabelProps,
    type FileHighlightProps,
    type FileProps,
    type FileIconProps,
    type FileLabelProps,
}
