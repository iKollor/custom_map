"use client"

import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  return (
    <ThemeTogglerButton
      className={className}
      variant="outline"
      size="icon-sm"
      modes={["light", "dark", "system"]}
      aria-label="Cambiar tema"
      title="Cambiar tema"
    />
  )
}