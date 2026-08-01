# NUMBAT CLI

One command starts everything:

```bash
numbat            # backend :9000 + dashboard :8443 + opens browser
numbat dev        # hot-reload backend + demo traffic + Vite dev server
numbat doctor     # environment diagnostics
```

## Commands

### `numbat` (default) / `numbat start`

- Checks that ports `9000` and `8443` are free
- Builds the backend (`server/dist`) and dashboard (`dist`) if missing
- Starts the compiled backend and `vite preview`
- Opens `http://localhost:8443`
- `numbat start --demo` fills the dashboard with generated traffic

### `numbat dev`

- Runs the backend under `tsx watch` (restarts on change) with `NUMBAT_DEMO=1`
- Runs the frontend with `vite dev` (hot reload)
- Opens the browser

### `numbat doctor`

Checks and prints:

- Node version (>= 18 required)
- Port 9000 / 8443 availability
- Frontend + backend dependencies installed
- Whether builds are present

## Development

```bash
cd cli
pnpm install
pnpm build            # tsc → dist/
node dist/bin/numbat.js doctor
```

## Publishing to npm

The package is `private: true` in this repo. To publish:

```bash
cd cli
# 1. Set a public name/version, remove "private": true
# 2. Build and publish
pnpm build
npm publish

# Now anywhere:
npx numbat
```

The CLI locates `server/` and the Vite app relative to itself, so when
publishing you should bundle the `server/` build (or install `@numbat/server`
and adjust `resolveBinaries()` in `src/utils/processes.ts`).
