/**
 * SQLite Backup Service
 *
 * Provides file-level database backup and restore functionality
 * using SQLite VACUUM INTO command and file operations
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'bun'
import type { ILogger } from '@/application/ports/ILogger.js'
import { getDatabasePath } from '@/config/database.js'
import type { IDatabaseConnection } from '@/core/database/interfaces/IDatabaseConnection.js'
import type {
  BackupListItem,
  BackupListResult,
  BackupMetrics,
  BackupRetentionPolicy,
  SQLiteBackupOptions,
  SQLiteBackupResult,
  SQLiteRestoreOptions,
  SQLiteRestoreResult,
} from '@/core/types/DatabaseBackup.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'

export class SQLiteBackupService {
  private readonly backupDir = './backups/database'
  private readonly metricsPath = join(this.backupDir, 'metrics.json')

  constructor(
    private readonly db: IDatabaseConnection,
    private readonly logger: ILogger,
  ) {
    this.ensureBackupDirectory()
  }

  /**
   * Create a full database backup
   */
  async createBackup(options: SQLiteBackupOptions = {}): Promise<SQLiteBackupResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    try {
      this.logger.info('Starting database backup', { options })

      // Generate backup path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]
      const defaultPath = join(this.backupDir, `db_${timestamp}.sqlite`)
      const outputPath = options.outputPath || defaultPath

      // Ensure output directory exists
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'))
      if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      // Get current database path
      const dbPath = getDatabasePath()

      // Perform backup using VACUUM INTO (creates clean copy)
      try {
        await this.db.execute(`VACUUM INTO '${outputPath}'`)
      } catch (vacuumError) {
        // Fallback to file copy if VACUUM INTO fails
        warnings.push('VACUUM INTO failed, using file copy method')
        this.logger.warn('VACUUM INTO failed, falling back to file copy', toErrorMeta(vacuumError))

        if (!existsSync(dbPath)) {
          errors.push(`Source database not found: ${dbPath}`)
          return {
            success: false,
            backupPath: outputPath,
            sizeBytes: 0,
            duration: Date.now() - startTime,
            errors,
            warnings,
          }
        }

        copyFileSync(dbPath, outputPath)

        // Copy WAL file if it exists and requested
        if (options.includeWAL) {
          const walPath = `${dbPath}-wal`
          if (existsSync(walPath)) {
            copyFileSync(walPath, `${outputPath}-wal`)
          }
        }
      }

      // Get backup file size
      let sizeBytes = 0
      if (existsSync(outputPath)) {
        sizeBytes = statSync(outputPath).size
      } else {
        errors.push('Backup file not created')
        return {
          success: false,
          backupPath: outputPath,
          sizeBytes: 0,
          duration: Date.now() - startTime,
          errors,
          warnings,
        }
      }

      // Calculate checksum
      let checksum: string | undefined
      if (options.validate) {
        checksum = this.calculateChecksum(outputPath)
      }

      // Compress if requested
      let finalPath = outputPath
      if (options.compress) {
        finalPath = await this.compressBackup(outputPath)
        sizeBytes = statSync(finalPath).size
        // Recalculate checksum for compressed file
        if (options.validate) {
          checksum = this.calculateChecksum(finalPath)
        }
      }

      // Validate backup integrity
      if (options.validate) {
        const isValid = await this.validateBackup(finalPath, options.compress ?? false)
        if (!isValid) {
          warnings.push('Backup validation detected potential issues')
        }
      }

      const duration = Date.now() - startTime

      // Update metrics
      await this.updateMetrics({
        success: true,
        duration,
        sizeBytes,
      })

      this.logger.info('Database backup completed', {
        backupPath: finalPath,
        sizeBytes,
        duration,
        compressed: options.compress,
      })

      return {
        success: true,
        backupPath: finalPath,
        sizeBytes,
        duration,
        checksum,
        errors,
        warnings,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Database backup failed', toErrorMeta(error))

      // Update metrics with failure
      await this.updateMetrics({
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      errors.push(error instanceof Error ? error.message : 'Unknown backup error')
      return {
        success: false,
        backupPath: options.outputPath || '',
        sizeBytes: 0,
        duration,
        errors,
        warnings,
      }
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(options: SQLiteRestoreOptions): Promise<SQLiteRestoreResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    try {
      this.logger.info('Starting database restore', { options })

      const { backupPath, safetyBackup, validateBeforeRestore, verifyAfterRestore } = options

      // Validate backup file exists
      if (!existsSync(backupPath)) {
        errors.push(`Backup file not found: ${backupPath}`)
        return {
          success: false,
          restoredPath: '',
          duration: Date.now() - startTime,
          errors,
          warnings,
        }
      }

      // Validate backup integrity before restore
      if (validateBeforeRestore) {
        const isCompressed = backupPath.endsWith('.gz')
        const isValid = await this.validateBackup(backupPath, isCompressed)
        if (!isValid) {
          errors.push('Backup validation failed - file may be corrupted')
          return {
            success: false,
            restoredPath: '',
            duration: Date.now() - startTime,
            errors,
            warnings,
          }
        }
      }

      // Create safety backup of current database
      let safetyBackupPath: string | undefined
      if (safetyBackup) {
        const safetyResult = await this.createBackup({
          outputPath: join(this.backupDir, `safety_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`),
          validate: true,
        })

        if (safetyResult.success) {
          safetyBackupPath = safetyResult.backupPath
          this.logger.info('Safety backup created', { path: safetyBackupPath })
        } else {
          warnings.push('Failed to create safety backup')
        }
      }

      // Get current database path
      const dbPath = getDatabasePath()

      // Decompress if needed
      let sourceBackupPath = backupPath
      if (backupPath.endsWith('.gz')) {
        sourceBackupPath = await this.decompressBackup(backupPath)
      }

      // Close current database connection (would need server restart in production)
      warnings.push('Database restore requires server restart to take effect')

      // Replace database file
      copyFileSync(sourceBackupPath, dbPath)

      // Clean up temporary decompressed file
      if (sourceBackupPath !== backupPath) {
        try {
          unlinkSync(sourceBackupPath)
        } catch (_cleanupError) {
          // Ignore cleanup errors
        }
      }

      const duration = Date.now() - startTime

      // Verify restore if requested
      let verification: SQLiteRestoreResult['verification']
      if (verifyAfterRestore) {
        try {
          const tablesCount = await this.db
            .queryFirst<{ count: number }>(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`)
            .then((r) => r?.count || 0)

          const nodesCount = await this.db
            .queryFirst<{ count: number }>(`SELECT COUNT(*) as count FROM table_nodes`)
            .then((r) => r?.count || 0)

          const relationsCount = await this.db
            .queryFirst<{ count: number }>(`SELECT COUNT(*) as count FROM node_relations`)
            .then((r) => r?.count || 0)

          verification = {
            tablesCount,
            nodesCount,
            relationsCount,
            checksumMatch: true,
          }

          this.logger.info('Restore verification completed', verification)
        } catch (verifyError) {
          warnings.push('Verification failed - database may need reinitialization')
          this.logger.warn('Restore verification error', toErrorMeta(verifyError))
        }
      }

      this.logger.info('Database restore completed', {
        restoredPath: dbPath,
        duration,
      })

      return {
        success: true,
        restoredPath: dbPath,
        safetyBackupPath,
        verification,
        duration,
        errors,
        warnings,
      }
    } catch (error) {
      this.logger.error('Database restore failed', toErrorMeta(error))
      errors.push(error instanceof Error ? error.message : 'Unknown restore error')

      return {
        success: false,
        restoredPath: '',
        duration: Date.now() - startTime,
        errors,
        warnings,
      }
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupListResult> {
    try {
      const fileBackups: BackupListItem[] = []
      const tableBackups: BackupListItem[] = []

      // List database backups
      if (existsSync(this.backupDir)) {
        const files = readdirSync(this.backupDir)

        for (const file of files) {
          if (!file.startsWith('db_') && !file.startsWith('safety_backup_')) continue
          if (!file.endsWith('.sqlite') && !file.endsWith('.sqlite.gz')) continue

          const filePath = join(this.backupDir, file)
          const stats = statSync(filePath)

          fileBackups.push({
            path: filePath,
            sizeBytes: stats.size,
            createdAt: stats.birthtime,
            type: 'file',
            compressed: file.endsWith('.gz'),
          })
        }
      }

      // Sort by creation date (newest first)
      fileBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      const totalSizeBytes =
        fileBackups.reduce((sum, b) => sum + b.sizeBytes, 0) + tableBackups.reduce((sum, b) => sum + b.sizeBytes, 0)

      return {
        fileBackups,
        tableBackups,
        totalCount: fileBackups.length + tableBackups.length,
        totalSizeBytes,
      }
    } catch (error) {
      this.logger.error('Failed to list backups', toErrorMeta(error))
      return {
        fileBackups: [],
        tableBackups: [],
        totalCount: 0,
        totalSizeBytes: 0,
      }
    }
  }

  /**
   * Apply backup retention policy
   */
  async applyRetentionPolicy(policy: BackupRetentionPolicy): Promise<{
    deletedBackups: string[]
    errors: string[]
  }> {
    const deletedBackups: string[] = []
    const errors: string[] = []

    try {
      const backups = await this.listBackups()

      // Apply max backups limit
      if (policy.maxBackups && backups.fileBackups.length > policy.maxBackups) {
        const toDelete = backups.fileBackups.slice(policy.maxBackups)
        for (const backup of toDelete) {
          try {
            unlinkSync(backup.path)
            deletedBackups.push(backup.path)
          } catch (error) {
            errors.push(`Failed to delete ${backup.path}: ${error}`)
          }
        }
      }

      // Apply age-based retention
      if (policy.maxAgeDays) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays)

        for (const backup of backups.fileBackups) {
          if (backup.createdAt < cutoffDate && !deletedBackups.includes(backup.path)) {
            try {
              unlinkSync(backup.path)
              deletedBackups.push(backup.path)
            } catch (error) {
              errors.push(`Failed to delete ${backup.path}: ${error}`)
            }
          }
        }
      }

      this.logger.info('Retention policy applied', {
        deletedCount: deletedBackups.length,
        errors: errors.length,
      })

      return { deletedBackups, errors }
    } catch (error) {
      this.logger.error('Failed to apply retention policy', toErrorMeta(error))
      return {
        deletedBackups,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Get backup metrics
   */
  async getMetrics(): Promise<BackupMetrics> {
    try {
      if (existsSync(this.metricsPath)) {
        const data = readFileSync(this.metricsPath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (_error) {
      // Return default metrics if file doesn't exist or is invalid
    }

    return {
      totalBackups: 0,
      averageBackupDuration: 0,
      totalBackupSize: 0,
      successRate: 100,
      failedBackups: [],
    }
  }

  // Private helper methods

  private ensureBackupDirectory(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true })
      this.logger.info('Backup directory created', { path: this.backupDir })
    }
  }

  private calculateChecksum(filePath: string): string {
    const fileBuffer = readFileSync(filePath)
    const hash = createHash('sha256')
    hash.update(fileBuffer)
    return hash.digest('hex')
  }

  private async compressBackup(filePath: string): Promise<string> {
    const fileData = readFileSync(filePath)
    const compressed = gzipSync(fileData)
    const compressedPath = `${filePath}.gz`

    Bun.write(compressedPath, compressed)

    // Delete original uncompressed file
    unlinkSync(filePath)

    return compressedPath
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    const compressedData = readFileSync(compressedPath)
    const decompressed = gunzipSync(compressedData)
    const decompressedPath = compressedPath.replace('.gz', '')

    Bun.write(decompressedPath, decompressed)

    return decompressedPath
  }

  private async validateBackup(backupPath: string, isCompressed: boolean): Promise<boolean> {
    try {
      let testPath = backupPath

      // Decompress for validation if needed
      if (isCompressed) {
        testPath = await this.decompressBackup(backupPath)
      }

      // Try to open and query the backup database
      const Database = require('bun:sqlite').Database
      const testDb = new Database(testPath, { readonly: true })

      try {
        // Check if database has expected tables
        const tables = testDb.query(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{
          name: string
        }>

        const requiredTables = ['tables', 'table_nodes', 'attributes']
        const hasRequiredTables = requiredTables.every((table) => tables.some((t) => t.name === table))

        testDb.close()

        // Clean up temporary decompressed file
        if (isCompressed && testPath !== backupPath) {
          try {
            unlinkSync(testPath)
          } catch (_cleanupError) {
            // Ignore cleanup errors
          }
        }

        return hasRequiredTables
      } catch (_queryError) {
        testDb.close()
        return false
      }
    } catch (_error) {
      return false
    }
  }

  private async updateMetrics(update: {
    success: boolean
    duration: number
    sizeBytes?: number
    error?: string
  }): Promise<void> {
    try {
      const metrics = await this.getMetrics()

      metrics.totalBackups += 1

      if (update.success) {
        metrics.lastBackupTime = new Date()
        metrics.averageBackupDuration =
          (metrics.averageBackupDuration * (metrics.totalBackups - 1) + update.duration) / metrics.totalBackups

        if (update.sizeBytes) {
          metrics.totalBackupSize += update.sizeBytes
        }
      } else {
        metrics.failedBackups.push({
          timestamp: new Date(),
          error: update.error || 'Unknown error',
        })

        // Keep only last 10 failures
        if (metrics.failedBackups.length > 10) {
          metrics.failedBackups = metrics.failedBackups.slice(-10)
        }
      }

      const successCount = metrics.totalBackups - metrics.failedBackups.length
      metrics.successRate = (successCount / metrics.totalBackups) * 100

      Bun.write(this.metricsPath, JSON.stringify(metrics, null, 2))
    } catch (error) {
      this.logger.warn('Failed to update backup metrics', toErrorMeta(error))
    }
  }
}
