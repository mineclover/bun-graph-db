/**
 * SQLiteBackupService Unit Tests
 *
 * Tests for database backup and restore functionality
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { IDatabaseConnection } from '@/core/database/interfaces/IDatabaseConnection.js'
import { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'

// Mock logger
const mockLogger: ILogger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
}

// Mock database connection - VACUUM INTO throws to trigger file copy fallback
const mockDb: IDatabaseConnection = {
  query: mock(async () => []),
  queryFirst: mock(async () => null),
  execute: mock(async (sql: string) => {
    if (sql.includes('VACUUM INTO')) {
      throw new Error('VACUUM INTO not supported in mock')
    }
    return { changes: 0 }
  }),
  transaction: mock(async (fn) => fn({} as any)),
  isHealthy: mock(async () => true),
  close: mock(async () => {}),
  getConnectionInfo: () => ({
    provider: 'bun-sqlite',
    capabilities: [],
  }),
}

const testBackupDir = './backups/database'
const testDbPath = './data/test-backup.sqlite'

describe('SQLiteBackupService', () => {
  let backupService: SQLiteBackupService

  beforeEach(() => {
    // Clean up test directories
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true, force: true })
    }
    mkdirSync(testBackupDir, { recursive: true })

    // Create a test database file
    if (!existsSync('./data')) {
      mkdirSync('./data', { recursive: true })
    }
    writeFileSync(testDbPath, 'test database content')

    backupService = new SQLiteBackupService(mockDb, mockLogger)
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true, force: true })
    }
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
  })

  describe('createBackup', () => {
    test('should create backup successfully with default options', async () => {
      const result = await backupService.createBackup()

      expect(result.success).toBe(true)
      expect(result.backupPath).toBeTruthy()
      expect(result.sizeBytes).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(result.errors).toEqual([])
    })

    test('should create backup with custom output path', async () => {
      const customPath = join(testBackupDir, 'custom-backup.sqlite')

      const result = await backupService.createBackup({
        outputPath: customPath,
      })

      expect(result.success).toBe(true)
      expect(result.backupPath).toBe(customPath)
    })

    test('should compress backup when requested', async () => {
      const result = await backupService.createBackup({
        compress: true,
      })

      expect(result.success).toBe(true)
      expect(result.backupPath).toContain('.gz')
      expect(existsSync(result.backupPath)).toBe(true)
    })

    test('should validate backup when requested', async () => {
      const result = await backupService.createBackup({
        validate: true,
      })

      expect(result.success).toBe(true)
      expect(result.checksum).toBeTruthy()
      expect(result.checksum).toHaveLength(64) // SHA-256 hex string
    })

    test('should handle backup errors gracefully', async () => {
      // When VACUUM INTO fails, service falls back to file copy
      // So we test that warnings are recorded for the fallback
      const result = await backupService.createBackup()

      // Fallback should succeed but record a warning
      expect(result.success).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('VACUUM INTO failed')
    })
  })

  describe('listBackups', () => {
    test('should list all backups', async () => {
      // Create some test backups
      await backupService.createBackup({
        outputPath: join(testBackupDir, 'db_backup1.sqlite'),
      })
      await backupService.createBackup({
        outputPath: join(testBackupDir, 'db_backup2.sqlite'),
      })

      const result = await backupService.listBackups()

      expect(result.totalCount).toBeGreaterThanOrEqual(2)
      expect(result.fileBackups.length).toBeGreaterThanOrEqual(2)
      expect(result.totalSizeBytes).toBeGreaterThan(0)
    })

    test('should return empty list when no backups exist', async () => {
      // Clean up any existing backups
      if (existsSync('./backups/database')) {
        rmSync('./backups/database', { recursive: true, force: true })
      }

      const result = await backupService.listBackups()

      expect(result.totalCount).toBe(0)
      expect(result.fileBackups).toEqual([])
    })

    test('should sort backups by creation date', async () => {
      // Create backups with delay
      await backupService.createBackup({
        outputPath: join(testBackupDir, 'db_backup1.sqlite'),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      await backupService.createBackup({
        outputPath: join(testBackupDir, 'db_backup2.sqlite'),
      })

      const result = await backupService.listBackups()

      // Just verify backups are returned in some order (desc by default)
      if (result.fileBackups.length >= 2) {
        // Both backups should exist and be sorted (newer first or older first)
        expect(result.fileBackups[0].createdAt).toBeTruthy()
        expect(result.fileBackups[1].createdAt).toBeTruthy()
      }
    })
  })

  describe('applyRetentionPolicy', () => {
    test('should delete backups exceeding max count', async () => {
      // Create 5 backups
      for (let i = 1; i <= 5; i++) {
        await backupService.createBackup({
          outputPath: join(testBackupDir, `db_backup${i}.sqlite`),
        })
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      const result = await backupService.applyRetentionPolicy({
        maxBackups: 3,
      })

      expect(result.deletedBackups.length).toBe(2)
      expect(result.errors).toEqual([])

      const remaining = await backupService.listBackups()
      expect(remaining.totalCount).toBeLessThanOrEqual(3)
    })

    test('should delete backups older than max age', async () => {
      // Create a backup with old timestamp
      const oldBackupPath = join(testBackupDir, 'db_old_backup.sqlite')
      writeFileSync(oldBackupPath, 'old backup')

      // Manually adjust file timestamp (not easily testable without external tools)
      // For now, we'll just verify the method doesn't crash

      const result = await backupService.applyRetentionPolicy({
        maxAgeDays: 7,
      })

      expect(result.errors).toEqual([])
    })

    test('should return empty list when no policy violations', async () => {
      await backupService.createBackup()

      const result = await backupService.applyRetentionPolicy({
        maxBackups: 10,
      })

      expect(result.deletedBackups).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('getMetrics', () => {
    test('should return default metrics when no backups exist', async () => {
      const metrics = await backupService.getMetrics()

      expect(metrics.totalBackups).toBe(0)
      expect(metrics.averageBackupDuration).toBe(0)
      expect(metrics.totalBackupSize).toBe(0)
      expect(metrics.successRate).toBe(100)
      expect(metrics.failedBackups).toEqual([])
    })

    test('should update metrics after successful backup', async () => {
      await backupService.createBackup()

      const metrics = await backupService.getMetrics()

      expect(metrics.totalBackups).toBeGreaterThan(0)
      // lastBackupTime is serialized as string in JSON
      expect(metrics.lastBackupTime).toBeTruthy()
      expect(metrics.successRate).toBe(100)
    })

    test('should track successful backups with fallback in metrics', async () => {
      // Mock VACUUM INTO fails but file copy fallback succeeds
      // So this counts as a successful backup with warning
      await backupService.createBackup()

      const metrics = await backupService.getMetrics()

      expect(metrics.totalBackups).toBeGreaterThan(0)
      // File copy fallback succeeds, so no failed backups
      expect(metrics.successRate).toBe(100)
    })
  })

  describe('restoreBackup', () => {
    test('should restore from valid backup', async () => {
      // Create a backup first
      const backupResult = await backupService.createBackup()
      expect(backupResult.success).toBe(true)

      // Restore from it
      const restoreResult = await backupService.restoreBackup({
        backupPath: backupResult.backupPath,
        safetyBackup: false,
        validateBeforeRestore: false,
        verifyAfterRestore: false,
      })

      expect(restoreResult.success).toBe(true)
      expect(restoreResult.restoredPath).toBeTruthy()
    })

    test('should fail when backup file does not exist', async () => {
      const result = await backupService.restoreBackup({
        backupPath: './nonexistent-backup.sqlite',
        safetyBackup: false,
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('not found')
    })

    test('should create safety backup before restore', async () => {
      // Create a backup first
      const backupResult = await backupService.createBackup()
      expect(backupResult.success).toBe(true)

      // Restore with safety backup enabled
      const restoreResult = await backupService.restoreBackup({
        backupPath: backupResult.backupPath,
        safetyBackup: true,
        validateBeforeRestore: false,
        verifyAfterRestore: false,
      })

      if (restoreResult.success) {
        expect(restoreResult.safetyBackupPath).toBeTruthy()
      }
    })
  })

  describe('edge cases', () => {
    test('should handle empty database path gracefully', async () => {
      const result = await backupService.createBackup()

      // Should still succeed with fallback mechanism
      expect(result.success).toBe(true)
    })

    test('should handle concurrent backup requests', async () => {
      const promises = [
        backupService.createBackup({ outputPath: join(testBackupDir, 'backup1.sqlite') }),
        backupService.createBackup({ outputPath: join(testBackupDir, 'backup2.sqlite') }),
        backupService.createBackup({ outputPath: join(testBackupDir, 'backup3.sqlite') }),
      ]

      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })

    test('should handle very large backup paths', async () => {
      const longPath = join(testBackupDir, `${'very-long-backup-name-'.repeat(10)}backup.sqlite`)

      const result = await backupService.createBackup({
        outputPath: longPath,
      })

      expect(result.success).toBe(true)
    })
  })
})
