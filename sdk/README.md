# @numbat/sdk

One-line Numbat integration for Express apps:

```ts
import express from 'express'
import { numbat } from '@numbat/sdk'

const app = express()
app.use(numbat())
```

Every request/response flowing through your app is captured and streamed to
the local Numbat server (`http://localhost:9000`) in real time. Open the
dashboard and you see your app's traffic — no proxy config, no env vars.

## Options

```ts
app.use(numbat({
  source: 'payments-service',     // label traffic from this app
  redactHeaders: ['x-internal-token'],
  maxBodySize: 200_000,           // per-side body capture limit (bytes)
  serverUrl: 'http://localhost:9000',
}))
```

| Option         | Default                  | Purpose                                   |
| -------------- | ------------------------ | ----------------------------------------- |
| `source`       | `default`                | Origin label shown + filterable in the UI |
| `redactHeaders`| —                        | Extra headers to redact                    |
| `maxBodySize`  | `100_000`                | Body capture cap per side                  |
| `serverUrl`    | `http://localhost:9000`  | Where records are forwarded                |

## Attach style

```ts
import { attachNumbat } from '@numbat/sdk'
attachNumbat(app, { source: 'backend' })
```

## How it works

1. Wraps Numbat's capture middleware (request/response bodies, headers with
   redaction, status, duration).
2. Captures into a local store, then **forwards** every record to the Numbat
   server over HTTP — fire-and-forget, never blocking your request lifecycle.
3. Errors are forwarded to `POST /api/errors` (grouped by type/message/file/line).

Note: the SDK captures your app's own `/api/*` traffic too. Numbat's built-in
middleware only skips its *own* API routes.

## Development

```bash
# Build the server first (the SDK imports its compiled output)
cd server && pnpm install && pnpm build
cd ../sdk && pnpm install && pnpm build

# End-to-end SDK test
node dist/smoke.js

# Run the example app (dashboard must be running)
cd examples && node ../dist/../examples/express.js
```
