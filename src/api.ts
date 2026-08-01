/**
 * Numbat API client — typed fetch wrappers, real-time WebSocket feed,
 * and a lightweight time-ago formatter.
 *
 * The backend runs at `http://localhost:9000` by default.
 * Override with VITE_NUMBAT_URL (e.g. `http://localhost:8080`).
 */

// ── Types (mirror the server contract) ────────────────────────────────────────

export interface RequestSummary {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  endpoint: string
  status: number
  duration: number
  /** ISO 8601 — use `timeAgo` for display. */
  timestamp: string
  /** Origin label (defaults to "default"). */
  source?: string
}

export interface Request extends RequestSummary {
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  requestBody: string | null
  responseBody: string
}

export interface ErrorGroup {
  id: string
  type: string
  message: string
  file: string
  line: number
  count: number
  /** ISO 8601 — use `timeAgo` for display. */
  lastSeen: string
  stack: string[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_NUMBAT_URL as string | undefined) ?? 'http://localhost:9000'
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws'

// ── REST helpers ──────────────────────────────────────────────────────────────

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Numbat API ${path} failed with status ${res.status}`)
  return res.json()
}

async function postEmpty(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Numbat API ${path} failed with status ${res.status}`)
}

export interface ReplayOverride {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export function fetchRequests(): Promise<{ requests: RequestSummary[] }> {
  return getJSON('/api/requests')
}

export function fetchRequest(id: string): Promise<{ request: Request }> {
  return getJSON(`/api/requests/${id}`)
}

export function fetchErrors(): Promise<{ errors: ErrorGroup[] }> {
  return getJSON('/api/errors')
}

/** Fetch a readable `curl` command that reproduces the request. */
export async function fetchCurl(id: string): Promise<string> {
  const data = await getJSON<{ curl: string }>(`/api/requests/${id}/curl`)
  return data.curl
}

/** Re-run a request, optionally overriding method/headers/body first. */
export async function replayRequest(id: string, override?: ReplayOverride): Promise<void> {
  const res = await fetch(`${API_BASE}/api/requests/${id}/replay`, {
    method: 'POST',
    headers: override !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: override !== undefined ? JSON.stringify(override) : undefined,
  })
  if (!res.ok) throw new Error(`Numbat API replay failed with status ${res.status}`)
}

export function resolveError(id: string): Promise<void> {
  return postEmpty(`/api/errors/${id}/resolve`)
}

// ── Time formatting ───────────────────────────────────────────────────────────

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── WebSocket singleton ───────────────────────────────────────────────────────

type Listener<T> = (data: T) => void

const listeners = {
  request: new Set<Listener<RequestSummary>>(),
  error: new Set<Listener<ErrorGroup>>(),
  connection: new Set<Listener<boolean | null>>(),
}

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0

function notifyConnection(value: boolean | null) {
  listeners.connection.forEach((l) => l(value))
}

function connect(): void {
  let ws: WebSocket
  try {
    ws = new WebSocket(WS_URL)
  } catch (err) {
    // Invalid URL or blocked by the environment — retry shortly instead of
    // throwing an uncaught error.
    console.error('[numbat] ws connect failed:', err)
    reconnectTimer = setTimeout(connect, 5000)
    return
  }
  socket = ws

  socket.onopen = () => {
    reconnectAttempts = 0
    notifyConnection(true)
  }

  socket.onmessage = (ev) => {
    let msg: unknown
    try {
      msg = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (msg && typeof msg === 'object') {
      const m = msg as Record<string, unknown>
      try {
        if (m.type === 'new_request' && m.request && typeof m.request === 'object') {
          listeners.request.forEach((l) => l(m.request as RequestSummary))
        } else if (m.type === 'new_error' && m.error && typeof m.error === 'object') {
          listeners.error.forEach((l) => l(m.error as ErrorGroup))
        }
      } catch (err) {
        // A subscriber error must never escape as an uncaught exception.
        console.error('[numbat] ws listener error:', err)
      }
    }
  }

  socket.onclose = () => {
    notifyConnection(false)
    // Exponential backoff, capped at 15s.
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts), 15_000)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(connect, delay)
  }

  socket.onerror = () => {
    // onclose always follows onerror, so no need to act here.
  }
}

function ensureConnected(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  connect()
}

/**
 * Subscribe to real-time request capture. Returns an unsubscribe function.
 * The WebSocket connects lazily on the first subscription and auto-reconnects.
 */
export function onNewRequest(handler: Listener<RequestSummary>): () => void {
  listeners.request.add(handler)
  ensureConnected()
  return () => {
    listeners.request.delete(handler)
  }
}

export function onNewError(handler: Listener<ErrorGroup>): () => void {
  listeners.error.add(handler)
  ensureConnected()
  return () => {
    listeners.error.delete(handler)
  }
}

/**
 * Receive connection changes (true = connected, false = disconnected,
 * null = connecting/unknown).
 */
export function onConnectionChange(handler: Listener<boolean | null>): () => void {
  listeners.connection.add(handler)
  ensureConnected()
  return () => {
    listeners.connection.delete(handler)
  }
}
