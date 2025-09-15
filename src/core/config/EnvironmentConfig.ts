/**
 * Environment configuration
 */

import { createDatabaseConfig, type DatabaseConfig } from './DatabaseConfig.js'
import { createGraphQLConfig, type GraphQLConfig } from './GraphQLConfig.js'

export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  host: string
  database: DatabaseConfig
  graphql: GraphQLConfig
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug'
    format: 'json' | 'pretty'
  }
}

export const loadEnvironmentConfig = (): EnvironmentConfig => {
  const env = process.env

  return {
    nodeEnv: (env.NODE_ENV as EnvironmentConfig['nodeEnv']) || 'development',
    port: parseInt(env.PORT || '3000', 10),
    host: env.HOST || '0.0.0.0',
    database: createDatabaseConfig(env),
    graphql: createGraphQLConfig(env),
    logging: {
      level: (env.LOG_LEVEL as EnvironmentConfig['logging']['level']) || 'info',
      format: (env.LOG_FORMAT as EnvironmentConfig['logging']['format']) || 'pretty',
    },
  }
}
