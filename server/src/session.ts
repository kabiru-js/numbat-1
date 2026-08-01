import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Store } from './store'
import type { ErrorGroup, RequestRecord } from './types'

export interface SessionFile {
  version: 1
  savedAt: string
  requests: RequestRecord[]
  errors: ErrorGroup[]
}

/**
 * Default session location. Override with NUMBAT_SESSION_PATH.
 * Resolved against the process working directory (local-first, no config).
 */
export function defaultSessionPath(): string {
  return process.env.NUMBAT_SESSION_PATH ?? path.join(process.cwd(), '.numbat', 'session.json')
}

/** Serialize the store to `.numbat/session.json` (atomic-ish write). */
export async function saveSession(store: Store, filePath: string = defaultSessionPath()): Promise<SessionFile> {
  const data: SessionFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    requests: store.getRequests(),
    errors: store.getErrors(),
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  return data
}

/**
 * Restore the store from `.numbat/session.json`.
 * Returns `{ requests, errors }` counts on success, or `null` when the file
 * is missing or corrupted (fails silently — never throws).
 */
export async function loadSession(store: Store, filePath: string = defaultSessionPath()): Promise<{ requests: number; errors: number } | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SessionFile>
    const requests = Array.isArray(parsed.requests) ? parsed.requests.filter(isRequestRecord) : []
    const errors = Array.isArray(parsed.errors) ? parsed.errors.filter(isErrorGroup) : []
    store.reset(requests, errors)
    return { requests: requests.length, errors: errors.length }
  } catch {
    return null
  }
}

function isRequestRecord(x: unknown): x is RequestRecord {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.method === 'string' &&
    typeof r.endpoint === 'string' &&
    typeof r.timestamp === 'string'
  )
}

function isErrorGroup(x: unknown): x is ErrorGroup {
  if (!x || typeof x !== 'object') return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    typeof e.message === 'string' &&
    typeof e.count === 'number' &&
    Array.isArray(e.stack)
  )
}
