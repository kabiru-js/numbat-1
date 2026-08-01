import { performance } from 'node:perf_hooks'
import type { Request, Response, NextFunction } from 'express'
import { genId, decodeBody } from './utils'
import type { Store } from './store'
import { REPLAY_MARKER } from './replay'
import type { HeaderMap, HttpMethod, RequestRecord } from './types'

const DEBUG = process.env.NUMBAT_DEBUG_CAPTURE === '1'
const dbg = (msg: string): void => {
  if (DEBUG) console.error(`[capture] ${msg}`)
}

export interface CaptureOptions {
  /** Path prefixes that must never be captured (Numbat's own API, …). */
  skipPrefixes?: string[]
  /** Per-side body capture limit in bytes. */
  maxBodyBytes?: number
  /** Extra header names (lowercase) whose values are redacted by default. */
  sensitiveHeaders?: string[]
  /** When true, sensitive header values are stored verbatim. */
  logSensitiveHeaders?: boolean
  /** Origin label stamped on every captured request (default: "default"). */
  source?: string
}

const DEFAULT_SENSITIVE = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
])

/**
 * Express-compatible capture middleware. Mount FIRST, before routes and body
 * parsers. Capture is strictly fire-and-forget — the request lifecycle is
 * never awaited, and every capture operation is guarded so a throw can never
 * break the request flow.
 */
export function createCaptureMiddleware(store: Store, options: CaptureOptions = {}) {
  const skipPrefixes = options.skipPrefixes ?? ['/api/']
  const maxBodyBytes = options.maxBodyBytes ?? 100_000
  const sensitive = new Set([...DEFAULT_SENSITIVE, ...(options.sensitiveHeaders ?? [])])
  const revealSensitive = options.logSensitiveHeaders === true
  const source = options.source ?? 'default'

  function filterHeaders(headers: Record<string, string | string[] | undefined>): HeaderMap {
    const out: HeaderMap = {}
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue
      const joined = Array.isArray(value) ? value.join(', ') : String(value)
      out[name] = sensitive.has(name.toLowerCase()) && !revealSensitive ? '[REDACTED]' : joined
    }
    return out
  }

  return function captureMiddleware(req: Request, res: Response, next: NextFunction): void {
    const path = req.originalUrl ?? req.url ?? ''
    if (skipPrefixes.some((p) => path.startsWith(p))) return next()
    // Replay traffic is recorded explicitly (with `replayed: true`) by the
    // replay handler — skip it here so a replay shows up exactly once.
    if (req.headers[REPLAY_MARKER] === 'true') return next()
    dbg(`init ${req.method} ${path}`)

    const started = performance.now()
    const record: RequestRecord = {
      id: genId('req'),
      method: (req.method ?? 'GET') as HttpMethod,
      endpoint: path,
      status: 0,
      duration: 0,
      timestamp: new Date().toISOString(),
      requestHeaders: filterHeaders(req.headers),
      responseHeaders: {},
      requestBody: null,
      responseBody: '',
      replayed: false,
      source,
    }

    // ── Request body — passive collection, never consumed ──────────────────
    // Node streams fan chunks out to every 'data' listener, so adding one here
    // does NOT steal the body from downstream parsers.
    const reqChunks: Buffer[] = []
    let reqBytes = 0
    let reqBodyFinalized = false
    const onData = (chunk: Buffer) => {
      try {
        if (reqBytes >= maxBodyBytes) return
        const room = maxBodyBytes - reqBytes
        reqChunks.push(Buffer.isBuffer(chunk) ? chunk.subarray(0, room) : Buffer.from(chunk).subarray(0, room))
        reqBytes += room
      } catch {
        /* never break the request */
      }
    }
    // The request stream can end AFTER the response finishes (a fast route may
    // respond before Node finishes draining the request body), so these are
    // never detached — they finalize the shared record even post-response.
    const finalizeRequestBody = () => {
      if (reqBodyFinalized) return
      reqBodyFinalized = true
      try {
        record.requestBody = decodeBody(reqChunks, req.headers['content-type'])
      } catch {
        /* never break the request */
      }
    }
    req.on('data', onData)
    req.on('end', finalizeRequestBody)
    req.on('aborted', finalizeRequestBody)

    // ── Response body — layered capture ────────────────────────────────────
    const resChunks: Buffer[] = []
    let resBytes = 0
    let sendBody: string | undefined

    const captureChunk = (chunk: unknown) => {
      try {
        if (resBytes >= maxBodyBytes) return
        if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) return
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        const room = maxBodyBytes - resBytes
        resChunks.push(buf.subarray(0, room))
        resBytes += Math.min(buf.length, room)
      } catch {
        /* never break the request */
      }
    }

    // Layer 1 — Express high-level methods (cleanest, post-serialisation string).
    const origSend = res.send.bind(res)
    const origJson = res.json.bind(res)
    res.send = (function send(body: unknown) {
      try {
        if (body !== undefined && body !== null) {
          if (typeof body === 'string') {
            sendBody = body
            dbg(`send(string) captured: ${body.slice(0, 50)}`)
          } else if (typeof body === 'number' || typeof body === 'boolean') sendBody = String(body)
          else if (Buffer.isBuffer(body)) sendBody = `[binary body · ${body.length} bytes]`
          else if (ArrayBuffer.isView(body)) sendBody = `[binary body · ${body.byteLength} bytes]`
          else {
            sendBody = JSON.stringify(body)
            dbg(`send(object) captured: ${sendBody.slice(0, 50)}`)
          }
        }
      } catch {
        /* never break the request */
      }
      return origSend(body)
    }) as typeof res.send
    res.json = (function json(obj: unknown) {
      try {
        if (obj !== undefined && obj !== null) {
          sendBody = JSON.stringify(obj)
          dbg(`json captured: ${sendBody.slice(0, 50)}`)
        }
      } catch {
        /* never break the request */
      }
      return origJson(obj)
    }) as typeof res.json

    // Layer 2 — Node stream level (universal fallback for raw writes, streaming
    // handlers, or anything that bypasses send/json).
    const origWrite = res.write.bind(res)
    const origEnd = res.end.bind(res)
    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      captureChunk(chunk)
      dbg(`write(chunk=${typeof chunk})`)
      return (origWrite as (...args: unknown[]) => boolean)(chunk, ...rest)
    }) as unknown as typeof res.write
    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      captureChunk(chunk)
      dbg(`end(chunk=${typeof chunk}${typeof chunk === 'string' ? ` len=${chunk.length}` : ''})`)
      return (origEnd as (...args: unknown[]) => unknown)(chunk, ...rest)
    }) as unknown as typeof res.end

    // ── Finalize on finish/close ───────────────────────────────────────────
    let finalized = false
    const finalize = () => {
      if (finalized) return
      finalized = true
      try {
        // NOTE: request 'data'/'end' listeners are intentionally NOT detached —
        // the request stream can finish after the response, and finalizing the
        // request body late still lands in the shared record.
        record.status = res.statusCode
        record.duration = Math.max(0, Math.round(performance.now() - started))
        record.responseHeaders = filterHeaders(res.getHeaders() as Record<string, string | string[] | undefined>)
        dbg(`finalize resChunks=${resChunks.length} sendBody=${sendBody === undefined ? 'undefined' : sendBody.slice(0, 50)}`)
        if (resChunks.length > 0) {
          record.responseBody = decodeBody(resChunks, String(res.getHeader('content-type') ?? '')) ?? ''
        } else if (sendBody !== undefined) {
          record.responseBody = sendBody
        }
        dbg(`add id=${record.id} body=${JSON.stringify(record.responseBody).slice(0, 80)}`)
        store.addRequest(record)
      } catch {
        /* capture must never propagate — fire-and-forget */
      }
    }
    res.on('finish', finalize)
    res.on('close', finalize)

    next()
  }
}
