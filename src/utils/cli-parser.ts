/**
 * CLI Argument Parser
 *
 * Simple CLI argument parser for server configuration
 */

export interface CliOptions {
  port?: number
  host?: string
  env?: string
  databasePath?: string
  help?: boolean
  version?: boolean
}

export interface ParsedArgs {
  options: CliOptions
  unknown: string[]
}

export function parseCliArgs(args: string[] = process.argv.slice(2)): ParsedArgs {
  const options: CliOptions = {}
  const unknown: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    switch (arg) {
      case '--port':
      case '-p': {
        const portValue = args[++i]
        if (portValue && !Number.isNaN(Number(portValue))) {
          options.port = Number(portValue)
        } else {
          throw new Error(`Invalid port value: ${portValue}`)
        }
        break
      }

      case '--host':
      case '-h': {
        const hostValue = args[++i]
        if (!hostValue) {
          throw new Error('Host value is required')
        }
        options.host = hostValue
        break
      }

      case '--env':
      case '-e': {
        const envValue = args[++i]
        if (!envValue) {
          throw new Error('Environment value is required')
        }
        options.env = envValue
        break
      }

      case '--database-path':
      case '-d': {
        const dbPath = args[++i]
        if (!dbPath) {
          throw new Error('Database path value is required')
        }
        options.databasePath = dbPath
        break
      }

      case '--help':
        options.help = true
        break

      case '--version':
      case '-v':
        options.version = true
        break

      default:
        if (arg.startsWith('--')) {
          // Handle --key=value format
          const [key, value] = arg.split('=', 2)

          switch (key) {
            case '--port':
              if (value && !Number.isNaN(Number(value))) {
                options.port = Number(value)
              } else {
                throw new Error(`Invalid port value: ${value}`)
              }
              break

            case '--host':
              if (value) {
                options.host = value
              } else {
                throw new Error('Host value is required')
              }
              break

            case '--env':
              if (value) {
                options.env = value
              } else {
                throw new Error('Environment value is required')
              }
              break

            case '--database-path':
              if (value) {
                options.databasePath = value
              } else {
                throw new Error('Database path value is required')
              }
              break

            default:
              unknown.push(arg)
              break
          }
        } else if (arg.startsWith('-')) {
          unknown.push(arg)
        } else {
          unknown.push(arg)
        }
        break
    }
  }

  return { options, unknown }
}

export function printHelp(): void {
  console.log(`
🚀 Bun Graph DB Server

Usage: bun index.ts [options]

Options:
  -p, --port <number>         Port number (default: 4141)
  -h, --host <string>         Host address (default: 0.0.0.0)
  -e, --env <environment>     Environment (development, production, test)
  -d, --database-path <path>  SQLite database file path (default: ./data/bun-graph-db.sqlite)
  --help                      Show this help message
  -v, --version              Show version information

Environment Variables:
  GRAPHQL_PORT                Port number for both HTTP and WebSocket (overridden by --port)
  PORT                        Standard port environment variable (fallback after GRAPHQL_PORT)
  GRAPHQL_HOST                Host address (overridden by --host)
  NODE_ENV                    Environment (overridden by --env)
  DATABASE_PATH               SQLite database file path (overridden by --database-path)
  CORS_ORIGIN                 CORS origins (comma-separated)

Examples:
  bun index.ts                              # Start with default settings (port 4141)
  bun index.ts --port 3000                  # Start on port 3000 (unified port)
  bun index.ts --host 127.0.0.1 -p 8080     # Custom host and port
  bun index.ts --env production              # Production environment
  bun index.ts --port=5000                   # Alternative syntax
  bun index.ts -d /tmp/demo.sqlite           # Custom database path
  bun index.ts --database-path=./custom.db   # Alternative database path syntax
`)
}

export function printVersion(): void {
  console.log('Bun Graph DB Server v1.0.0')
  console.log(`Bun: ${Bun.version}`)
  console.log(`Node: ${process.version}`)
  console.log(`Platform: ${process.platform} ${process.arch}`)
}

/**
 * Merge CLI options with environment variables
 * CLI options take precedence over environment variables
 */
export function mergeWithEnvironment(options: CliOptions): CliOptions {
  return {
    port: options.port ?? (process.env.GRAPHQL_PORT ? Number(process.env.GRAPHQL_PORT) : undefined),
    host: options.host ?? process.env.GRAPHQL_HOST,
    env: options.env ?? process.env.NODE_ENV,
    databasePath: options.databasePath ?? process.env.DATABASE_PATH,
    help: options.help,
    version: options.version,
  }
}

/**
 * Validate CLI options
 */
export function validateOptions(options: CliOptions): void {
  if (options.port !== undefined) {
    if (options.port < 1 || options.port > 65535) {
      throw new Error(`Port must be between 1 and 65535, got: ${options.port}`)
    }
  }

  if (options.env !== undefined) {
    const validEnvs = ['development', 'production', 'test', 'staging']
    if (!validEnvs.includes(options.env)) {
      throw new Error(`Invalid environment: ${options.env}. Valid values: ${validEnvs.join(', ')}`)
    }
  }

  if (options.host !== undefined) {
    // Basic host validation - could be more comprehensive
    if (options.host.length === 0) {
      throw new Error('Host cannot be empty')
    }
  }
}
