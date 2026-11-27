import type { ILogger } from '../../ports/ILogger.js'

export interface SystemStats {
  memory: MemoryStats
  process: ProcessStats
  timestamp: Date
  uptime: number
  database: DatabaseStats
}

export interface MemoryStats {
  used: number
  free: number
  total: number
  percentage: number
  heap: HeapStats
}

export interface HeapStats {
  used: number
  total: number
  external: number
  arrayBuffers: number
}

export interface ProcessStats {
  pid: number
  cpu: number
  version: string
  platform: string
  memoryDetails: ProcessMemoryDetails
}

export interface ProcessMemoryDetails {
  rss: number // Resident Set Size (MB)
  heapUsed: number // 사용 중인 힙 메모리 (MB)
  heapTotal: number // 할당된 힙 메모리 (MB)
  external: number // C++ 객체 메모리 (MB)
  arrayBuffers: number // ArrayBuffer 메모리 (MB)
  heapEfficiency: number // 힙 효율성 (%)
  memoryPressure: 'low' | 'medium' | 'high' // 메모리 압박 수준
}

export interface DatabaseStats {
  connectionCount: number
  queryCount: number
  averageQueryTime: number
}

export class SystemMonitoringUseCase {
  private queryCount = 0
  private totalQueryTime = 0

  constructor(private logger: ILogger) {}

  async getSystemStats(): Promise<SystemStats> {
    const hasProcess = typeof process !== 'undefined'
    const memoryUsage: NodeJS.MemoryUsage =
      hasProcess && typeof process.memoryUsage === 'function'
        ? process.memoryUsage()
        : { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
    const cpuUsage: NodeJS.CpuUsage =
      hasProcess && typeof process.cpuUsage === 'function'
        ? process.cpuUsage()
        : { user: 0, system: 0 }
    const uptimeSeconds = hasProcess && typeof process.uptime === 'function' ? process.uptime() : 0

    // Calculate memory statistics
    const totalMemory = await this.getTotalSystemMemory()
    const freeMemory = this.getFreeSystemMemory(memoryUsage, totalMemory)
    const usedMemory = totalMemory - freeMemory
    const memoryPercentage = (usedMemory / totalMemory) * 100

    const stats: SystemStats = {
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
        heap: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024), // MB
        },
      },
      process: {
        pid: hasProcess && typeof process.pid === 'number' ? process.pid : 0,
        cpu: this.calculateCpuPercentage(cpuUsage, uptimeSeconds),
        version: hasProcess && typeof process.version === 'string' ? process.version : 'web',
        platform: hasProcess && typeof process.platform === 'string' ? process.platform : 'browser',
        memoryDetails: this.getProcessMemoryDetails(memoryUsage, memoryPercentage),
      },
      database: {
        connectionCount: 1, // SQLite is single connection
        queryCount: this.queryCount,
        averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      },
      timestamp: new Date(),
      uptime: Math.round(uptimeSeconds),
    }

    this.logger.debug('System stats collected', { stats: JSON.stringify(stats) })
    return stats
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const systemStats = await this.getSystemStats()
    return systemStats.memory
  }

  recordQuery(executionTime: number): void {
    this.queryCount++
    this.totalQueryTime += executionTime
  }

  resetQueryStats(): void {
    this.queryCount = 0
    this.totalQueryTime = 0
  }

  private async getTotalSystemMemory(): Promise<number> {
    try {
      const os = await import('node:os')
      return os.totalmem() || 4 * 1024 * 1024 * 1024
    } catch {
      return 4 * 1024 * 1024 * 1024
    }
  }

  private getFreeSystemMemory(memoryUsage: NodeJS.MemoryUsage, totalMemory: number): number {
    const usedByProcess = memoryUsage.rss

    // Estimate free memory (this is approximate)
    return Math.max(totalMemory - usedByProcess, memoryUsage.heapTotal - memoryUsage.heapUsed)
  }

  private calculateCpuPercentage(cpuUsage: NodeJS.CpuUsage, uptimeSeconds: number): number {
    // Simple CPU usage calculation
    const totalCpu = cpuUsage.user + cpuUsage.system
    const totalTime = uptimeSeconds * 1000000 // Convert to microseconds

    if (totalTime === 0) return 0

    const percentage = Math.round((totalCpu / totalTime) * 100 * 100) / 100

    // This metric is used for coarse health monitoring in a single-process test setup.
    // Clamp runaway lifetime-based values so callers get a stable 0-100 style signal.
    return Math.min(99.99, percentage)
  }

  private getProcessMemoryDetails(
    memoryUsage: NodeJS.MemoryUsage,
    systemMemoryPercentage: number,
  ): ProcessMemoryDetails {
    const rssInMB = Math.round(memoryUsage.rss / 1024 / 1024)
    const heapUsedInMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    const heapTotalInMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
    const externalInMB = Math.round(memoryUsage.external / 1024 / 1024)
    const arrayBuffersInMB = Math.round(memoryUsage.arrayBuffers / 1024 / 1024)

    // 힙 효율성 계산 (사용 중인 힙 / 할당된 힙)
    const heapEfficiency = heapTotalInMB > 0 ? Math.round((heapUsedInMB / heapTotalInMB) * 100) : 0

    // 메모리 압박 수준 결정
    let memoryPressure: 'low' | 'medium' | 'high'
    if (systemMemoryPercentage < 60) {
      memoryPressure = 'low'
    } else if (systemMemoryPercentage < 80) {
      memoryPressure = 'medium'
    } else {
      memoryPressure = 'high'
    }

    return {
      rss: rssInMB,
      heapUsed: heapUsedInMB,
      heapTotal: heapTotalInMB,
      external: externalInMB,
      arrayBuffers: arrayBuffersInMB,
      heapEfficiency,
      memoryPressure,
    }
  }
}
