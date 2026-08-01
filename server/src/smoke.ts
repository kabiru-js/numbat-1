/**
 * End-to-end smoke test: boots a Numbat server on an ephemeral port and
 * exercises capture, REST, replay (incl. editable), cURL export, filtering,
 * ingest, source labels, error grouping/resolution, sessions, and the
 * WebSocket feed. Run with `pnpm smoke` (after `pnpm build`).
 */
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { WebSocket } from 'ws'
import { Store } from './store'
import { createCaptureMiddleware } from './capture'
import { createApiRouter } from './api'
import { attachWebSocket } from './ws'
import type { RequestSummary } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface RequestDetail {
  id: string
  method: string
  endpoint: string
  status: number
  duration: number
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseBody: string
  replayed: boolean
  replayOf?: string
  source?: string
}

interface ErrorGroupPayload {
  id: string
  type: string
  message: string
  file: string
  line: number
  count: number
  lastSeen: string
}

async function main() {
  // Isolate session writes from the repo.
  process.env.NUMBAT_SESSION_PATH = path.join(os.tmpdir(), `numbat-smoke-${process.pid}.json`)

  const store = new Store()
  const app = express()
  app.use(createCaptureMiddleware(store))
  app.use('/api', createApiRouter(store))
  app.get('/hello', (_req, res) => res.json({ hello: 'world' }))
  app.post('/echo', (_req, res) => res.json({ echo: true }))
  app.get('/missing', (_req, res) => res.status(404).json({ error: 'nope' }))

  const server = http.createServer(app)
  attachWebSocket(server, store)
  await new Promise<void>((r) => server.listen(0, r))
  const port = (server.address() as AddressInfo).port
  const base = `http://localhost:${port}`

  const wsEvents: string[] = []
  const ws = new WebSocket(`ws://localhost:${port}/ws`)
  ws.on('message', (data) => wsEvents.push(String(data)))
  await sleep(100)

  let pass = 0
  const check = (name: string, cond: boolean) => {
    if (!cond) throw new Error(`FAIL: ${name}`)
    pass += 1
    console.log(`ok - ${name}`)
  }

  const getJSON = <T>(path: string): Promise<T> => fetch(`${base}${path}`).then((r) => r.json() as Promise<T>)
  const postJSON = <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then((r) => r.json() as Promise<T>)

  // ── Capture (POST with body + JSON response) ─────────────────────────────
  await fetch(`${base}/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret-token' },
    body: JSON.stringify({ ping: true }),
  })
  await sleep(100)

  const list = await getJSON<{ requests: RequestSummary[] }>('/api/requests')
  check('request captured', list.requests.length === 1)
  check('endpoint + method captured', list.requests[0].endpoint === '/echo' && list.requests[0].method === 'POST')
  check('list payload is a summary', !('requestBody' in list.requests[0]) && !('responseBody' in list.requests[0]))
  check('source defaults to "default"', list.requests[0].source === 'default')

  const id = list.requests[0].id
  const detail = await getJSON<{ request: RequestDetail }>(`/api/requests/${id}`)
  check('detail has request body', detail.request.requestBody?.includes('ping') === true)
  check('detail has response body', detail.request.responseBody.includes('echo'))
  check('sensitive header redacted', detail.request.requestHeaders['authorization'] === '[REDACTED]')
  check('status captured', detail.request.status === 200)

  // ── Capture (GET + 404 route for filter tests) ───────────────────────────
  await fetch(`${base}/hello`)
  await fetch(`${base}/missing`)
  await sleep(50)

  // ── cURL export ──────────────────────────────────────────────────────────
  const curlRes = await getJSON<{ ok: boolean; curl: string }>(`/api/requests/${id}/curl`)
  check('curl export ok', curlRes.ok === true)
  check('curl has method + url', curlRes.curl.includes('curl --request POST') && curlRes.curl.includes('--url'))
  check('curl skips redacted headers', !curlRes.curl.includes('REDACTED') && !curlRes.curl.includes('secret-token'))
  check('curl includes body', curlRes.curl.includes('--data-raw') && curlRes.curl.includes('ping'))

  // ── Replay (basic) ───────────────────────────────────────────────────────
  const replay = await postJSON<{ ok: boolean }>(`/api/requests/${id}/replay`)
  check('replay ok', replay.ok === true)
  await sleep(100)
  const listR = await getJSON<{ requests: RequestSummary[] }>('/api/requests')
  const replayRecord = (await getJSON<{ request: RequestDetail }>(`/api/requests/${listR.requests[0].id}`)).request
  check('replay recorded + flagged', replayRecord.replayed === true && replayRecord.replayOf === id)
  check('replay captured response', replayRecord.responseBody.includes('echo'))

  // ── Editable replay (override) ───────────────────────────────────────────
  const override = { method: 'POST', headers: { 'x-override': 'yes' }, body: '{"edited":true}' }
  const edited = await postJSON<{ ok: boolean; requestId: string }>(`/api/requests/${id}/replay`, override)
  check('editable replay ok', edited.ok === true)
  await sleep(50)
  const editedRecord = (await getJSON<{ request: RequestDetail }>(`/api/requests/${edited.requestId}`)).request
  check('override method applied', editedRecord.method === 'POST')
  check('override header applied', editedRecord.requestHeaders['x-override'] === 'yes')
  check('override body applied', editedRecord.requestBody === '{"edited":true}')
  check('editable replay links original', editedRecord.replayOf === id)

  // ── Ingest + source filter ───────────────────────────────────────────────
  const ingested = await postJSON<{ ok: boolean; id: string }>('/api/requests', {
    method: 'GET',
    endpoint: '/internal/healthcheck',
    status: 200,
    duration: 3,
    source: 'backend',
    requestHeaders: { 'x-internal': 'true' },
    responseBody: '{"ok":true}',
  })
  check('ingest ok', ingested.ok === true)
  const sourceBackend = await getJSON<{ requests: RequestSummary[] }>('/api/requests?source=backend')
  check('source filter finds backend', sourceBackend.requests.length === 1 && sourceBackend.requests[0].endpoint === '/internal/healthcheck')
  const sourceDefault = await getJSON<{ requests: RequestSummary[] }>('/api/requests?source=default')
  check('source filter separates default', sourceDefault.requests.length >= 4)

  // ── Advanced filtering ───────────────────────────────────────────────────
  const byMethod = await getJSON<{ requests: RequestSummary[] }>('/api/requests?method=GET')
  check('filter by method', byMethod.requests.length >= 3 && byMethod.requests.every((r) => r.method === 'GET'))
  const byStatus = await getJSON<{ requests: RequestSummary[] }>('/api/requests?status=4xx')
  check('filter by status class', byStatus.requests.length === 1 && byStatus.requests[0].endpoint === '/missing')
  const bySearch = await getJSON<{ requests: RequestSummary[] }>('/api/requests?search=hello')
  check('filter by search', bySearch.requests.length === 1 && bySearch.requests[0].endpoint === '/hello')
  const byDuration = await getJSON<{ requests: RequestSummary[] }>('/api/requests?minDuration=99999999')
  check('filter by duration bounds', byDuration.requests.length === 0)
  const combined = await getJSON<{ requests: RequestSummary[] }>('/api/requests?method=POST&search=echo&status=2xx')
  check('combined filters', combined.requests.length >= 2 && combined.requests.every((r) => r.method === 'POST' && r.endpoint.includes('echo')))

  // ── Errors: report, group, resolve ───────────────────────────────────────
  const report = {
    type: 'TypeError',
    message: 'boom',
    file: 'src/app.ts',
    line: 4,
    stack: ['TypeError: boom', '  at f (src/app.ts:4:1)'],
  }
  const rep1 = await postJSON<{ ok: boolean; id: string; count: number }>('/api/errors', report)
  check('error reported', rep1.ok === true)
  const rep2 = await postJSON<{ ok: boolean; id: string; count: number }>('/api/errors', {
    type: 'TypeError',
    message: 'boom',
    file: 'src/app.ts',
    line: 4,
  })
  check('duplicate grouped', rep2.id === rep1.id && rep2.count === 2)

  const errors = await getJSON<{ errors: ErrorGroupPayload[] }>('/api/errors')
  check('error list has one group with count 2', errors.errors.length === 1 && errors.errors[0].count === 2)

  const resolve = await postJSON<{ ok: boolean }>(`/api/errors/${rep1.id}/resolve`)
  check('resolve ok', resolve.ok === true)
  const errorsAfter = await getJSON<{ errors: ErrorGroupPayload[] }>('/api/errors')
  check('resolved group hidden', errorsAfter.errors.length === 0)

  // ── Sessions ─────────────────────────────────────────────────────────────
  const saved = await postJSON<{ ok: boolean; requests: number }>('/api/session/save')
  check('session saved', saved.ok === true && saved.requests >= 5)
  const loaded = await postJSON<{ ok: boolean; requests: number }>('/api/session/load')
  check('session loaded', loaded.ok === true && loaded.requests === saved.requests)
  const afterLoad = await getJSON<{ requests: RequestSummary[] }>('/api/requests')
  check('store restored from session', afterLoad.requests.length === loaded.requests)

  // ── Not found / health ───────────────────────────────────────────────────
  const missing = await fetch(`${base}/api/requests/nope`)
  check('404 for missing request', missing.status === 404)
  const health = await getJSON<{ ok: boolean; totalRequests: number }>('/api/health')
  check('health ok', health.ok === true && health.totalRequests >= 5)

  // ── WebSocket feed ───────────────────────────────────────────────────────
  await sleep(150)
  const joined = wsEvents.join(' ')
  check('ws hello received', joined.includes('"type":"hello"'))
  check('ws new_request events', (joined.match(/"type":"new_request"/g) ?? []).length >= 5)
  check('ws new_error events', joined.includes('"type":"new_error"'))

  ws.close()
  server.close()
  console.log(`\nAll ${pass} smoke checks passed.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
