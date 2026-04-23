'use client'

import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * useIsMobile - Detecta si el viewport está por debajo del breakpoint mobile.
 * SSR-safe: retorna false en el primer render y se actualiza tras montar.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
        const update = () => setIsMobile(mql.matches)
        update()
        mql.addEventListener('change', update)
        return () => mql.removeEventListener('change', update)
    }, [breakpoint])

    return isMobile
}
