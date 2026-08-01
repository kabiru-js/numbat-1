# Numbat

See every request your app makes. Instantly.

---

## What is this?

Numbat is a local-first debugging tool that makes your application's network behavior visible in real time.

Run it once, and every HTTP request — across your system — becomes observable.

No proxy configuration.  
No accounts.  
No external services.  

Just your system, made legible.

---

## Why does this exist?

Modern software systems are increasingly difficult to reason about.

A single user action can trigger:
- multiple API calls
- retries and race conditions
- background jobs
- cascading failures

When something breaks, the problem is rarely *fixing* it.

The problem is understanding what actually happened.

Existing tools fragment this understanding:
- browser devtools show only part of the system
- logs are delayed and incomplete
- API clients are disconnected from reality

Numbat restores a simple property:

> You can see what your system is doing, as it does it.

---

## What can it do?

### Real-time request capture
- Captures all HTTP requests and responses
- Includes headers, bodies, status, and timing
- Streams updates live via WebSocket

### Interactive inspection
- Browse requests in a live dashboard
- Inspect full request/response details
- Search and filter across traffic

### Replay with modification
- Replay any request instantly
- Override method, headers, or body
- Compare behavior across variations

### cURL export
- Convert any request into a clean, runnable curl command

### Error tracking
- Report client/server errors
- Automatically group similar failures
- Track frequency and resolution

### Session persistence
- Save and reload sessions locally
- Continue debugging across restarts

### Multi-service awareness
- Label traffic by source (e.g. frontend, backend, auth)
- Filter and isolate specific services

---

## Getting started

```bash
npx numbat

This will:

start the Numbat server
start the dashboard
open your browser

Then:

Run your app
Trigger any request
Watch it appear instantly
Integrating with your app

For Express:

import { numbat } from "numbat"

app.use(numbat())

Optional configuration:

app.use(numbat({
  source: "backend",
  redactHeaders: ["authorization"],
  maxBodySize: 200_000
}))
Example workflow
A request fails in your app
Open Numbat
Find the request
Inspect headers and body
Replay it with modifications
Identify the issue

No context switching. No guesswork.

Mental model

Numbat is similar to a network tab, but:

it is not tied to a browser
it is not limited to one service
it does not disappear when you refresh

It sits alongside your system and observes it continuously.

Architecture
Server: Node.js (Express + WebSocket)
Store: in-memory with optional persistence
Frontend: React + Vite dashboard
SDK: Express middleware for integration
CLI: zero-config startup via npx numbat

All components run locally.

Design principles
Local-first
Zero configuration
Non-blocking capture
Transparent defaults
Fast enough to always be on
API overview
Requests
GET /api/requests — list (with filters)
GET /api/requests/:id — full detail
POST /api/requests/:id/replay — replay (editable)
GET /api/requests/:id/curl — export as curl
Errors
GET /api/errors
POST /api/errors
POST /api/errors/:id/resolve
Session
POST /api/session/save
POST /api/session/load
Configuration

Environment variables:

PORT — server port (default 9000)
NUMBAT_MAX_REQUESTS — request cap
NUMBAT_MAX_BODY_BYTES — body size limit
NUMBAT_DEMO — enable demo mode
NUMBAT_LOG_SENSITIVE_HEADERS — disable redaction
NUMBAT_SOURCE — default request source
What it is not

Numbat is intentionally narrow in scope.

It is not a cloud platform
It is not an API testing suite
It is not a logging system

It is a visibility layer for local development.

Status

Early, but stable.

All core systems are validated end-to-end.

Philosophy

As systems grow more complex, the limiting factor becomes understanding.

The most useful tools are those that make behavior visible, immediate, and concrete.

Numbat is built around that idea.

License

MIT
