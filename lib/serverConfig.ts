import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const SERVER_URL_KEY = 'odin_api_url'

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
}

/**
 * Normalize a user-provided address into an absolute http(s) base URL.
 *
 * `192.168.1.50:8000` becomes `http://192.168.1.50:8000/api`, a trailing
 * slash is removed, and a bare origin gets the backend's `/api` prefix.
 */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname) return null
  if (parsed.username || parsed.password) return null

  parsed.hash = ''
  parsed.search = ''

  const path = parsed.pathname.replace(/\/+$/, '')
  parsed.pathname = path === '' ? '/api' : path

  return parsed.toString().replace(/\/+$/, '')
}

function expoDevHost(): string | null {
  const constants = Constants as typeof Constants & {
    expoGoConfig?: { debuggerHost?: string | null }
  }
  const hostUri =
    Constants.expoConfig?.hostUri ??
    constants.expoGoConfig?.debuggerHost ??
    null
  if (!hostUri) return null
  const host = hostUri.split(':')[0]?.trim()
  return host && !isLoopback(host) ? host : null
}

function envServerUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (!configured) return null
  return normalizeServerUrl(configured)
}

/** Synchronous default used before the SecureStore value is loaded. */
export function defaultServerUrl(): string {
  const env = envServerUrl()
  if (env) {
    const hostname = new URL(env).hostname
    if (!isLoopback(hostname)) return env
  }

  const host = expoDevHost()
  if (host) return `http://${host}:8000/api`

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://127.0.0.1:8000/api'
}

/**
 * True when the environment already points somewhere useful (Expo Go on the
 * LAN or an explicit non-loopback EXPO_PUBLIC_API_URL). A standalone APK with
 * neither needs the user to configure a server on first launch.
 */
export function isServerExplicitlyConfigured(): boolean {
  const env = envServerUrl()
  if (env) {
    const hostname = new URL(env).hostname
    if (!isLoopback(hostname)) return true
  }
  return expoDevHost() !== null
}

export async function loadStoredServerUrl(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(SERVER_URL_KEY)
    return stored ? normalizeServerUrl(stored) : null
  } catch {
    return null
  }
}

export async function saveStoredServerUrl(url: string): Promise<string> {
  const normalized = normalizeServerUrl(url)
  if (!normalized) {
    throw new Error('Endereço inválido. Use, por exemplo, http://192.168.1.50:8000/api')
  }
  await SecureStore.setItemAsync(SERVER_URL_KEY, normalized)
  return normalized
}

export async function clearStoredServerUrl(): Promise<void> {
  await SecureStore.deleteItemAsync(SERVER_URL_KEY).catch(() => undefined)
}
