'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { VariantProps } from 'class-variance-authority'
import { useTheme } from 'next-themes'

import {
    ThemeToggler as ThemeTogglerPrimitive,
    type Direction,
    type Resolved,
    type ThemeSelection,
} from '@/components/animate-ui/primitives/effects/theme-toggler'
import { buttonVariants } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'

const getIcon = (
    effective: ThemeSelection,
    resolved: Resolved,
    modes: ThemeSelection[],
) => {
    const theme = modes.includes('system') ? effective : resolved
    return theme === 'system' ? (
        <Monitor className="h-4 w-4" />
    ) : theme === 'dark' ? (
        <Moon className="h-4 w-4" />
    ) : (
        <Sun className="h-4 w-4" />
    )
}

const getNextTheme = (
    effective: ThemeSelection,
    modes: ThemeSelection[],
): ThemeSelection => {
    const i = modes.indexOf(effective)
    if (i === -1) return modes[0] ?? 'light'
    return modes[(i + 1) % modes.length] ?? 'light'
}

type ThemeTogglerButtonProps = React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        modes?: ThemeSelection[]
        onImmediateChange?: (theme: ThemeSelection) => void
        direction?: Direction
    }

function ThemeTogglerButton({
    variant = 'outline',
    size = 'icon-sm',
    modes = ['light', 'dark', 'system'],
    direction = 'ltr',
    onImmediateChange,
    onClick,
    className,
    ...props
}: ThemeTogglerButtonProps) {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const safeTheme: ThemeSelection = mounted
        ? (theme as ThemeSelection) ?? 'system'
        : 'system'
    const safeResolvedTheme: Resolved = mounted
        ? (resolvedTheme as Resolved) ?? 'light'
        : 'light'

    return (
        <ThemeTogglerPrimitive
            theme={safeTheme}
            resolvedTheme={safeResolvedTheme}
            setTheme={setTheme}
            direction={direction}
            onImmediateChange={onImmediateChange}
        >
            {({ effective, resolved, toggleTheme }) => (
                <button
                    data-slot="theme-toggler-button"
                    className={cn(buttonVariants({ variant, size, className }))}
                    onClick={(e) => {
                        onClick?.(e)
                        toggleTheme(getNextTheme(effective, modes))
                    }}
                    {...props}
                >
                    {getIcon(effective, resolved, modes)}
                </button>
            )}
        </ThemeTogglerPrimitive>
    )
}

export { ThemeTogglerButton, type ThemeTogglerButtonProps }