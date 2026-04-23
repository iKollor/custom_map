'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { Map, Layers, Loader2, Lock, User } from 'lucide-react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { ThemeToggle } from '@/components/theme-toggle'
import { GradientBackground } from '@/components/animate-ui/components/backgrounds/gradient'
import {
    RippleButton,
    RippleButtonRipples,
} from '@/components/animate-ui/components/buttons/ripple'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const from = searchParams.get('from') ?? '/map'

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        startTransition(async () => {
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                })
                if (res.ok) {
                    router.push(from)
                    router.refresh()
                } else {
                    const data = (await res.json()) as { error?: string }
                    setError(data.error ?? 'Credenciales inválidas')
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label
                    htmlFor="username"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                    Usuario
                </Label>
                <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        required
                        autoComplete="username"
                        className="h-11 pl-9"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label
                    htmlFor="password"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                    Contraseña
                </Label>
                <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        className="h-11 pl-9"
                    />
                </div>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <RippleButton
                    type="submit"
                    disabled={isPending}
                    className="h-11 w-full gap-2 text-sm font-semibold"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Ingresando…
                        </>
                    ) : (
                        'Ingresar'
                    )}
                    <RippleButtonRipples />
                </RippleButton>
            </motion.div>

            <p className="text-center text-xs text-muted-foreground">
                Plataforma de datos geoespaciales · acceso restringido
            </p>
        </form>
    )
}

export default function LoginPage() {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
            {/* Animated gradient background */}
            <GradientBackground
                className="absolute inset-0 -z-10 from-blue-600 via-indigo-500 to-purple-600 opacity-30 dark:opacity-20"
                transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity }}
            />
            {/* Soft overlay for readability */}
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50/70 via-white/60 to-slate-100/70 backdrop-blur-2xl dark:from-slate-950/80 dark:via-slate-900/70 dark:to-slate-950/80" />

            <ThemeToggle className="absolute top-4 right-4" />

            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-sm"
            >
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-3">
                    <motion.div
                        initial={{ rotate: -8, scale: 0.9 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 ring-1 ring-white/20"
                    >
                        <Map className="h-8 w-8 text-white" />
                        <span className="absolute inset-0 rounded-2xl bg-white/10 mix-blend-overlay" />
                    </motion.div>
                    <div className="text-center">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            Plataforma de Mapas
                        </h1>
                        <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
                    </div>
                </div>

                <Card className="border-border/50 bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            Acceso
                        </CardTitle>
                        <CardDescription>Usa tus credenciales para ingresar al mapa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Suspense>
                            <LoginForm />
                        </Suspense>
                    </CardContent>
                </Card>
            </motion.div>
        </main>
    )
}
