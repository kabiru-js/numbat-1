import fs from 'node:fs'
import path from 'node:path'
import { logger } from '../utils/logger'
import { isPortAvailable } from '../utils/ports'
import { BACKEND_PORT, FRONTEND_PORT, repoRoot, resolveBinaries } from '../utils/processes'

/**
 * `numbat doctor` — environment diagnostics: Node version, port availability,
 * and installed dependencies/builds.
 */
export async function doctor(): Promise<void> {
  const root = repoRoot()
  logger.raw('')
  logger.raw('NUMBAT doctor')
  logger.raw('────────────')

  // ── Node version ─────────────────────────────────────────────────────────
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor >= 18) {
    logger.success(`Node ${process.versions.node} (>= 18 required)`)
  } else {
    logger.error(`Node ${process.versions.node} — version 18 or newer is required.`)
  }

  // ── Ports ────────────────────────────────────────────────────────────────
  const [backendFree, frontendFree] = await Promise.all([isPortAvailable(BACKEND_PORT), isPortAvailable(FRONTEND_PORT)])
  if (backendFree) logger.success(`Port ${BACKEND_PORT} (backend) is available`)
  else logger.warn(`Port ${BACKEND_PORT} (backend) is already in use`)
  if (frontendFree) logger.success(`Port ${FRONTEND_PORT} (dashboard) is available`)
  else logger.warn(`Port ${FRONTEND_PORT} (dashboard) is already in use`)

  // ── Dependencies ─────────────────────────────────────────────────────────
  const hasDir = (p: string) => fs.existsSync(p)
  const rootModules = path.join(root, 'node_modules')
  const serverModules = path.join(root, 'server', 'node_modules')
  const { serverDist, viteBin } = resolveBinaries(root)

  if (hasDir(rootModules)) logger.success('Frontend dependencies installed (node_modules)')
  else logger.error('Frontend dependencies missing — run `pnpm install` at the project root')
  if (hasDir(serverModules)) logger.success('Backend dependencies installed (server/node_modules)')
  else logger.error('Backend dependencies missing — run `pnpm -C server install`')
  if (viteBin) logger.success('Vite found')
  else logger.warn('Vite binary not found')
  if (hasDir(serverDist)) logger.success('Backend build present (server/dist)')
  else logger.warn('Backend build missing — `numbat start` will build it automatically')
  if (hasDir(path.join(root, 'dist', 'index.html'))) logger.success('Dashboard build present (dist)')
  else logger.warn('Dashboard build missing — `numbat start` will build it automatically')

  logger.raw('')
  logger.raw('Run `numbat` to start everything, or `numbat dev` for hot reload + demo traffic.')
}
