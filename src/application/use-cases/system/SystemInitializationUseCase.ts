/**
 * System Initialization Use Case
 * Orchestrates system initialization through the service layer
 */

import type { DIContainer } from '../../../infrastructure/container/DIContainer'
import { SystemInitializationService, type InitializationOptions, type InitializationResult } from '../../services/SystemInitializationService'

export interface SystemInitializationRequest {
  mode: 'quick' | 'full' | 'demo' | 'custom'
  options?: Partial<InitializationOptions>
}

export class SystemInitializationUseCase {
  private initializationService: SystemInitializationService

  constructor(private container: DIContainer) {
    this.initializationService = new SystemInitializationService(container)
  }

  /**
   * Execute system initialization based on mode
   */
  async execute(request: SystemInitializationRequest): Promise<InitializationResult> {
    switch (request.mode) {
      case 'quick':
        return this.initializationService.quickReset()

      case 'full':
        return this.initializationService.fullReset()

      case 'demo':
        return this.initializationService.demoSetup()

      case 'custom':
        if (!request.options) {
          throw new Error('Custom mode requires options to be specified')
        }

        const fullOptions: InitializationOptions = {
          resetDatabase: false,
          resetTemplates: false,
          resetTestData: false,
          createSampleData: false,
          resetMetrics: false,
          mode: 'development',
          ...request.options
        }

        return this.initializationService.initialize(fullOptions)

      default:
        throw new Error(`Unknown initialization mode: ${request.mode}`)
    }
  }

  /**
   * Get current system status
   */
  async getStatus() {
    return this.initializationService.getSystemStatus()
  }
}