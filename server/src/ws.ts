import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { toSummary } from './utils'
import type { Store } from './store'
import type { ErrorGroup, RequestRecord, WsEvent } from './types'

/**
 * Broadcasts store changes to connected UIs.
 *  - `new_request` carries the lightweight summary (the UI fetches full
 *    details on demand), keeping pushes fast even for large bodies.
 *  - `new_error` carries the (possibly updated) group so clients can merge
 *    counts instead of re-fetching.
 */
export function attachWebSocket(server: Server, store: Store): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  const onNewRequest = (record: RequestRecord) => broadcast(wss, { type: 'new_request', request: toSummary(record) })
  const onNewError = (group: ErrorGroup) => broadcast(wss, { type: 'new_error', error: group })
  store.on('new-request', onNewRequest)
  store.on('new-error', onNewError)

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', uptime: process.uptime() } satisfies WsEvent))
  })

  // Keep proxies from dropping idle connections.
  const ping = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.ping()
    }
  }, 30_000)
  wss.on('close', () => {
    clearInterval(ping)
    store.off('new-request', onNewRequest)
    store.off('new-error', onNewError)
  })

  return wss
}

function broadcast(wss: WebSocketServer, event: WsEvent): void {
  const payload = JSON.stringify(event)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload)
  }
}
