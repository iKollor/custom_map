'use client'

import * as React from 'react'
import { flushSync } from 'react-dom'

type ThemeSelection = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'
type Direction = 'btt' | 'ttb' | 'ltr' | 'rtl'

type ChildrenRender =
    | React.ReactNode
    | ((state: {
        resolved: Resolved
        effective: ThemeSelection
        toggleTheme: (theme: ThemeSelection) => void
    }) => React.ReactNode)

type ThemeTogglerProps = {
    theme: ThemeSelection
    resolvedTheme: Resolved
    setTheme: (theme: ThemeSelection) => void
    direction?: Direction
    onImmediateChange?: (theme: ThemeSelection) => void
    children?: ChildrenRender
}

type ViewTransition = {
    ready: Promise<void>
}

type DocumentWithViewTransition = Document & {
    startViewTransition?: (callback: () => void) => ViewTransition
}

function getSystemEffective(): Resolved {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
}

function getClipKeyframes(direction: Direction): [string, string] {
    switch (direction) {
        case 'ltr':
            return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
        case 'rtl':
            return ['inset(0 0 0 100%)', 'inset(0 0 0 0)']
        case 'ttb':
            return ['inset(0 0 100% 0)', 'inset(0 0 0 0)']
        case 'btt':
            return ['inset(100% 0 0 0)', 'inset(0 0 0 0)']
        default:
            return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
    }
}

function ThemeToggler({
    theme,
    resolvedTheme,
    setTheme,
    onImmediateChange,
    direction = 'ltr',
    children,
}: ThemeTogglerProps) {
    const [preview, setPreview] = React.useState<null | {
        effective: ThemeSelection
        resolved: Resolved
    }>(null)

    const [current, setCurrent] = React.useState<{
        effective: ThemeSelection
        resolved: Resolved
    }>({
        effective: theme,
        resolved: resolvedTheme,
    })

    React.useEffect(() => {
        if (
            preview &&
            theme === preview.effective &&
            resolvedTheme === preview.resolved
        ) {
            setPreview(null)
        }
    }, [theme, resolvedTheme, preview])

    React.useEffect(() => {
        if (!preview) {
            setCurrent({ effective: theme, resolved: resolvedTheme })
        }
    }, [theme, resolvedTheme, preview])

    const [fromClip, toClip] = getClipKeyframes(direction)

    const toggleTheme = React.useCallback(
        async (nextTheme: ThemeSelection) => {
            const resolved = nextTheme === 'system' ? getSystemEffective() : nextTheme

            setCurrent({ effective: nextTheme, resolved })
            onImmediateChange?.(nextTheme)

            if (nextTheme === 'system' && resolved === resolvedTheme) {
                setTheme(nextTheme)
                return
            }

            const doc = document as DocumentWithViewTransition

            if (!doc.startViewTransition) {
                flushSync(() => {
                    setPreview({ effective: nextTheme, resolved })
                })
                setTheme(nextTheme)
                return
            }

            await doc.startViewTransition(() => {
                flushSync(() => {
                    setPreview({ effective: nextTheme, resolved })
                    document.documentElement.classList.toggle('dark', resolved === 'dark')
                })
            }).ready

            document.documentElement
                .animate(
                    { clipPath: [fromClip, toClip] },
                    {
                        duration: 700,
                        easing: 'ease-in-out',
                        pseudoElement: '::view-transition-new(root)',
                    },
                )
                .finished.finally(() => {
                    setTheme(nextTheme)
                })
        },
        [onImmediateChange, resolvedTheme, fromClip, toClip, setTheme],
    )

    return (
        <>
            {typeof children === 'function'
                ? children({
                    effective: preview?.effective ?? current.effective,
                    resolved: preview?.resolved ?? current.resolved,
                    toggleTheme,
                })
                : children}
            <style>{`::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
        </>
    )
}

export {
    ThemeToggler,
    type ThemeTogglerProps,
    type ThemeSelection,
    type Resolved,
    type Direction,
}