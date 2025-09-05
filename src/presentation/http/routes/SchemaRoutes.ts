/**
 * Schema Routes for External GraphQL Schema Access
 * 
 * Provides REST endpoints to serve GraphQL schema files for external consumption
 */

import type { DIContainer } from '../../../infrastructure/container/DIContainer.js'
import type { ILogger } from '../../../application/ports/ILogger.js'
import { CommonTokens } from '../../../infrastructure/container/tokens/CommonTokens.js'
import { GraphQLSchemaBuilder } from '../../graphql/GraphQLSchemaBuilder.js'
import { printSchema, getIntrospectionQuery, buildClientSchema, introspectionFromSchema } from 'graphql'

export interface SchemaEndpoint {
  path: string
  method: 'GET' | 'POST'
  handler: (request: Request) => Promise<Response>
}

export class SchemaRoutes {
  private logger: ILogger
  private schemaBuilder: GraphQLSchemaBuilder

  constructor(private container: DIContainer) {
    this.schemaBuilder = new GraphQLSchemaBuilder(container)
  }

  private async getLogger(): Promise<ILogger> {
    if (!this.logger) {
      this.logger = await this.container.resolve<ILogger>(CommonTokens.LOGGER)
    }
    return this.logger
  }

  /**
   * Get all schema-related endpoints
   */
  async getEndpoints(): Promise<SchemaEndpoint[]> {
    return [
      {
        path: '/schema',
        method: 'GET',
        handler: this.getSchemaSDL.bind(this),
      },
      {
        path: '/schema.graphql',
        method: 'GET',
        handler: this.getSchemaSDL.bind(this),
      },
      {
        path: '/schema.json',
        method: 'GET',
        handler: this.getSchemaJSON.bind(this),
      },
      {
        path: '/introspection',
        method: 'GET',
        handler: this.getIntrospectionQuery.bind(this),
      },
      {
        path: '/introspection.json',
        method: 'GET',
        handler: this.getIntrospectionJSON.bind(this),
      },
      {
        path: '/schema/typescript',
        method: 'GET',
        handler: this.getTypeScriptTypes.bind(this),
      },
    ]
  }

  /**
   * GET /schema - Returns GraphQL Schema SDL
   */
  private async getSchemaSDL(request: Request): Promise<Response> {
    try {
      const logger = await this.getLogger()
      logger.info('Schema SDL requested', { 
        url: request.url,
        userAgent: request.headers.get('user-agent')
      })

      const schema = await this.schemaBuilder.build()
      const sdl = printSchema(schema)

      return new Response(sdl, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to generate schema SDL', { error })
      
      return new Response(
        JSON.stringify({
          error: 'Failed to generate schema',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * GET /schema.json - Returns complete schema as JSON
   */
  private async getSchemaJSON(request: Request): Promise<Response> {
    try {
      const logger = await this.getLogger()
      logger.info('Schema JSON requested', { 
        url: request.url,
        userAgent: request.headers.get('user-agent')
      })

      const schema = await this.schemaBuilder.build()
      const introspection = introspectionFromSchema(schema)

      return new Response(JSON.stringify(introspection, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to generate schema JSON', { error })
      
      return new Response(
        JSON.stringify({
          error: 'Failed to generate schema JSON',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * GET /introspection - Returns introspection query string
   */
  private async getIntrospectionQuery(request: Request): Promise<Response> {
    try {
      const introspectionQuery = getIntrospectionQuery()

      return new Response(introspectionQuery, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400', // 24 hours cache (static query)
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to generate introspection query', { error })
      
      return new Response(
        JSON.stringify({
          error: 'Failed to generate introspection query',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * GET /introspection.json - Returns introspection result as JSON
   */
  private async getIntrospectionJSON(request: Request): Promise<Response> {
    try {
      const logger = await this.getLogger()
      logger.info('Introspection JSON requested', { 
        url: request.url,
        userAgent: request.headers.get('user-agent')
      })

      const schema = await this.schemaBuilder.build()
      const introspection = introspectionFromSchema(schema)

      // Wrap in data property for GraphQL introspection format
      const result = {
        data: introspection,
      }

      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to generate introspection JSON', { error })
      
      return new Response(
        JSON.stringify({
          error: 'Failed to generate introspection JSON',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * GET /schema/typescript - Returns TypeScript type definitions
   */
  private async getTypeScriptTypes(request: Request): Promise<Response> {
    try {
      const logger = await this.getLogger()
      logger.info('TypeScript types requested', { 
        url: request.url,
        userAgent: request.headers.get('user-agent')
      })

      // Basic TypeScript types generation (simplified)
      const schema = await this.schemaBuilder.build()
      const introspection = introspectionFromSchema(schema)
      
      const typeDefinitions = this.generateTypeScriptDefinitions(introspection)

      return new Response(typeDefinitions, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to generate TypeScript types', { error })
      
      return new Response(
        JSON.stringify({
          error: 'Failed to generate TypeScript types',
          message: error instanceof Error ? error.message : 'Unknown error',
          note: 'Use graphql-codegen for complete type generation',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  /**
   * Basic TypeScript definitions generator (simplified)
   */
  private generateTypeScriptDefinitions(introspection: any): string {
    const types = introspection.types || []
    
    let typescript = `// Generated GraphQL TypeScript Definitions\n`
    typescript += `// Generated at: ${new Date().toISOString()}\n`
    typescript += `// Use 'bun run codegen' for complete type generation\n\n`

    // Add basic scalar types
    typescript += `export type Scalars = {\n`
    typescript += `  ID: { input: string; output: string };\n`
    typescript += `  String: { input: string; output: string };\n`
    typescript += `  Boolean: { input: boolean; output: boolean };\n`
    typescript += `  Int: { input: number; output: number };\n`
    typescript += `  Float: { input: number; output: number };\n`
    typescript += `  DateTime: { input: string; output: string };\n`
    typescript += `  JSON: { input: any; output: any };\n`
    typescript += `};\n\n`

    // Add enum types
    const enums = types.filter((type: any) => type.kind === 'ENUM')
    enums.forEach((enumType: any) => {
      typescript += `export type ${enumType.name} =\n`
      const values = enumType.enumValues || []
      values.forEach((value: any, index: number) => {
        typescript += `  | '${value.name}'`
        if (index < values.length - 1) typescript += '\n'
      })
      typescript += ';\n\n'
    })

    // Add a note about complete generation
    typescript += `// For complete type definitions including objects, inputs, and operations,\n`
    typescript += `// run: bun run codegen\n`
    typescript += `// or visit: http://localhost:4000/schema.json\n`

    return typescript
  }
}

/**
 * Schema route handler for Bun.serve
 */
export async function createSchemaHandler(container: DIContainer) {
  const routes = new SchemaRoutes(container)
  const endpoints = await routes.getEndpoints()

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    const pathname = url.pathname

    for (const endpoint of endpoints) {
      if (pathname === endpoint.path && request.method === endpoint.method) {
        return await endpoint.handler(request)
      }
    }

    return null // Not handled by schema routes
  }
}