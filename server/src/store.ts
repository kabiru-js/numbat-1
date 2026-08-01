import { EventEmitter } from 'node:events'
import { genId, toSummary } from './utils'
import type { ErrorGroup, ErrorReport, RequestRecord, RequestSummary } from './types'

interface StoredError extends ErrorGroup {
  resolved: boolean
}

/**
 * In-memory, typed, capped store.
 *
 * Emits:
 *  - `new-request` (RequestRecord) — after a request is stored
 *  - `new-error`   (ErrorGroup)    — after a group is created, updated, or resolved
 */
export class Store extends EventEmitter {
  private readonly requests: RequestRecord[] = []
  private readonly byId = new Map<string, RequestRecord>()
  private readonly errorGroups = new Map<string, StoredError>()
  private readonly cap: number

  constructor(options: { maxRequests?: number } = {}) {
    super()
    this.cap = options.maxRequests ?? 1000
  }

  // ── Requests ────────────────────────────────────────────────────────────────

  addRequest(record: RequestRecord): void {
    this.byId.set(record.id, record)
    this.requests.unshift(record)
    if (this.requests.length > this.cap) {
      const dropped = this.requests.pop()
      if (dropped) this.byId.delete(dropped.id)
    }
    this.emit('new-request', record)
  }

  /** Full records, newest first. */
  getRequests(): RequestRecord[] {
    return this.requests
  }

  /** Lightweight rows, newest first — no bodies or headers. */
  getSummaries(): RequestSummary[] {
    return this.requests.map((r) => toSummary(r))
  }

  getRequest(id: string): RequestRecord | undefined {
    return this.byId.get(id)
  }

  // ── Errors ──────────────────────────────────────────────────────────────────

  /**
   * Insert or increment an error group. Groups are keyed by
   * type|message|file|line so repeated crashes accumulate instead of
   * duplicating rows.
   */
  addError(report: ErrorReport): ErrorGroup {
    const file = report.file ?? 'unknown'
    const line = report.line ?? 0
    const key = [report.type, report.message, file, line].join('\u0000')
    const now = new Date().toISOString()

    let group = this.errorGroups.get(key)
    if (group) {
      group.count += 1
      group.lastSeen = now
      if (report.stack && report.stack.length > 0) group.stack = report.stack
    } else {
      group = {
        id: genId('err'),
        type: report.type,
        message: report.message,
        file,
        line,
        count: 1,
        lastSeen: now,
        stack: report.stack && report.stack.length > 0 ? report.stack : [`${report.type}: ${report.message}`],
        resolved: false,
      }
      this.errorGroups.set(key, group)
    }

    const emitted = toPublicError(group)
    this.emit('new-error', emitted)
    return emitted
  }

  /** Active (non-resolved) groups, newest first. */
  getErrors(): ErrorGroup[] {
    return [...this.errorGroups.values()]
      .filter((e) => !e.resolved)
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
      .map(toPublicError)
  }

  /** Mark a group resolved so it disappears from GET /api/errors. */
  resolveError(id: string): boolean {
    for (const group of this.errorGroups.values()) {
      if (group.id === id && !group.resolved) {
        group.resolved = true
        this.emit('new-error', toPublicError(group))
        return true
      }
    }
    return false
  }

  // ── Session restore ─────────────────────────────────────────────────────────

  /**
   * Replace the entire store with a previously saved session. Restores
   * newest-first ordering and does NOT emit events (no WS spam on load).
   */
  reset(requests: RequestRecord[], errors: ErrorGroup[]): void {
    this.requests.length = 0
    this.byId.clear()
    this.errorGroups.clear()

    for (const r of requests.slice(0, this.cap)) {
      this.byId.set(r.id, r)
      this.requests.push(r)
    }
    for (const e of errors) {
      const key = [e.type, e.message, e.file, e.line].join('\u0000')
      this.errorGroups.set(key, { ...e, resolved: false })
    }
  }

  // ── Misc ────────────────────────────────────────────────────────────────────

  health(): { totalRequests: number; totalErrors: number } {
    return {
      totalRequests: this.requests.length,
      totalErrors: [...this.errorGroups.values()].reduce((n, e) => n + e.count, 0),
    }
  }
}

function toPublicError(e: StoredError): ErrorGroup {
  return {
    id: e.id,
    type: e.type,
    message: e.message,
    file: e.file,
    line: e.line,
    count: e.count,
    lastSeen: e.lastSeen,
    stack: e.stack,
  }
}
