import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { logger, pipeOutput } from './logger'

export const BACKEND_PORT = 9000
export const FRONTEND_PORT = 8443
export const DASHBOARD_URL = `http://localhost:${FRONTEND_PORT}`

/** The repository root (parent of `cli/`, `server/`, and the Vite app). */
export function repoRoot(): string {
  // dist/utils/processes.js → repo root
  return path.resolve(__dirname, '..', '..', '..')
}

/** Absolute path to a binary inside a package's node_modules, or null. */
function binPath(root: string, packageName: string, relative: string): string | null {
  const p = path.join(root, 'node_modules', packageName, relative)
  return require('node:fs').existsSync(p) ? p : null
}

export function resolveBinaries(root: string): { serverDist: string; viteBin: string | null; tsxBin: string | null; viteBinCwd: string } {
  const serverDist = path.join(root, 'server', 'dist', 'index.js')
  // Vite lives in the root app's node_modules.
  const viteBin = binPath(root, 'vite', 'bin/vite.js')
  // tsx is a dev dependency of the server package.
  const tsxBin = binPath(path.join(root, 'server'), 'tsx', 'dist/cli.mjs')
  return { serverDist, viteBin, tsxBin, viteBinCwd: path.join(root, 'server') }
}

export interface SpawnSpec {
  label: string
  color: 'blue' | 'green' | 'yellow'
  command: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
}

/** Spawn a child process with prefixed, colored output. */
export function startChild(spec: SpawnSpec): ChildProcess {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', (d: Buffer) => pipeOutput(spec.label, spec.color, String(d)))
  child.stderr?.on('data', (d: Buffer) => pipeOutput(spec.label, spec.color, String(d)))
  child.on('exit', (code) => {
    logger.warn(`${spec.label} exited with code ${code ?? 'unknown'}`)
  })
  return child
}

/** Run a one-off command synchronously (used for pre-flight builds). */
export function runSync(cwd: string, command: string, args: string[]): boolean {
  const res = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env })
  return res.status === 0
}

/** Open the default browser to a URL (cross-platform, fire-and-forget). */
export function openBrowser(url: string): void {
  const platform = process.platform
  const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
  child.on('error', () => { /* browser open is best-effort */ })
  child.unref()
}
