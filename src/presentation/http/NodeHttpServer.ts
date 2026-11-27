import { createServer as createHttpServer, type Server } from 'node:http'
import { type AddressInfo, createServer as createNetServer } from 'node:net'
import { createServerAdapter } from '@whatwg-node/server'

export interface FetchHttpServer {
  readonly port: number
  readonly hostname: string
  stop: (_closeActiveConnections?: boolean) => Promise<void>
}

export interface StartFetchHttpServerOptions {
  fetch: (request: Request) => Promise<Response> | Response
  port: number
  hostname?: string
}

export async function startFetchHttpServer(
  options: StartFetchHttpServerOptions,
): Promise<FetchHttpServer> {
  const hostname = options.hostname ?? '0.0.0.0'
  const adapter = createServerAdapter((request: Request) => options.fetch(request))
  const server: Server = createHttpServer(adapter)

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(options.port, hostname)
  })

  const address = server.address() as AddressInfo | null
  const boundPort = address?.port ?? options.port

  return {
    port: boundPort,
    hostname,
    stop: async () => {
      server.closeAllConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }
}

export async function checkPortAvailable(
  port: number,
  hostname = '127.0.0.1',
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const tester = createNetServer()
    tester.unref()
    tester.once('error', () => resolve(false))
    tester.listen(port, hostname, () => {
      tester.close(() => resolve(true))
    })
  })
}
