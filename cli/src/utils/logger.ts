/**
 * Small colored logger. Colors are only emitted on TTY terminals so piped
 * output stays clean.
 */
const COLORS = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
} as const

type Color = keyof typeof COLORS

const isTty = process.stdout.isTTY === true

function paint(text: string, color: Color): string {
  return isTty ? `${COLORS[color]}${text}${COLORS.reset}` : text
}

/** Prefix every line of a child's output with a colored label. */
export function pipeOutput(label: string, color: Color, data: string): void {
  for (const line of data.split('\n')) {
    if (line === '') continue
    process.stdout.write(`${paint(`[${label}]`, color)} ${line}\n`)
  }
}

export const logger = {
  info: (msg: string) => process.stdout.write(`${paint('numbat', 'dim')} ${msg}\n`),
  success: (msg: string) => process.stdout.write(`${paint('✓', 'green')} ${msg}\n`),
  warn: (msg: string) => process.stdout.write(`${paint('⚠', 'yellow')} ${msg}\n`),
  error: (msg: string) => process.stdout.write(`${paint('✗', 'red')} ${msg}\n`),
  raw: (msg: string) => process.stdout.write(`${msg}\n`),
}
