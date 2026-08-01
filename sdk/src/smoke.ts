/**
 * SDK end-to-end smoke test:
 *  1. Boots a "Numbat server" (real API router) on an ephemeral port.
 *  2. Boots a user app with `app.use(numbat({ source, serverUrl }))`.
 *  3. Hits the app and verifies the captured request arrived at Numbat with
 *     the source label applied.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Store } from '../../server/dist/store'
import { createApiRouter } from '../../server/dist/api'
import { numbat } from './index'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1) The "Numbat server" — real REST API, ephemeral port.
  const numbatStore = new Store()
  const numbatApp = express()
  numbatApp.use('/api', createApiRouter(numbatStore))
  const numbatServer = http.createServer(numbatApp)
  await new Promise<void>((r) => numbatServer.listen(0, r))
  const numbatPort = (numbatServer.address() as AddressInfo).port

  // 2) The user's app with the SDK attached.
  const app = express()
  app.use(numbat({ serverUrl: `http://localhost:${numbatPort}`, source: 'sdk-test' }))
  app.get('/ping', (_req, res) => res.json({ pong: true }))
  const appServer = http.createServer(app)
  await new Promise<void>((r) => appServer.listen(0, r))
  const appPort = (appServer.address() as AddressInfo).port

  // 3) Exercise the app through the SDK middleware.
  const res = await fetch(`http://localhost:${appPort}/ping`)
  if (res.status !== 200) throw new Error('FAIL: app route responded')
  console.log('ok - app responded through SDK middleware')

  await sleep(300) // allow fire-and-forget forwarding

  interface Summary {
    id: string
    method: string
    endpoint: string
    source?: string
  }

  const getJSON = <T>(path: string): Promise<T> =>
    fetch(`http://localhost:${numbatPort}${path}`).then((r) => r.json() as Promise<T>)

  // 4) The captured request must be on the Numbat server with the source label.
  const list = await getJSON<{ requests: Summary[] }>('/api/requests')
  if (list.requests.length !== 1) throw new Error(`FAIL: expected 1 forwarded request, got ${list.requests.length}`)
  console.log('ok - request forwarded to Numbat server')

  const r = list.requests[0]
  if (r.endpoint !== '/ping' || r.method !== 'GET') throw new Error('FAIL: endpoint/method mismatch')
  if (r.source !== 'sdk-test') throw new Error(`FAIL: source label missing (got ${r.source})`)
  console.log('ok - source label preserved')

  const bySource = await getJSON<{ requests: Summary[] }>('/api/requests?source=sdk-test')
  if (bySource.requests.length !== 1) throw new Error('FAIL: source filter did not match')
  console.log('ok - source filter matches')

  const detail = await getJSON<{ request: { responseBody: string } }>(`/api/requests/${r.id}`)
  if (!detail.request.responseBody.includes('pong')) throw new Error('FAIL: response body not forwarded')
  console.log('ok - response body forwarded')

  appServer.close()
  numbatServer.close()
  console.log('\nAll SDK smoke checks passed.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
