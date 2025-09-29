/**
 * System GraphQL Resolver
 * Handles system-level operations including initialization
 */

import type { DIContainer } from '../../../infrastructure/container/DIContainer'
import { SystemInitializationUseCase, type SystemInitializationRequest } from '../../../application/use-cases/system/SystemInitializationUseCase'
import { BaseResolver } from '../base/BaseResolver'

interface SystemInitializationInput {
  mode: 'QUICK' | 'FULL' | 'DEMO' | 'CUSTOM'
  options?: {
    resetDatabase?: boolean
    resetTemplates?: boolean
    resetTestData?: boolean
    createSampleData?: boolean
    resetMetrics?: boolean
    preserveTableIds?: number[]
    initMode?: 'DEVELOPMENT' | 'TESTING' | 'PRODUCTION' | 'DEMO'
  }
}

export class SystemResolver extends BaseResolver {
  private systemInitializationUseCase: SystemInitializationUseCase

  constructor(container: DIContainer) {
    super()
    this.systemInitializationUseCase = new SystemInitializationUseCase(container)
  }

  /**
   * Initialize system mutation
   */
  async initializeSystem(
    _parent: unknown,
    args: { input: SystemInitializationInput }
  ) {
    try {
      const { input } = args

      // Convert GraphQL enum to use case format
      const mode = input.mode.toLowerCase() as 'quick' | 'full' | 'demo' | 'custom'

      const request: SystemInitializationRequest = {
        mode,
        options: input.options ? {
          ...input.options,
          mode: input.options.initMode ? input.options.initMode.toLowerCase() as any : 'development'
        } : undefined
      }

      const result = await this.systemInitializationUseCase.execute(request)

      return {
        success: result.success,
        result: result.success ? {
          actions: result.actions,
          timings: result.timings,
          summary: result.summary,
          totalTime: result.timings.total || 0
        } : null,
        errors: result.errors.map(error => ({ message: error }))
      }
    } catch (error) {
      return this.handleError(error, 'Failed to initialize system')
    }
  }

  /**
   * Get system status query
   */
  async systemStatus() {
    try {
      const status = await this.systemInitializationUseCase.getStatus()

      return {
        database: status.database,
        summary: {
          tablesCount: status.tablesCount,
          templatesCount: status.templatesCount,
          nodesCount: status.nodesCount,
          attributesCount: 0 // Will be calculated if needed
        },
        lastInitialized: status.lastInitialized
      }
    } catch (error) {
      return this.handleError(error, 'Failed to get system status')
    }
  }
}