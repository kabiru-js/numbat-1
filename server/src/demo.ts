import { Router } from 'express'

/**
 * A tiny demo "upstream API" used to exercise the tool end-to-end.
 * Only mounted when NUMBAT_DEMO=1. Real apps need none of this — they simply
 * point their traffic at Numbat and get captured.
 */
export function createDemoRouter(): Router {
  const router = Router()

  router.get('/users/me', (_req, res) => {
    res.json({ id: 'usr_b7f2a3', email: 'sam@acme.dev', name: 'Sam Chen', role: 'admin', createdAt: '2024-01-15T10:24:00Z' })
  })

  router.post('/auth/refresh', (_req, res) => {
    res.json({ access_token: 'eyJhbGciOi...', expires_in: 3600 })
  })

  router.get('/projects', (_req, res) => {
    res.json({ data: [{ id: 'proj_x8k2m', name: 'API Gateway', status: 'active' }, { id: 'proj_y3n4p', name: 'Auth Service', status: 'active' }], total: 8, page: 1 })
  })

  router.delete('/projects/:id', (_req, res) => {
    res.status(403).json({ error: 'forbidden', message: 'You do not have permission to delete this project.', code: 'INSUFFICIENT_PERMISSIONS' })
  })

  router.get('/billing/subscription', (_req, res) => {
    res.status(500).json({ error: 'internal_server_error', message: 'An unexpected error occurred while fetching subscription data.' })
  })

  router.post('/webhooks/stripe', (_req, res) => {
    res.status(201).json({ received: true, event_id: 'evt_3P1234' })
  })

  router.get('/analytics/overview', (_req, res) => {
    res.json({ requests: 42810, errors: 127, p50: 84, p95: 412, p99: 1891 })
  })

  router.put('/users/:id/settings', (_req, res) => {
    res.status(422).json({ error: 'validation_error', fields: { 'notifications.slack': 'Must be a valid webhook URL or false' } })
  })

  return router
}

interface Scene {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
}

const SCENES: Scene[] = [
  { method: 'GET', path: '/demo/users/me' },
  { method: 'POST', path: '/demo/auth/refresh', body: { refresh_token: 'rt_9xk2m3p7' } },
  { method: 'GET', path: '/demo/projects?page=1&limit=20' },
  { method: 'DELETE', path: '/demo/projects/proj_x8k2m' },
  { method: 'GET', path: '/demo/billing/subscription' },
  { method: 'POST', path: '/demo/webhooks/stripe', body: { type: 'payment_intent.succeeded', data: { object: { id: 'pi_3P' } } } },
  { method: 'GET', path: '/demo/analytics/overview?range=7d' },
  { method: 'PUT', path: '/demo/users/b7f2a/settings', body: { notifications: { email: true, slack: 'invalid_value' } } },
]

const DEMO_ERRORS = [
  { type: 'ReferenceError', message: 'process is not defined', file: 'src/utils/env.ts', line: 7, stack: ['  ReferenceError: process is not defined', '    at getEnv (src/utils/env.ts:7:10)', '    at initializeApp (src/main.ts:23:18)'] },
  { type: 'TypeError', message: "Cannot read properties of undefined (reading 'data')", file: 'src/api/client.ts', line: 142, stack: ["  TypeError: Cannot read properties of undefined (reading 'data')", '    at ApiClient.handleResponse (src/api/client.ts:142:24)', '    at async fetchProjects (src/api/projects.ts:58:16)'] },
  { type: 'UnhandledPromiseRejection', message: 'connect ECONNREFUSED 127.0.0.1:5432', file: 'src/db/connection.ts', line: 28, stack: ['  Error: connect ECONNREFUSED 127.0.0.1:5432', '    at TCPConnectWrap.afterConnect (node:net:1247:16)', '    at createConnection (src/db/connection.ts:28:9)'] },
]

/**
 * Fires realistic traffic at the demo upstream every ~2s so the UI shows
 * live captures and real-time updates without manual effort. Unref'd so it
 * never keeps the process alive on its own.
 */
export function startDemoTraffic(port: number): void {
  const base = `http://localhost:${port}`
  let tick = 0
  const timer = setInterval(() => {
    tick += 1
    const scene = SCENES[Math.floor(Math.random() * SCENES.length)]
    void (async () => {
      try {
        const init: RequestInit = { method: scene.method }
        if (scene.body) {
          init.headers = { 'Content-Type': 'application/json' }
          init.body = JSON.stringify(scene.body)
        }
        await fetch(`${base}${scene.path}`, init)
      } catch {
        /* server may be restarting — ignore */
      }
      if (tick % 5 === 0) {
        try {
          const err = DEMO_ERRORS[Math.floor(Math.random() * DEMO_ERRORS.length)]
          await fetch(`${base}/api/errors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(err),
          })
        } catch {
          /* ignore */
        }
      }
    })()
  }, 2000)
  timer.unref()
}
