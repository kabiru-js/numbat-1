# NUMBAT — server

Local-first request inspector backend. Captures HTTP traffic via an
Express-compatible middleware, keeps a capped in-memory log, exposes a small
REST API, and pushes real-time updates over WebSocket.

## Quickstart

```sh
cd server
pnpm install
pnpm dev            # tsx watch — restarts on change
pnpm start          # run once
```

Defaults to `http://localhost:9000`. To watch live traffic immediately:

```sh
NUMBAT_DEMO=1 pnpm dev
```

The frontend (`src/App.tsx`) talks to this server at `http://localhost:9000`
by default; override with `VITE_NUMBAT_URL` if you run it elsewhere.

## How capture works

Mount the middleware first, before routes and body parsers:

```ts
import { createCaptureMiddleware } from './capture.js'

app.use(createCaptureMiddleware(store))
```

- Request bodies are collected via a *passive* `data` listener — nothing is
  consumed, so `express.json()` etc. still work.
- Response bodies are captured by wrapping `res.write`/`res.end` (every
  Express send path funnels through them).
- Records are finalized on `finish`/`close` — the request lifecycle is never
  awaited or blocked.
- Paths under `/api/` are skipped so Numbat never records its own traffic.
- Bodies are capped at 100 KB per side (`NUMBAT_MAX_BODY_BYTES`).

## REST API (`/api`)

| Method | Path                        | Description                                   |
| ------ | --------------------------- | --------------------------------------------- |
| GET    | `/health`                   | `{ ok, uptime, totalRequests, totalErrors }`  |
| GET    | `/requests`                 | Summary rows (no bodies/headers), newest first|
| GET    | `/requests/:id`             | Full record (headers + bodies)                |
| GET    | `/requests/:id/curl`        | Readable `curl` command for the request       |
| POST   | `/requests`                 | Ingest a captured record (used by the SDK)    |
| POST   | `/requests/:id/replay`      | Re-runs the request; result is logged + pushed|
| GET    | `/errors`                   | Grouped active errors, newest first           |
| POST   | `/errors`                   | Client error report `{ type, message, file?, line?, stack? }` |
| POST   | `/errors/:id/resolve`       | Mark an error group resolved                  |
| POST   | `/session/save`             | Persist store to `.numbat/session.json`       |
| POST   | `/session/load`             | Restore store from `.numbat/session.json`     |

### Filters (`GET /api/requests`)

| Param         | Example              | Meaning                         |
| ------------- | -------------------- | ------------------------------- |
| `method`      | `method=GET`         | Exact method match              |
| `status`      | `status=4xx`         | Status class (2xx/3xx/4xx/5xx)  |
| `search`      | `search=users`       | Substring match on endpoint     |
| `minDuration` | `minDuration=100`    | duration >= value (ms)          |
| `maxDuration` | `maxDuration=1000`   | duration <= value (ms)          |
| `source`      | `source=backend`     | Source label match              |

### Editable replay

`POST /api/requests/:id/replay` accepts an optional JSON body to override the
captured request before it fires:

```json
{ "method": "GET", "headers": { "x-custom": "1" }, "body": "{}" }
```

Replayed records are marked `replayed: true` with `replayOf` pointing at the
original request. The replayed call is skipped by the capture middleware (via
the internal `x-numbat-replay` marker) so it appears in the log exactly once.

## WebSocket (`/ws`)

| Event         | Payload                                  |
| ------------- | ---------------------------------------- |
| `hello`       | `{ type, uptime }` on connect            |
| `new_request` | `{ type, request: RequestSummary }`      |
| `new_error`   | `{ type, error: ErrorGroup }`            |

## Security

Sensitive headers (`authorization`, `cookie`, `set-cookie`,
`proxy-authorization`, `x-api-key`, `x-auth-token`) are stored with their
values replaced by `[REDACTED]` by default — names are kept so the UI still
shows the header structure. Overrides:

- `NUMBAT_LOG_SENSITIVE_HEADERS=1` — store values verbatim (also makes replay
  able to send real credentials).
- `NUMBAT_SENSITIVE_HEADERS=session-token,my-secret` — add more headers.

## Replay

Replay targets the captured `Host` header (`http(s)://host + endpoint`), so
requests captured from another app on the machine replay against that app.
Note that redacted headers (e.g. `Authorization`) are replayed as-is, so
replays only authenticate if sensitive headers are being logged.

## Env vars

| Var                         | Default    | Meaning                          |
| --------------------------- | ---------- | -------------------------------- |
| `PORT`                      | `9000`     | Listen port                      |
| `NUMBAT_MAX_REQUESTS`       | `1000`     | Store cap (oldest dropped first) |
| `NUMBAT_MAX_BODY_BYTES`     | `100000`   | Per-side body capture limit      |
| `NUMBAT_SENSITIVE_HEADERS`  | —          | Extra headers to redact          |
| `NUMBAT_LOG_SENSITIVE_HEADERS` | off     | Store sensitive values verbatim  |
| `NUMBAT_SOURCE`             | `default`  | Source label stamped on requests |
| `NUMBAT_SESSION_PATH`       | `.numbat/session.json` | Session file location  |
| `NUMBAT_DEMO`               | off        | Mount demo upstream + traffic    |

## Tests

```sh
pnpm smoke    # boots a server, exercises capture/REST/replay/errors/WS
```
