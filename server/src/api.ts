import { Router, json } from 'express'
import { genId } from './utils'
import type { Store } from './store'
import { replayRequest } from './replay'
import { generateCurl } from './curl'
import { saveSession, loadSession } from './session'
import type { ErrorReport, HeaderMap, HttpMethod, ReplayOverride, RequestRecord } from './types'

/**
 * Numbat's REST API. Mounted under /api, which the capture middleware skips,
 * so Numbat never records its own traffic.
 */
export function createApiRouter(store: Store): Router {
  const router = Router()

  // The UI runs in the Vite dev server (another port/origin), so be permissive.
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  router.use(json({ limit: '256kb' }))

  // ── Health ──────────────────────────────────────────────────────────────────

  router.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime(), ...store.health() })
  })

  // ── Requests ────────────────────────────────────────────────────────────────

  /**
   * Summary rows for the table. Optional query filters (all applied in memory,
   * the store is never mutated):
   *  - method=GET            exact method match
   *  - status=2xx|3xx|4xx|5xx  status class
   *  - search=users            substring match on endpoint
   *  - minDuration=100         duration >= value (ms)
   *  - maxDuration=1000        duration <= value (ms)
   *  - source=backend          source label match
   */
  router.get('/requests', (req, res) => {
    const { method, status, search, minDuration, maxDuration, source } = req.query

    let records = store.getRequests()

    if (typeof method === 'string' && method) {
      const m = method.toUpperCase()
      records = records.filter((r) => r.method === m)
    }
    const statusFilter = parseStatusFilter(typeof status === 'string' ? status : undefined)
    if (statusFilter) records = records.filter((r) => statusFilter(r.status))
    if (typeof search === 'string' && search) {
      const needle = search.toLowerCase()
      records = records.filter((r) => r.endpoint.toLowerCase().includes(needle))
    }
    const min = parseNumber(minDuration)
    if (min !== undefined) records = records.filter((r) => r.duration >= min)
    const max = parseNumber(maxDuration)
    if (max !== undefined) records = records.filter((r) => r.duration <= max)
    if (typeof source === 'string' && source) {
      records = records.filter((r) => (r.source ?? 'default') === source)
    }

    res.json({ requests: records.map((r) => summarize(r)) })
  })

  /** Full record for the detail panel. */
  router.get('/requests/:id', (req, res) => {
    const request = store.getRequest(req.params.id)
    if (!request) {
      res.status(404).json({ error: 'not_found', message: `No request with id "${req.params.id}".` })
      return
    }
    res.json({ request })
  })

  /** Readable curl command that reproduces the captured request. */
  router.get('/requests/:id/curl', (req, res) => {
    const request = store.getRequest(req.params.id)
    if (!request) {
      res.status(404).json({ error: 'not_found', message: `No request with id "${req.params.id}".` })
      return
    }
    res.json({ ok: true, curl: generateCurl(request) })
  })

  /**
   * Ingest a captured request from an embedded SDK (or any external source).
   * Accepts a RequestRecord; missing fields are defaulted, an id is generated
   * when absent. The record is stored and pushed live like any capture.
   */
  router.post('/requests', (req, res) => {
    const body = (req.body ?? {}) as Partial<RequestRecord>
    if (typeof body.method !== 'string' || typeof body.endpoint !== 'string') {
      res.status(400).json({ error: 'invalid_request_record', message: '"method" and "endpoint" (strings) are required.' })
      return
    }
    const record: RequestRecord = {
      id: typeof body.id === 'string' ? body.id : genId('req'),
      method: body.method as HttpMethod,
      endpoint: body.endpoint,
      status: typeof body.status === 'number' ? body.status : 0,
      duration: typeof body.duration === 'number' ? body.duration : 0,
      timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
      requestHeaders: sanitizeHeaders(body.requestHeaders),
      responseHeaders: sanitizeHeaders(body.responseHeaders),
      requestBody: typeof body.requestBody === 'string' ? body.requestBody : null,
      responseBody: typeof body.responseBody === 'string' ? body.responseBody : '',
      replayed: body.replayed === true,
      replayOf: typeof body.replayOf === 'string' ? body.replayOf : undefined,
      source: typeof body.source === 'string' ? body.source : 'default',
    }
    store.addRequest(record)
    res.status(201).json({ ok: true, id: record.id })
  })

  /**
   * Re-run a captured request; the result is recorded and pushed live.
   * Optional JSON body edits the request before it fires:
   *   { method?, headers?, body? }
   */
  router.post('/requests/:id/replay', async (req, res) => {
    const original = store.getRequest(req.params.id)
    if (!original) {
      res.status(404).json({ error: 'not_found', message: `No request with id "${req.params.id}".` })
      return
    }

    const override = extractOverride(req.body)
    const result = await replayRequest(original, { override })
    if (!result.ok) {
      res.json({ ok: false, error: result.error ?? 'replay_failed' })
      return
    }

    const replayRecord: RequestRecord = {
      id: genId('req'),
      method: override?.method ?? original.method,
      endpoint: original.endpoint,
      status: result.status,
      duration: result.duration,
      timestamp: new Date().toISOString(),
      requestHeaders: { ...original.requestHeaders, ...(override?.headers ?? {}) },
      responseHeaders: result.responseHeaders ?? {},
      requestBody: override?.body !== undefined ? override.body : original.requestBody,
      responseBody: result.responseBody ?? '',
      replayed: true,
      replayOf: original.id,
      source: original.source,
    }
    store.addRequest(replayRecord)
    res.json({ ok: true, requestId: replayRecord.id })
  })

  // ── Errors ──────────────────────────────────────────────────────────────────

  /** Grouped, active errors, newest first. */
  router.get('/errors', (_req, res) => {
    res.json({ errors: store.getErrors() })
  })

  /** Client report endpoint — instrumented apps send exceptions here. */
  router.post('/errors', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (typeof body.type !== 'string' || typeof body.message !== 'string') {
      res.status(400).json({ error: 'invalid_error_report', message: '"type" and "message" (strings) are required.' })
      return
    }
    const report: ErrorReport = {
      type: body.type,
      message: body.message,
      file: typeof body.file === 'string' ? body.file : undefined,
      line: typeof body.line === 'number' ? body.line : undefined,
      stack: Array.isArray(body.stack) ? body.stack.filter((s): s is string => typeof s === 'string') : undefined,
    }
    const group = store.addError(report)
    res.status(201).json({ ok: true, id: group.id, count: group.count })
  })

  /** Mark an error group resolved. */
  router.post('/errors/:id/resolve', (req, res) => {
    const ok = store.resolveError(req.params.id)
    if (!ok) {
      res.status(404).json({ error: 'not_found', message: `No open error group with id "${req.params.id}".` })
      return
    }
    res.json({ ok: true })
  })

  // ── Sessions ────────────────────────────────────────────────────────────────

  /** Persist the current store to `.numbat/session.json`. */
  router.post('/session/save', async (_req, res) => {
    try {
      const saved = await saveSession(store)
      res.json({ ok: true, savedAt: saved.savedAt, requests: saved.requests.length, errors: saved.errors.length })
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'session_save_failed' })
    }
  })

  /** Restore the store from `.numbat/session.json`. */
  router.post('/session/load', async (_req, res) => {
    const result = await loadSession(store)
    if (!result) {
      res.status(500).json({ ok: false, error: 'no_valid_session' })
      return
    }
    res.json({ ok: true, ...result })
  })

  router.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown Numbat API route.' })
  })

  return router
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function summarize(r: RequestRecord) {
  return {
    id: r.id,
    method: r.method,
    endpoint: r.endpoint,
    status: r.status,
    duration: r.duration,
    timestamp: r.timestamp,
    source: r.source,
  }
}

function parseStatusFilter(value: string | undefined): ((status: number) => boolean) | undefined {
  if (value === '2xx') return (s) => s >= 200 && s < 300
  if (value === '3xx') return (s) => s >= 300 && s < 400
  if (value === '4xx') return (s) => s >= 400 && s < 500
  if (value === '5xx') return (s) => s >= 500
  return undefined
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function sanitizeHeaders(headers: unknown): HeaderMap {
  if (!headers || typeof headers !== 'object') return {}
  const out: HeaderMap = {}
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function extractOverride(body: unknown): ReplayOverride | undefined {
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  const override: ReplayOverride = {}
  if (typeof b.method === 'string') override.method = b.method as HttpMethod
  if (b.headers && typeof b.headers === 'object') override.headers = sanitizeHeaders(b.headers)
  if (typeof b.body === 'string') override.body = b.body
  return Object.keys(override).length > 0 ? override : undefined
}
