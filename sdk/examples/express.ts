/**
 * Minimal usage example — `app.use(numbat())` is all it takes.
 *
 * Start the Numbat server first (`cd server && NUMBAT_DEMO=1 pnpm dev` or
 * `numbat`), then run this app and watch its traffic appear in the dashboard.
 */
import express from 'express'
import { numbat } from '@numbat/sdk'

const app = express()

// 1-line integration — capture everything and stream it to Numbat.
app.use(numbat())

// Advanced: label traffic by source, extend redaction, raise the body cap.
// app.use(numbat({
//   source: 'payments-service',
//   redactHeaders: ['x-internal-token', 'stripe-signature'],
//   maxBodySize: 200_000,
// }))

app.use(express.json())

app.get('/api/users/me', (_req, res) => {
  res.json({ id: 'usr_1', name: 'Sam Chen', role: 'admin' })
})

app.post('/api/auth/refresh', (req, res) => {
  res.json({ access_token: 'eyJhbGciOi...', expires_in: 3600 })
})

app.get('/api/billing/subscription', (_req, res) => {
  res.status(500).json({ error: 'internal_server_error' })
})

const PORT = Number(process.env.PORT ?? 4000)
app.listen(PORT, () => {
  console.log(`Example app on http://localhost:${PORT} — traffic streams to Numbat`)
})
