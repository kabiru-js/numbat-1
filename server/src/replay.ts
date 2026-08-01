import { performance } from 'node:perf_hooks'
import { isTextualContentType } from './utils'
import type { HeaderMap, RequestRecord, ReplayOverride } from './types'

export interface ReplayResult {
  ok: boolean
  status: number
  duration: number
  error?: string
  responseHeaders?: HeaderMap
  responseBody?: string
}

const DEFAULT_TIMEOUT_MS = 15_000

/** Internal marker so the capture middleware skips replay traffic (it is
 * recorded explicitly by the replay handler with `replayed: true`). */
export const REPLAY_MARKER = 'x-numbat-replay'

/**
 * Headers that must NOT be replayed verbatim: hop-by-hop headers per RFC 7230
 * §6.1, plus length/host/expect which fetch recomputes. Reusing the captured
 * `content-length` with a different override body would desync the connection.
 */
const STRIP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'host',
  'expect',
])

/**
 * Re-run a captured request against the host it was originally sent to.
 * The target is derived from the captured `Host`/`X-Forwarded-Proto` headers,
 * so replaying a request captured from another app on the machine hits that
 * app — not Numbat itself.
 *
 * An optional `override` lets callers swap the method, headers, or body
 * before the request fires (editable replay).
 */
export async function replayRequest(
  record: RequestRecord,
  options: { timeoutMs?: number; override?: ReplayOverride } = {},
): Promise<ReplayResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const override = options.override
  const method = override?.method ?? record.method
  const headers: HeaderMap = { ...record.requestHeaders, ...(override?.headers ?? {}) }
  for (const name of Object.keys(headers)) {
    if (STRIP_HEADERS.has(name.toLowerCase())) delete headers[name]
  }
  const body = override?.body !== undefined ? override.body : record.requestBody
  const target = buildTarget(record)
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(target, {
      method,
      headers: { ...headers, [REPLAY_MARKER]: 'true' },
      body: body ?? undefined,
      signal: controller.signal,
      // Never follow redirects — the redirect response itself is the observation.
      redirect: 'manual',
    })

    const buf = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? undefined
    const responseHeaders: HeaderMap = {}
    res.headers.forEach((value, name) => {
      responseHeaders[name] = value
    })

    return {
      ok: true,
      status: res.status,
      duration: Math.round(performance.now() - started),
      responseHeaders,
      responseBody: isTextualContentType(contentType) ? buf.toString('utf8') : `[binary body · ${buf.length} bytes]`,
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err)
    return { ok: false, status: 0, duration: Math.round(performance.now() - started), error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** Reconstruct the absolute URL a captured request was sent to. */
export function buildTarget(record: RequestRecord): string {
  const host = record.requestHeaders['host'] ?? 'localhost:9000'
  const scheme = record.requestHeaders['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  return `${scheme}://${host}${record.endpoint}`
}
