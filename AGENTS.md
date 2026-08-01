# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.

## API Client

- `src/api.ts` - Typed fetch wrappers, WebSocket singleton (auto-reconnect), and `timeAgo` formatter. All components import their data fetchers from here.
  - `fetchRequests()` / `fetchRequest(id)` / `fetchErrors()` for REST
  - `replayRequest(id)` / `resolveError(id)` for mutations
  - `onNewRequest(cb)` / `onNewError(cb)` / `onConnectionChange(cb)` for real-time updates
  - The API base defaults to `http://localhost:9000`; override with `VITE_NUMBAT_URL`

## Backend (`server/`)

The Numbat server captures HTTP traffic, stores it in memory, serves a REST API, and pushes real-time updates over WebSocket.

- `server/src/index.ts` - Entrypoint: Express app, capture middleware, API router, WebSocket, optional demo mode
- `server/src/capture.ts` - Express-compatible capture middleware (mount FIRST; passive request body + write/end wrapping for responses; sensitive-header redaction)
- `server/src/store.ts` - In-memory typed store (capped at 1000 requests, error grouping by type+message+file+line)
- `server/src/api.ts` - REST router: `/health`, `/requests`, `/requests/:id`, `/requests/:id/replay`, `/errors`, `/errors/:id/resolve`
- `server/src/ws.ts` - WebSocket feed: `new_request` (summary), `new_error` (group), auto-ping keepalive
- `server/src/replay.ts` - Replay via `fetch` using the captured `Host` header as target
- `server/src/demo.ts` - Demo upstream API + traffic generator (gated behind `NUMBAT_DEMO=1`)
- `server/src/smoke.ts` - End-to-end test: boots server on ephemeral port, exercises capture/REST/replay/errors/WS
- `server/src/curl.ts` - `generateCurl()` — readable multi-line curl from a captured request (skips redacted headers)
- `server/src/session.ts` - Session persistence to `.numbat/session.json` (auto-save debounced, corrupted files fail silently)
- `server/README.md` - Full API contract, env vars, security notes, and quickstart

Run the server: `cd server && pnpm install && pnpm dev` (or use root scripts: `pnpm server:dev` / `pnpm server:smoke`).
With `NUMBAT_DEMO=1`, the server mounts a demo upstream and auto-generates traffic so the UI shows live captures immediately.

### V2 API surface (additions)

- `GET /api/requests` accepts `method`, `status` (2xx/3xx/4xx/5xx), `search`, `minDuration`, `maxDuration`, `source`
- `GET /api/requests/:id/curl` - cURL export for a captured request
- `POST /api/requests` - ingest a captured record (used by the SDK)
- `POST /api/requests/:id/replay` accepts an optional body `{ method?, headers?, body? }` to override before replay; replayed records carry `replayed: true` and `replayOf`
- `POST /api/session/save` / `POST /api/session/load` - persist/restore the store to `.numbat/session.json`
- Requests carry a `source` label (`NUMBAT_SOURCE` env or middleware option, default `default`)

## CLI (`cli/`)

`numbat` starts the whole stack in one command: backend :9000 + dashboard :8443, then opens the browser.

- `cli/bin/numbat.ts` - entry (shebang), `package.json` bin → `dist/bin/numbat.js`
- `cli/src/index.ts` - commander setup (`start` default, `dev`, `doctor`)
- `cli/src/commands/start.ts` - pre-flight builds + port checks, spawns backend + `vite preview`, opens browser, graceful SIGINT
- `cli/src/commands/dev.ts` - backend under `tsx watch` + `NUMBAT_DEMO=1`, frontend under `vite dev`
- `cli/src/commands/doctor.ts` - Node version, port 9000/8443, dependencies, builds
- `cli/src/utils/processes.ts` - repo-root resolution, binary paths (vite/tsx), spawn + browser open (cross-platform)

Build: `cd cli && pnpm install && pnpm build`. All child processes spawn through `process.execPath` (no shell), so it is Windows/Mac/Linux safe.

## SDK (`sdk/`)

One-line integration for Express apps: `app.use(numbat())`.

- `sdk/src/index.ts` - public exports: `numbat`, `attachNumbat`, types
- `sdk/src/express.ts` - wraps the server's capture middleware; forwards records + errors to a Numbat server (default `http://localhost:9000`) fire-and-forget; `source`/`redactHeaders`/`maxBodySize`/`serverUrl` options
- `sdk/src/smoke.ts` - end-to-end test (user app → SDK → Numbat server)
- `sdk/examples/express.ts` - minimal usage example

Build order matters: the SDK imports the server's compiled output (`server/dist`), so build the server first (`cd server && pnpm build`).
