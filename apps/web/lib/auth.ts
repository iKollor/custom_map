import { z } from 'zod'

export const SESSION_COOKIE = 'map_session'

export const LoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

/** Verifica credenciales contra las variables de entorno */
export function checkCredentials(username: string, password: string): boolean {
    const validUser = process.env.AUTH_USERNAME ?? 'admin'
    const validPass = process.env.AUTH_PASSWORD ?? 'mapa2025'
    return username === validUser && password === validPass
}

/** Valor que se almacena en la cookie de sesión */
export function getSessionToken(): string {
    return process.env.AUTH_SESSION_TOKEN ?? 'dev-token-change-me'
}

/** Comprueba si el valor de la cookie es válido */
export function isValidSessionValue(value: string | undefined): boolean {
    if (!value) return false
    return value === getSessionToken()
}

/** Nombre de usuario configurado */
export function getConfiguredUsername(): string {
    return process.env.AUTH_USERNAME ?? 'admin'
}
