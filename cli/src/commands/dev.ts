import path from 'node:path'
import { logger } from '../utils/logger'
import { checkPorts } from '../utils/ports'
import {
  BACKEND_PORT,
  DASHBOARD_URL,
  FRONTEND_PORT,
  repoRoot,
  resolveBinaries,
  startChild,
  openBrowser,
} from '../utils/processes'

/**
 * `numbat dev` — backend in tsx watch mode with demo traffic + the Vite dev
 * server. Best for hacking on Numbat itself.
 */
export async function dev(): Promise<void> {
  const root = repoRoot()
  const { viteBin, tsxBin } = resolveBinaries(root)
  logger.raw('')
  logger.info('Starting NUMBAT in development mode (hot reload + demo traffic)')

  const ports = await checkPorts([BACKEND_PORT, FRONTEND_PORT])
  if (!ports[BACKEND_PORT]) {
    logger.error(`Port ${BACKEND_PORT} is already in use — is another Numbat running?`)
    process.exit(1)
  }
  if (!ports[FRONTEND_PORT]) {
    logger.error(`Port ${FRONTEND_PORT} is already in use — is another dev server running?`)
    process.exit(1)
  }

  if (!tsxBin) {
    logger.error('tsx is not installed in server/. Run `pnpm -C server install` first.')
    process.exit(1)
  }
  if (!viteBin) {
    logger.error('Vite is not installed. Run `pnpm install` at the project root first.')
    process.exit(1)
  }

  const backend = startChild({
    label: 'backend',
    color: 'blue',
    command: process.execPath,
    args: [tsxBin, 'watch', 'src/index.ts'],
    cwd: path.join(root, 'server'),
    env: { NUMBAT_DEMO: '1' },
  })
  const frontend = startChild({
    label: 'dashboard',
    color: 'green',
    command: process.execPath,
    args: [viteBin, 'dev', '--host', '0.0.0.0', '--port', String(FRONTEND_PORT)],
    cwd: root,
  })

  logger.success(`Backend (watch) → http://localhost:${BACKEND_PORT}/api`)
  logger.success(`Dashboard (dev)  → ${DASHBOARD_URL}`)
  logger.info('Demo traffic enabled — the dashboard fills in real time.')
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
