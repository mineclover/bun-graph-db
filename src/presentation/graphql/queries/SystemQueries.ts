import type { ILogger } from '../../../application/ports/ILogger.js'
import type { SystemMonitoringUseCase } from '../../../application/use-cases/monitoring/SystemMonitoringUseCase.js'
import { toErrorMeta } from '../../http/utils/errorHelpers.js'

interface HealthStatus {
  status: string
  timestamp: Date
  database: boolean
  version: string
  memory: MemoryHealthStatus
}

interface MemoryHealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  percentage: number
  message?: string
}

export class SystemQueries {
  constructor(
    private systemMonitoringUseCase: SystemMonitoringUseCase,
    private logger: ILogger,
  ) {}

  async systemStats() {
    try {
      this.logger.info('Fetching system statistics')
      const stats = await this.systemMonitoringUseCase.getSystemStats()

      this.logger.debug('System stats retrieved', {
        memoryUsage: stats.memory.percentage,
        uptime: stats.uptime,
        queryCount: stats.database.queryCount,
      })

      return stats
    } catch (error) {
      this.logger.error('Error fetching system statistics', toErrorMeta(error))
      throw error
    }
  }

  async memoryStats() {
    try {
      this.logger.info('Fetching memory statistics')
      const memoryStats = await this.systemMonitoringUseCase.getMemoryStats()

      this.logger.debug('Memory stats retrieved', {
        used: memoryStats.used,
        percentage: memoryStats.percentage,
        heapUsed: memoryStats.heap.used,
      })

      return memoryStats
    } catch (error) {
      this.logger.error('Error fetching memory statistics', toErrorMeta(error))
      throw error
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      this.logger.info('Performing health check')
      const systemStats = await this.systemMonitoringUseCase.getSystemStats()

      // Determine memory health status
      const memoryHealth = this.getMemoryHealthStatus(systemStats.memory.percentage)

      const healthStatus: HealthStatus = {
        status: memoryHealth.status === 'critical' ? 'UNHEALTHY' : 'OK',
        timestamp: new Date(),
        database: true, // SQLite is always connected
        version: '1.0.0',
        memory: memoryHealth,
      }

      this.logger.debug('Health check completed', {
        status: healthStatus.status,
        memoryStatus: memoryHealth.status,
        memoryPercentage: memoryHealth.percentage,
      })

      return healthStatus
    } catch (error) {
      this.logger.error('Error during health check', toErrorMeta(error))

      return {
        status: 'ERROR',
        timestamp: new Date(),
        database: false,
        version: '1.0.0',
        memory: {
          status: 'critical',
          percentage: 0,
          message: 'Health check failed',
        },
      }
    }
  }

  private getMemoryHealthStatus(percentage: number): MemoryHealthStatus {
    if (percentage < 70) {
      return {
        status: 'healthy',
        percentage,
        message: 'Memory usage is within normal range',
      }
    } else if (percentage < 85) {
      return {
        status: 'warning',
        percentage,
        message: 'Memory usage is elevated, monitoring recommended',
      }
    } else {
      return {
        status: 'critical',
        percentage,
        message: 'Memory usage is critically high, immediate attention required',
      }
    }
  }
}
