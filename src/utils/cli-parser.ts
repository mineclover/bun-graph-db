/**
 * CLI Argument Parser
 *
 * Simple CLI argument parser for server configuration
 */

export interface CliOptions {
  port?: number
  host?: string
  env?: string
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

    switch (arg) {
      case '--port':
      case '-p': {
        const portValue = args[++i]
        if (portValue && !isNaN(Number(portValue))) {
          options.port = Number(portValue)
        } else {
          throw new Error(`Invalid port value: ${portValue}`)
        }
        break
      }

      case '--host':
      case '-h':
        options.host = args[++i]
        if (!options.host) {
          throw new Error('Host value is required')
        }
        break

      case '--env':
      case '-e':
        options.env = args[++i]
        if (!options.env) {
          throw new Error('Environment value is required')
        }
        break

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
              if (value && !isNaN(Number(value))) {
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
  -p, --port <number>       Port number (default: 4000)
  -h, --host <string>       Host address (default: 0.0.0.0)
  -e, --env <environment>   Environment (development, production, test)
  --help                    Show this help message
  -v, --version            Show version information

Environment Variables:
  GRAPHQL_PORT              Port number (overridden by --port)
  GRAPHQL_HOST              Host address (overridden by --host)
  NODE_ENV                  Environment (overridden by --env)
  CORS_ORIGIN               CORS origins (comma-separated)

Examples:
  bun index.ts                          # Start with default settings
  bun index.ts --port 3000              # Start on port 3000
  bun index.ts --host 127.0.0.1 -p 8080 # Custom host and port
  bun index.ts --env production          # Production environment
  bun index.ts --port=5000               # Alternative syntax
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
