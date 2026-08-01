import http from 'node:http'
import path from 'node:path'
import express from 'express'
import { Store } from './store'
import { createCaptureMiddleware } from './capture'
import { createApiRouter } from './api'
import { attachWebSocket } from './ws'
import { createDemoRouter, startDemoTraffic } from './demo'
import { saveSession, loadSession } from './session'

const PORT = Number(process.env.PORT ?? 9000)
const MAX_REQUESTS = Number(process.env.NUMBAT_MAX_REQUESTS ?? 1000)
const MAX_BODY_BYTES = Number(process.env.NUMBAT_MAX_BODY_BYTES ?? 100_000)
const LOG_SENSITIVE_HEADERS = process.env.NUMBAT_LOG_SENSITIVE_HEADERS === '1'
const EXTRA_SENSITIVE = (process.env.NUMBAT_SENSITIVE_HEADERS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const SOURCE = process.env.NUMBAT_SOURCE ?? 'default'
const SESSION_PATH = process.env.NUMBAT_SESSION_PATH ?? path.join(process.cwd(), '.numbat', 'session.json')

const store = new Store({ maxRequests: MAX_REQUESTS })

const app = express()
app.disable('x-powered-by')

// 1) Capture middleware FIRST — every inbound exchange is recorded, except
//    Numbat's own API, which it skips.
app.use(
  createCaptureMiddleware(store, {
    skipPrefixes: ['/api/'],
    maxBodyBytes: MAX_BODY_BYTES,
    sensitiveHeaders: EXTRA_SENSITIVE,
    logSensitiveHeaders: LOG_SENSITIVE_HEADERS,
    source: SOURCE,
  }),
)

// 2) Numbat's REST API.
app.use('/api', createApiRouter(store))

// 3) Optional demo upstream so the UI has live traffic (NUMBAT_DEMO=1).
if (process.env.NUMBAT_DEMO === '1') {
  app.use('/demo', createDemoRouter())
}

// 4) Session persistence — auto-save (debounced, fire-and-forget) on every
//    store change, and restore the previous session on boot.
let saveTimer: NodeJS.Timeout | null = null
function scheduleSave(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveSession(store, SESSION_PATH).catch(() => { /* local-first: ignore */ })
  }, 1000)
}
store.on('new-request', scheduleSave)
store.on('new-error', scheduleSave)
void loadSession(store, SESSION_PATH).then((restored) => {
  if (restored) console.log(`Restored session: ${restored.requests} requests, ${restored.errors} errors`)
})

const server = http.createServer(app)
attachWebSocket(server, store)

// Surface our own unhandled rejections as error groups — safe to keep running.
process.on('unhandledRejection', (reason) => {
  store.addError(errorToReport(reason))
})

function errorToReport(err: unknown) {
  if (err instanceof Error) {
    const first = err.stack?.split('\n').find((l) => l.includes('at '))
    const match = first?.match(/\(?(.+):(\d+):\d+\)?$/)
    return {
      type: err.name || 'Error',
      message: err.message || String(err),
      file: match?.[1] ?? 'numbat (runtime)',
      line: match ? Number(match[2]) : 0,
      stack: err.stack?.split('\n') ?? [],
    }
  }
  return { type: 'UnhandledRejection', message: String(err), stack: [String(err)] }
}

server.listen(PORT, () => {
  console.log(`┌─ NUMBAT — local-first request inspector`)
  console.log(`│  UI API  http://localhost:${PORT}/api`)
  console.log(`│  WS      ws://localhost:${PORT}/ws`)
  console.log(`│  Capture: mounted on all non-API routes (source: ${SOURCE})`)
  console.log(`│  Session: ${SESSION_PATH}`)
  console.log(`└─ Press Ctrl+C to stop`)
  if (process.env.NUMBAT_DEMO === '1') {
    startDemoTraffic(PORT)
    console.log(`   Demo traffic enabled (NUMBAT_DEMO=1) — watching live captures.`)
  }
})
