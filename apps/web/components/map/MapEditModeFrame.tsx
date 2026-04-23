'use client'

import { AnimatePresence, motion } from 'motion/react'

import { THEME_COLORS } from './editor'

type MapEditModeFrameProps = {
    active: boolean
}

export function MapEditModeFrame({ active }: MapEditModeFrameProps) {
    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-0 z-40"
                    aria-hidden="true"
                >
                    <motion.div
                        className="absolute inset-0 border-2 border-[#6e00a3]/70"
                        animate={{
                            borderColor: [`rgba(110,0,163,0.75)`, `rgba(64,167,244,0.72)`, `rgba(110,0,163,0.75)`],
                            boxShadow: [
                                'inset 0 0 0 1px rgba(110,0,163,0.25), 0 0 0 1px rgba(110,0,163,0.15)',
                                'inset 0 0 0 1px rgba(64,167,244,0.24), 0 0 0 1px rgba(64,167,244,0.14)',
                                'inset 0 0 0 1px rgba(110,0,163,0.25), 0 0 0 1px rgba(110,0,163,0.15)',
                            ],
                        }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <motion.div
                        className="absolute inset-2 border border-[#40a7f4]/45"
                        animate={{
                            borderColor: [`rgba(64,167,244,0.48)`, `rgba(110,0,163,0.45)`, `rgba(64,167,244,0.48)`],
                            opacity: [0.8, 1, 0.8],
                        }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <motion.div
                        className="absolute left-0 right-0 top-0 h-0.75"
                        style={{
                            background: `linear-gradient(90deg, rgba(110,0,163,0.0) 0%, rgba(110,0,163,0.95) 30%, rgba(64,167,244,0.95) 70%, rgba(64,167,244,0.0) 100%)`,
                        }}
                        animate={{ x: ['-20%', '20%', '-20%'] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.75"
                        style={{
                            background: `linear-gradient(90deg, rgba(64,167,244,0.0) 0%, rgba(64,167,244,0.95) 30%, rgba(110,0,163,0.95) 70%, rgba(110,0,163,0.0) 100%)`,
                        }}
                        animate={{ x: ['20%', '-20%', '20%'] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}
