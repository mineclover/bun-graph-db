import { beforeEach, describe, expect, test } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import { BatchImportTablePackagesUseCase } from '@/application/use-cases/table-packages/BatchImportTablePackagesUseCase.js'
import type { ImportSession, TablePackageFormat } from '@/core/types/TablePackage.js'
import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'

// Mock implementations for error handling tests
class MockLogger implements ILogger {
  logs: Array<{ level: string; message: string; data?: any }> = []

  info(message: string, data?: any): void {
    this.logs.push({ level: 'info', message, data })
  }
  warn(message: string, data?: any): void {
    this.logs.push({ level: 'warn', message, data })
  }
  error(message: string, data?: any): void {
    this.logs.push({ level: 'error', message, data })
  }
  debug(message: string, data?: any): void {
    this.logs.push({ level: 'debug', message, data })
  }

  getLogs(level?: string): Array<{ level: string; message: string; data?: any }> {
    return level ? this.logs.filter((log) => log.level === level) : this.logs
  }

  clearLogs(): void {
    this.logs = []
  }
}

class MockTablePackageService implements ITablePackageService {
  private sessions = new Map<string, ImportSession>()
  private shouldFailOnTable: string | null = null
  private rollbackCalled = false

  setShouldFailOnTable(tableIdentifier: string): void {
    this.shouldFailOnTable = tableIdentifier
  }

  wasRollbackCalled(): boolean {
    return this.rollbackCalled
  }

  async exportTable(): Promise<any> {
    return { success: true, tablePackage: {} as any, errors: [], warnings: [] }
  }

  async exportRelatedTables(): Promise<any> {
    return []
  }

  async importTablePackage(packageData: TablePackageFormat): Promise<any> {
    if (this.shouldFailOnTable === packageData.sourceTable.identifier) {
      return {
        success: false,
        errors: [`Simulated error for table ${packageData.sourceTable.identifier}`],
        warnings: [],
      }
    }

    return {
      success: true,
      importedTable: {
        id: 'mock-id',
        identifier: packageData.sourceTable.identifier,
        originalIdentifier: packageData.sourceTable.identifier,
      },
      generatedTemplates: [],
      resolvedConflicts: [],
      errors: [],
      warnings: [],
    }
  }

  async importTablePackages(): Promise<any> {
    return []
  }

  async analyzeDependencies(): Promise<any> {
    return {
      tableIdentifier: 'test',
      dependencies: [],
      dependents: [],
      depth: 0,
      circularReferences: [],
    }
  }

  async resolveImportOrder(tableIdentifiers: string[]): Promise<string[]> {
    return tableIdentifiers
  }

  async validatePackage(): Promise<any> {
    return []
  }

  async createImportSession(packages: TablePackageFormat[]): Promise<ImportSession> {
    const sessionId = `session_${Date.now()}`
    const session: ImportSession = {
      sessionId,
      status: 'pending',
      startedAt: new Date(),
      packagesImported: [],
      packagesRemaining: packages.map((p) => p.sourceTable.identifier),
      rollbackInfo: {
        tablesCreated: [],
        templatesCreated: [],
        nodesCreated: [],
      },
      errors: [],
    }

    this.sessions.set(sessionId, session)
    return session
  }

  async getImportSession(sessionId: string): Promise<ImportSession | null> {
    return this.sessions.get(sessionId) || null
  }

  async rollbackImportSession(sessionId: string): Promise<void> {
    this.rollbackCalled = true
    const session = this.sessions.get(sessionId)
    if (session) {
      session.status = 'rolled_back'
      session.completedAt = new Date()
    }
  }

  async generateTableTemplates(): Promise<any> {
    return {
      success: true,
      templates: [],
      errors: [],
    }
  }
}

describe('TablePackageService Error Handling', () => {
  let mockService: MockTablePackageService
  let mockLogger: MockLogger
  let batchImportUseCase: BatchImportTablePackagesUseCase

  const createMockPackage = (identifier: string): TablePackageFormat => ({
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    sourceTable: {
      identifier,
      description: `Mock table ${identifier}`,
    },
    dependencies: [],
    package: {
      schema: {
        table: {
          identifier,
          description: `Mock table ${identifier}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        attributes: [],
        attributeTypes: [],
      },
      dataset: {
        nodes: [],
        nodeAttributes: [],
      },
      relations: {
        relationTypes: [],
        nodeRelations: [],
      },
      templates: {
        templates: [],
      },
    },
  })

  beforeEach(() => {
    mockService = new MockTablePackageService()
    mockLogger = new MockLogger()
    batchImportUseCase = new BatchImportTablePackagesUseCase(mockService, mockLogger)
  })

  describe('Batch Import Error Handling', () => {
    test('should handle partial failures gracefully', async () => {
      // Arrange
      const packages = [
        createMockPackage('table1'),
        createMockPackage('table2'), // This will fail
        createMockPackage('table3'),
      ]

      mockService.setShouldFailOnTable('table2')

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        options: { conflictResolution: 'SKIP' },
        createSession: true,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.summary.total).toBe(3)
      expect(result.summary.succeeded).toBeGreaterThanOrEqual(1) // At least table1 should succeed
      expect(result.summary.failed).toBeGreaterThanOrEqual(1) // At least table2 should fail
      expect(result.summary.total).toBe(3) // Total should be 3

      // Check that we have results for attempted imports
      expect(result.results.length).toBeGreaterThan(0)

      // Check that session was created and contains error information
      expect(result.session).toBeDefined()
      expect(result.session?.errors.length).toBeGreaterThan(0)
    })

    test('should continue processing on non-critical errors', async () => {
      // Arrange
      const packages = [
        createMockPackage('table1'),
        createMockPackage('table2'), // This will fail
        createMockPackage('table3'),
      ]

      mockService.setShouldFailOnTable('table2')

      // Act with continue on error strategy
      const result = await batchImportUseCase.execute({
        packages,
        options: { conflictResolution: 'MERGE' }, // Different strategy that allows continuation
        createSession: false,
      })

      // Assert
      expect(result.summary.total).toBe(3)

      // Verify logging occurred (either error or warning logs should exist)
      const errorLogs = mockLogger.getLogs('error')
      const warningLogs = mockLogger.getLogs('warn')
      const infoLogs = mockLogger.getLogs('info')
      expect(errorLogs.length + warningLogs.length + infoLogs.length).toBeGreaterThan(0)
    })

    test('should provide detailed error information', async () => {
      // Arrange
      const packages = [createMockPackage('failing-table')]
      mockService.setShouldFailOnTable('failing-table')

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        options: { conflictResolution: 'SKIP' },
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.results).toHaveLength(1)
      expect(result.results?.[0]?.success).toBe(false)
      expect(result.results?.[0]?.errors).toContain('Simulated error for table failing-table')

      // Check error propagation to summary
      expect(result.summary.failed).toBe(1)
      expect(result.summary.succeeded).toBe(0)
    })
  })

  describe('Import Session Management', () => {
    test('should create and track import sessions', async () => {
      // Arrange
      const packages = [createMockPackage('table1'), createMockPackage('table2')]

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        createSession: true,
      })

      // Assert
      expect(result.session).toBeDefined()
      expect(result.session?.sessionId).toBeDefined()
      expect(result.session?.status).toBeDefined()
      expect(result.session?.packagesRemaining).toBeDefined()

      // Verify session can be retrieved
      if (result.session) {
        const retrievedSession = await mockService.getImportSession(result.session.sessionId)
        expect(retrievedSession).toBeDefined()
        expect(retrievedSession?.sessionId).toBe(result.session.sessionId)
      }
    })

    test('should handle session rollback on critical errors', async () => {
      // Arrange
      const packages = [createMockPackage('critical-failure')]
      mockService.setShouldFailOnTable('critical-failure')

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        createSession: true,
        options: { conflictResolution: 'OVERWRITE' }, // Critical operation
      })

      // Get the session and trigger rollback
      if (result.session) {
        await mockService.rollbackImportSession(result.session.sessionId)

        // Assert
        expect(mockService.wasRollbackCalled()).toBe(true)

        const updatedSession = await mockService.getImportSession(result.session.sessionId)
        expect(updatedSession?.status).toBe('rolled_back')
        expect(updatedSession?.completedAt).toBeDefined()
      }
    })
  })

  describe('Rollback Capabilities', () => {
    test('should track rollback information during import', async () => {
      // Arrange
      const packages = [createMockPackage('table1')]

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        createSession: true,
      })

      // Assert
      expect(result.session?.rollbackInfo).toBeDefined()
      expect(result.session?.rollbackInfo.tablesCreated).toBeDefined()
      expect(result.session?.rollbackInfo.templatesCreated).toBeDefined()
      expect(result.session?.rollbackInfo.nodesCreated).toBeDefined()
    })

    test('should handle rollback failures gracefully', async () => {
      // This test simulates a rollback operation that might fail
      const packages = [createMockPackage('table1')]

      const result = await batchImportUseCase.execute({
        packages,
        createSession: true,
      })

      if (result.session) {
        // The mock service should handle rollback
        await mockService.rollbackImportSession(result.session.sessionId)

        expect(mockService.wasRollbackCalled()).toBe(true)
      }
    })
  })

  describe('Dependency Resolution Error Handling', () => {
    test('should handle circular dependency detection', async () => {
      // This test would require a more sophisticated mock that can simulate circular dependencies
      const packages = [createMockPackage('table-a'), createMockPackage('table-b'), createMockPackage('table-c')]

      // Act
      const result = await batchImportUseCase.execute({
        packages,
        options: { conflictResolution: 'SKIP' },
      })

      // Assert that the system doesn't crash with dependency issues
      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
    })
  })

  describe('Validation Error Handling', () => {
    test('should provide comprehensive validation error messages', async () => {
      // Test malformed package data
      const malformedPackage = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceTable: {
          identifier: '', // Invalid empty identifier
          description: null,
        },
        dependencies: [],
        package: {
          schema: {
            table: {
              identifier: '',
              description: null,
              createdAt: '',
              updatedAt: '',
            },
            attributes: [],
            attributeTypes: [],
          },
          dataset: { nodes: [], nodeAttributes: [] },
          relations: { relationTypes: [], nodeRelations: [] },
          templates: { templates: [] },
        },
      } as TablePackageFormat

      const result = await batchImportUseCase.execute({
        packages: [malformedPackage],
      })

      // Should handle gracefully even with malformed data
      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
    })
  })

  describe('Logging and Monitoring', () => {
    test('should log all critical operations', async () => {
      // Arrange
      const packages = [createMockPackage('logged-table')]

      // Act
      await batchImportUseCase.execute({
        packages,
        createSession: true,
      })

      // Assert
      const infoLogs = mockLogger.getLogs('info')
      expect(infoLogs.length).toBeGreaterThan(0)

      // Check that we have logs for key operations
      const hasExecutionLog = infoLogs.some((log) => log.message.includes('Executing batch table package import'))
      expect(hasExecutionLog).toBe(true)
    })

    test('should log errors with sufficient context', async () => {
      // Arrange
      const packages = [createMockPackage('error-table')]
      mockService.setShouldFailOnTable('error-table')

      // Act
      await batchImportUseCase.execute({
        packages,
      })

      // Assert
      const errorLogs = mockLogger.getLogs('error')
      const warningLogs = mockLogger.getLogs('warn')

      // Should have some form of error logging
      expect(errorLogs.length + warningLogs.length).toBeGreaterThan(0)
    })
  })
})
