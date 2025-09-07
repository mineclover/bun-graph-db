import type { DIContainer } from '../DIContainer.js'
import type { 
  GraphHandlerDependencies, 
  QueryTemplateHandlerDependencies 
} from '@/context-layered/handlers/index.js'
import { CommonTokens } from '../tokens/CommonTokens.js'
import { RepositoryTokens } from '../tokens/RepositoryTokens.js'
import { DatabaseTokens } from '../tokens/DatabaseTokens.js'
import { GraphQLTokens } from '../tokens/GraphQLTokens.js'

/**
 * Context-Layered Module - Registers context-layered architecture dependencies
 */

// Token definitions for context-layered dependencies
export const ContextLayeredTokens = {
  // Handler Dependencies
  GRAPH_HANDLER_DEPENDENCIES: Symbol.for('GraphHandlerDependencies'),
  QUERY_TEMPLATE_HANDLER_DEPENDENCIES: Symbol.for('QueryTemplateHandlerDependencies'),
  
  // Configuration
  CONTEXT_LAYERED_CONFIG: Symbol.for('ContextLayeredConfig'),
  
  // Services
  QUERY_EXECUTOR: Symbol.for('QueryExecutor'),
  QUERY_VALIDATOR: Symbol.for('QueryValidator'),
} as const

export function registerContextLayeredModule(container: DIContainer): void {
  // Register Graph Handler Dependencies
  container.registerSingleton(
    ContextLayeredTokens.GRAPH_HANDLER_DEPENDENCIES,
    async (container): Promise<GraphHandlerDependencies> => ({
      nodeRepository: await container.resolve(RepositoryTokens.NODE_REPOSITORY),
      tableRepository: await container.resolve(RepositoryTokens.TABLE_REPOSITORY),
      attributeRepository: await container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY),
      relationRepository: await container.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY),
      relationTypeRepository: await container.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY),
      logger: await container.resolve(CommonTokens.LOGGER),
      config: {
        maxNodesPerQuery: 1000,
        cacheTimeout: 30000,
        enableValidation: true
      }
    })
  )

  // Register Query Template Handler Dependencies  
  container.registerSingleton(
    ContextLayeredTokens.QUERY_TEMPLATE_HANDLER_DEPENDENCIES,
    async (container): Promise<QueryTemplateHandlerDependencies> => ({
      templateRepository: await container.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY),
      queryExecutor: await container.resolve(ContextLayeredTokens.QUERY_EXECUTOR),
      validator: await container.resolve(ContextLayeredTokens.QUERY_VALIDATOR),
      logger: await container.resolve(CommonTokens.LOGGER),
      config: {
        executionTimeout: 30000,
        maxHistorySize: 100,
        enableCaching: true,
        maxComplexity: 1000
      }
    })
  )

  // Register Query Executor (temporary implementation)
  container.registerSingleton(
    ContextLayeredTokens.QUERY_EXECUTOR,
    async (container) => {
      const logger = await container.resolve(CommonTokens.LOGGER)
      
      return {
        async execute(query: string, variables: Record<string, any>): Promise<any> {
          logger.info('Executing query with context-layered executor', { 
            queryLength: query.length,
            variableKeys: Object.keys(variables)
          })
          
          try {
            // This would integrate with your actual GraphQL execution engine
            // For now, we'll create a mock implementation that delegates to existing resolvers
            
            // Parse the GraphQL query to determine the operation
            const operationType = this.parseOperationType(query)
            const operationName = this.parseOperationName(query)
            
            // Delegate to existing GraphQL schema execution
            const graphqlSchema = await container.resolve(GraphQLTokens.EXECUTABLE_SCHEMA)
            const { execute } = require('graphql')
            
            const result = await execute({
              schema: graphqlSchema,
              document: require('graphql').parse(query),
              variableValues: variables,
              contextValue: {
                // Provide context that existing resolvers expect
                container,
                logger
              }
            })
            
            logger.info('Query executed successfully', {
              operationType,
              operationName,
              hasErrors: !!result.errors
            })
            
            if (result.errors) {
              throw new Error(`GraphQL execution failed: ${result.errors.map(e => e.message).join(', ')}`)
            }
            
            return result.data
          } catch (error) {
            logger.error('Query execution failed', { error, query, variables })
            throw error
          }
        },
        
        parseOperationType(query: string): string {
          const trimmed = query.trim()
          if (trimmed.startsWith('query')) return 'query'
          if (trimmed.startsWith('mutation')) return 'mutation'
          if (trimmed.startsWith('subscription')) return 'subscription'
          return 'query' // default
        },
        
        parseOperationName(query: string): string | null {
          const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/)
          return match ? match[1] : null
        }
      }
    }
  )

  // Register Query Validator (temporary implementation)
  container.registerSingleton(
    ContextLayeredTokens.QUERY_VALIDATOR,
    async (container) => {
      const logger = await container.resolve(CommonTokens.LOGGER)
      
      return {
        async validateQuery(query: string) {
          logger.info('Validating GraphQL query', { queryLength: query.length })
          
          try {
            const { parse, validate, buildSchema } = require('graphql')
            const graphqlSchema = await container.resolve(GraphQLTokens.EXECUTABLE_SCHEMA)
            
            // Parse the query
            const document = parse(query)
            
            // Validate against schema
            const errors = validate(graphqlSchema, document)
            
            const isValid = errors.length === 0
            
            // Calculate complexity (simple heuristic)
            const complexity = this.calculateComplexity(query)
            
            const result = {
              isValid,
              errors: errors.map(error => ({
                type: 'syntax' as const,
                message: error.message,
                line: error.locations?.[0]?.line,
                column: error.locations?.[0]?.column,
                severity: 'error' as const
              })),
              warnings: [],
              suggestions: [],
              complexity: complexity.score,
              estimatedExecutionTime: complexity.estimatedTime
            }
            
            logger.info('Query validation completed', {
              isValid,
              errorCount: errors.length,
              complexity: complexity.score
            })
            
            return result
          } catch (error) {
            logger.error('Query validation failed', { error, query })
            return {
              isValid: false,
              errors: [{
                type: 'syntax' as const,
                message: error.message || 'Unknown validation error',
                severity: 'error' as const
              }],
              warnings: [],
              suggestions: [],
              complexity: 0,
              estimatedExecutionTime: 0
            }
          }
        },
        
        async analyzeComplexity(query: string) {
          return this.calculateComplexity(query)
        },
        
        calculateComplexity(query: string) {
          // Simple complexity calculation based on query structure
          const fieldCount = (query.match(/\w+\s*{/g) || []).length
          const nestingLevel = this.calculateNestingLevel(query)
          const variableCount = (query.match(/\$\w+/g) || []).length
          
          const score = (fieldCount * 2) + (nestingLevel * 10) + (variableCount * 1)
          const estimatedTime = Math.max(100, score * 10) // minimum 100ms
          
          return { score, estimatedTime }
        },
        
        calculateNestingLevel(query: string): number {
          let maxLevel = 0
          let currentLevel = 0
          
          for (const char of query) {
            if (char === '{') {
              currentLevel++
              maxLevel = Math.max(maxLevel, currentLevel)
            } else if (char === '}') {
              currentLevel--
            }
          }
          
          return maxLevel
        }
      }
    }
  )

  // Register Context-Layered Config
  container.registerSingleton(
    ContextLayeredTokens.CONTEXT_LAYERED_CONFIG,
    async (container) => {
      const graphDeps = await container.resolve(ContextLayeredTokens.GRAPH_HANDLER_DEPENDENCIES)
      const templateDeps = await container.resolve(ContextLayeredTokens.QUERY_TEMPLATE_HANDLER_DEPENDENCIES)
      
      return {
        graph: {
          dependencies: graphDeps
        },
        templates: {
          dependencies: templateDeps
        },
        global: {
          enableLogging: process.env.NODE_ENV === 'development',
          enablePerformanceMonitoring: process.env.NODE_ENV === 'development',
          errorBoundary: true,
          theme: 'auto' as const
        }
      }
    }
  )
}

// Export type-safe resolver functions
export const resolveGraphHandlerDependencies = async (container: DIContainer): Promise<GraphHandlerDependencies> => {
  return await container.resolve(ContextLayeredTokens.GRAPH_HANDLER_DEPENDENCIES)
}

export const resolveQueryTemplateHandlerDependencies = async (container: DIContainer): Promise<QueryTemplateHandlerDependencies> => {
  return await container.resolve(ContextLayeredTokens.QUERY_TEMPLATE_HANDLER_DEPENDENCIES)
}

export const resolveContextLayeredConfig = async (container: DIContainer) => {
  return await container.resolve(ContextLayeredTokens.CONTEXT_LAYERED_CONFIG)
}

// Integration utilities for gradual migration
export const createContextLayeredIntegration = (container: DIContainer) => {
  // Ensure the context-layered module is registered
  if (!container.isRegistered(ContextLayeredTokens.GRAPH_HANDLER_DEPENDENCIES)) {
    registerContextLayeredModule(container)
  }
  
  return {
    getGraphDependencies: () => resolveGraphHandlerDependencies(container),
    getTemplateDependencies: () => resolveQueryTemplateHandlerDependencies(container),
    getConfig: () => resolveContextLayeredConfig(container),
    
    // Utility to check if context-layered is ready
    isReady: () => {
      return container.isRegistered(ContextLayeredTokens.GRAPH_HANDLER_DEPENDENCIES) &&
             container.isRegistered(ContextLayeredTokens.QUERY_TEMPLATE_HANDLER_DEPENDENCIES)
    }
  }
}