import { randomBytes } from 'node:crypto'
import type { RequestRecord, RequestSummary } from './types'

/** Generate a short unique id like `req_1a2b3c4d5e6f7890`. */
export function genId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

/** Strip the heavy fields so list views and WebSocket pushes stay light. */
export function toSummary(record: RequestRecord): RequestSummary {
  return {
    id: record.id,
    method: record.method,
    endpoint: record.endpoint,
    status: record.status,
    duration: record.duration,
    timestamp: record.timestamp,
    source: record.source,
  }
}

const TEXTUAL = /json|text|xml|javascript|urlencoded|graphql|svg/i

/** True when a content-type looks like something we can decode as UTF-8 text. */
export function isTextualContentType(contentType: string | undefined): boolean {
  return !contentType || TEXTUAL.test(contentType)
}

/**
 * Join captured chunks into a single string. Binary payloads (images,
 * compressed streams, …) collapse into a placeholder instead of being decoded.
 */
export function decodeBody(chunks: Buffer[], contentType: string | undefined): string | null {
  if (chunks.length === 0) return null
  const buf = Buffer.concat(chunks)
  if (!isTextualContentType(contentType)) return `[binary body · ${buf.length} bytes]`
  return buf.toString('utf8')
}
