import path from 'node:path'
import { logger } from '../utils/logger'
import { checkPorts } from '../utils/ports'
import {
  BACKEND_PORT,
  DASHBOARD_URL,
  FRONTEND_PORT,
  repoRoot,
  resolveBinaries,
  runSync,
  startChild,
  openBrowser,
} from '../utils/processes'

export interface StartOptions {
  demo?: boolean
}

/**
 * `numbat start` — run the compiled backend + the built dashboard, then open
 * the browser. Ensures both builds exist first (best-effort).
 */
export async function start(options: StartOptions): Promise<void> {
  const root = repoRoot()
  const { serverDist, viteBin, tsxBin } = resolveBinaries(root)
  logger.raw('')
  logger.info(`Starting NUMBAT (repo: ${root})`)

  // ── Port checks ─────────────────────────────────────────────────────────
  const ports = await checkPorts([BACKEND_PORT, FRONTEND_PORT])
  if (!ports[BACKEND_PORT]) {
    logger.error(`Port ${BACKEND_PORT} is already in use — is another Numbat running?`)
    process.exit(1)
  }
  if (!ports[FRONTEND_PORT]) {
    logger.error(`Port ${FRONTEND_PORT} is already in use — is another dev server running?`)
    process.exit(1)
  }

  // ── Pre-flight builds ────────────────────────────────────────────────────
  const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  if (!require('node:fs').existsSync(serverDist)) {
    logger.info('server/dist not found — building backend…')
    if (!runSync(root, process.execPath, [tscBin, '-p', path.join(root, 'server', 'tsconfig.json')])) {
      logger.error('Backend build failed. Run `pnpm -C server build` to see errors.')
      process.exit(1)
    }
  }
  const frontendDist = path.join(root, 'dist', 'index.html')
  if (!viteBin) {
    logger.error('Vite is not installed. Run `pnpm install` at the project root first.')
    process.exit(1)
  }
  if (!require('node:fs').existsSync(frontendDist)) {
    logger.info('Frontend not built — running vite build…')
    if (!runSync(root, process.execPath, [viteBin, 'build'])) {
      logger.error('Frontend build failed. Run `pnpm build` at the project root to see errors.')
      process.exit(1)
    }
  }

  // ── Spawn backend + dashboard ────────────────────────────────────────────
  const backendEnv: NodeJS.ProcessEnv = options.demo ? { NUMBAT_DEMO: '1' } : {}
  const backend = startChild({
    label: 'backend',
    color: 'blue',
    command: process.execPath,
    args: [serverDist],
    cwd: root,
    env: backendEnv,
  })
  const frontend = startChild({
    label: 'dashboard',
    color: 'green',
    command: process.execPath,
    args: [viteBin!, 'preview', '--host', '0.0.0.0', '--port', String(FRONTEND_PORT)],
    cwd: root,
  })

  logger.success(`Backend    → http://localhost:${BACKEND_PORT}/api`)
  logger.success(`Dashboard  → ${DASHBOARD_URL}`)
  if (options.demo) logger.info('Demo traffic enabled — the dashboard fills in real time.')
  logger.raw('')

  openBrowser(DASHBOARD_URL)

  const children = [backend, frontend]
  const shutdown = () => {
    logger.raw('')
    logger.info('Shutting down…')
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGINT')
    }
    setTimeout(() => process.exit(0), 300).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
