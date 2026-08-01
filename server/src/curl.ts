import { buildTarget } from './replay'
import type { RequestRecord } from './types'

/**
 * Generate a readable, multi-line `curl` command that reproduces a captured
 * request. Redacted headers are skipped entirely (values are `[REDACTED]`),
 * and bodies are passed via `--data-raw` so JSON with `@`/`{}` stays intact.
 */
export function generateCurl(request: RequestRecord): string {
  const lines = [`curl --request ${request.method}`, `  --url ${quote(buildTarget(request))}`]

  for (const [name, value] of Object.entries(request.requestHeaders)) {
    if (value === '[REDACTED]') continue
    lines.push(`  --header ${quote(`${name}: ${value}`)}`)
  }

  if (request.requestBody) {
    lines.push(`  --data-raw ${quote(request.requestBody)}`)
  }

  return lines.join(' \\\n')
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, `'\\''`)}'`
}
