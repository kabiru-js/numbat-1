import { Command } from 'commander'
import { start } from './commands/start'
import { dev } from './commands/dev'
import { doctor } from './commands/doctor'

export function run(): void {
  const program = new Command()

  program
    .name('numbat')
    .description('Local-first HTTP inspector — capture, inspect, and replay API traffic.')
    .version('0.1.0')

  program
    .command('start', { isDefault: true })
    .description('Start Numbat: backend (:9000) + dashboard (:8443), then open the browser')
    .option('--demo', 'Generate demo traffic so the dashboard fills immediately')
    .action((opts: { demo?: boolean }) => {
      void start({ demo: opts.demo === true })
    })

  program
    .command('dev')
    .description('Start Numbat in development mode: hot reload backend + demo traffic')
    .action(() => {
      void dev()
    })

  program
    .command('doctor')
    .description('Check the environment: Node version, ports 9000/8443, and dependencies')
    .action(() => {
      void doctor()
    })

  program.parse(process.argv)
}
