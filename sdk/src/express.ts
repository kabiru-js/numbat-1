import { createCaptureMiddleware } from '../../server/dist/capture'
import { Store } from '../../server/dist/store'
import type { ErrorGroup, RequestRecord } from '../../server/dist/types'
import type { NumbatMiddleware, NumbatOptions } from './types'

const DEFAULT_SERVER_URL = process.env.NUMBAT_URL ?? 'http://localhost:9000'

/**
 * One-line Numbat integration:
 *
 *   import { numbat } from '@numbat/sdk'
 *   app.use(numbat())
 *
 * Captures every request/response flowing through the app and forwards it to
 * the local Numbat server (localhost:9000) so the dashboard fills in real
 * time. The SDK captures the app's own `/api/*` traffic — unlike Numbat's
 * built-in middleware, which skips Numbat's own API routes.
 */
export function numbat(options: NumbatOptions = {}): NumbatMiddleware {
  const store = new Store()
  const middleware = createCaptureMiddleware(store, {
    // Capture the app's own /api/* traffic too (unlike Numbat's internal
    // middleware, which skips its own API routes).
    skipPrefixes: [],
    maxBodyBytes: options.maxBodySize,
    sensitiveHeaders: options.redactHeaders,
    source: options.source,
  })

  const serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL

  // Fire-and-forget forwarding: capture happens locally, the Numbat server is
  // the single source of truth for the dashboard. Never blocks the app.
  store.on('new-request', (record: RequestRecord) => {
    void forwardRequest(serverUrl, record).catch(() => {})
  })
  store.on('new-error', (group: ErrorGroup) => {
    void forwardError(serverUrl, group).catch(() => {})
  })

  return middleware
}

/** Convenience wrapper for apps that prefer an attach-style call. */
export function attachNumbat(
  app: { use: (...args: unknown[]) => unknown },
  options?: NumbatOptions,
): void {
  app.use(numbat(options))
}

async function forwardRequest(serverUrl: string, record: RequestRecord): Promise<void> {
  await fetch(`${serverUrl}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
}

async function forwardError(serverUrl: string, group: ErrorGroup): Promise<void> {
  await fetch(`${serverUrl}/api/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: group.type,
      message: group.message,
      file: group.file,
      line: group.line,
      stack: group.stack,
    }),
  })
}
