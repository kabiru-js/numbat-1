import type { RequestHandler } from 'express'

/**
 * Integration options for `numbat()`. Everything is optional — the defaults
 * capture every request and forward it to a Numbat server on localhost:9000.
 */
export interface NumbatOptions {
  /** Origin label stamped on every captured request (shown/filterable in the UI). */
  source?: string
  /** Extra header names to redact in addition to Numbat's defaults. */
  redactHeaders?: string[]
  /** Per-side body capture limit in bytes (default 100_000). */
  maxBodySize?: number
  /** Where captured records are forwarded (default http://localhost:9000). */
  serverUrl?: string
}

/** The middleware returned by `numbat()` — drop it into `app.use()`. */
export type NumbatMiddleware = RequestHandler
