/** HTTP methods we can encounter in capture. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

/** Flat header map — values are always strings after normalization. */
export interface HeaderMap {
  [name: string]: string
}

/** A fully captured HTTP exchange (detail panel payload). */
export interface RequestRecord {
  id: string
  method: HttpMethod
  endpoint: string
  status: number
  duration: number
  /** ISO 8601 timestamp — the UI formats it as relative time. */
  timestamp: string
  requestHeaders: HeaderMap
  responseHeaders: HeaderMap
  requestBody: string | null
  responseBody: string
  /** True when this entry was produced by a replay, not by the capture middleware. */
  replayed: boolean
  /** Id of the request this entry replays (only set when replayed). */
  replayOf?: string
  /** Origin label for multi-source setups (default: "default"). */
  source?: string
}

/**
 * Lightweight row for list views + WebSocket pushes.
 * Deliberately excludes bodies and headers to keep payloads small.
 */
export interface RequestSummary {
  id: string
  method: HttpMethod
  endpoint: string
  status: number
  duration: number
  timestamp: string
  source?: string
}

/** Optional edits applied before a replay fires. */
export interface ReplayOverride {
  method?: HttpMethod
  headers?: HeaderMap
  body?: string
}

/** Client-side error report sent to POST /api/errors. */
export interface ErrorReport {
  type: string
  message: string
  file?: string
  line?: number
  stack?: string[]
}

/** Errors are grouped by type|message|file|line in the store. */
export interface ErrorGroup {
  id: string
  type: string
  message: string
  file: string
  line: number
  count: number
  /** ISO 8601 timestamp of the most recent occurrence. */
  lastSeen: string
  stack: string[]
}

/** Messages pushed over the WebSocket feed. */
export type WsEvent =
  | { type: 'hello'; uptime: number }
  | { type: 'new_request'; request: RequestSummary }
  | { type: 'new_error'; error: ErrorGroup }
