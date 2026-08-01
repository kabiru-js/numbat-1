import net from 'node:net'

/** True when nothing is listening on the given port (binds briefly to check). */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true))
    })
  })
}

/** Convenience: check several ports at once, keyed by port number. */
export async function checkPorts(ports: number[]): Promise<Record<number, boolean>> {
  const entries = await Promise.all(ports.map(async (p) => [p, await isPortAvailable(p)] as const))
  return Object.fromEntries(entries)
}
