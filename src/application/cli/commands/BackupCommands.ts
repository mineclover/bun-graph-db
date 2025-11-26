/**
 * CLI Commands for Database Backup & Restore System
 *
 * Provides command-line interface for:
 * - Full database backup operations
 * - Database restore from backups
 * - Backup listing and management
 * - Retention policy enforcement
 */

import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  BackupRetentionPolicy,
  SQLiteBackupOptions,
  SQLiteRestoreOptions,
} from '@/core/types/DatabaseBackup.js'
import type { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'

export class BackupCommands {
  constructor(
    private readonly backupService: SQLiteBackupService,
    private readonly logger: ILogger
  ) {}

  /**
   * Create a full database backup
   *
   * Usage: bun run db:backup [options]
   * Examples:
   *   bun run db:backup --compress --validate
   *   bun run db:backup --output ./backups/my-backup.sqlite
   */
  async backup(args: {
    outputPath?: string
    compress?: boolean
    validate?: boolean
    includeWAL?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting database backup...', {
        outputPath: args.outputPath,
        compress: args.compress,
        validate: args.validate,
      })

      console.log('📦 Creating database backup...')

      const options: SQLiteBackupOptions = {
        outputPath: args.outputPath,
        compress: args.compress ?? false,
        validate: args.validate ?? true,
        includeWAL: args.includeWAL ?? false,
      }

      const result = await this.backupService.createBackup(options)

      if (!result.success) {
        console.error('❌ Backup failed!')
        console.error('Errors:', result.errors)
        process.exit(1)
      }

      console.log('✅ Backup completed successfully!')
      console.log(`📁 Backup file: ${result.backupPath}`)
      console.log(`📊 Size: ${this.formatBytes(result.sizeBytes)}`)
      console.log(`⏱️  Duration: ${result.duration}ms`)

      if (result.checksum) {
        console.log(`🔐 Checksum: ${result.checksum.substring(0, 16)}...`)
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:')
        for (const warning of result.warnings) {
          console.log(`   - ${warning}`)
        }
      }

      console.log('\n💡 Tip: Use --compress to reduce backup size')
      console.log('💡 Tip: Use --validate to ensure backup integrity')
    } catch (error) {
      this.logger.error('Database backup command failed', toErrorMeta(error))
      console.error('❌ Backup failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Restore database from backup
   *
   * Usage: bun run db:restore <backupPath> [options]
   * Examples:
   *   bun run db:restore ./backups/db_2025-01-19.sqlite --safety-backup
   *   bun run db:restore ./backups/db_2025-01-19.sqlite.gz --verify
   */
  async restore(args: {
    backupPath: string
    safetyBackup?: boolean
    validateBeforeRestore?: boolean
    verifyAfterRestore?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🚀 Starting database restore...', {
        backupPath: args.backupPath,
        safetyBackup: args.safetyBackup,
      })

      console.log('⚠️  WARNING: This will replace the current database!')
      console.log(`📁 Restore from: ${args.backupPath}`)

      if (args.safetyBackup !== false) {
        console.log('🛡️  Creating safety backup of current database...')
      }

      const options: SQLiteRestoreOptions = {
        backupPath: args.backupPath,
        safetyBackup: args.safetyBackup ?? true,
        validateBeforeRestore: args.validateBeforeRestore ?? true,
        verifyAfterRestore: args.verifyAfterRestore ?? true,
      }

      const result = await this.backupService.restoreBackup(options)

      if (!result.success) {
        console.error('❌ Restore failed!')
        console.error('Errors:', result.errors)

        if (result.safetyBackupPath) {
          console.log(`\n🛡️  Safety backup preserved at: ${result.safetyBackupPath}`)
          console.log('💡 You can manually restore from the safety backup if needed')
        }

        process.exit(1)
      }

      console.log('✅ Restore completed successfully!')
      console.log(`📁 Restored to: ${result.restoredPath}`)
      console.log(`⏱️  Duration: ${result.duration}ms`)

      if (result.safetyBackupPath) {
        console.log(`\n🛡️  Safety backup created: ${result.safetyBackupPath}`)
      }

      if (result.verification) {
        console.log('\n🔍 Verification Results:')
        console.log(`   - Tables: ${result.verification.tablesCount}`)
        console.log(`   - Nodes: ${result.verification.nodesCount}`)
        console.log(`   - Relations: ${result.verification.relationsCount}`)
        console.log(
          `   - Checksum: ${result.verification.checksumMatch ? '✅ Match' : '❌ Mismatch'}`
        )
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:')
        for (const warning of result.warnings) {
          console.log(`   - ${warning}`)
        }
      }

      console.log('\n⚠️  IMPORTANT: Restart the server for changes to take effect')
    } catch (error) {
      this.logger.error('Database restore command failed', toErrorMeta(error))
      console.error('❌ Restore failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * List all available backups
   *
   * Usage: bun run db:list-backups [--type file|table|all]
   */
  async listBackups(args: { type?: 'file' | 'table' | 'all' }): Promise<void> {
    try {
      console.log('📋 Listing backups...\n')

      const result = await this.backupService.listBackups()

      const showFiles = !args.type || args.type === 'file' || args.type === 'all'
      const showTables = !args.type || args.type === 'table' || args.type === 'all'

      if (showFiles && result.fileBackups.length > 0) {
        console.log('📦 File-Level Backups:')
        console.log('─'.repeat(80))

        for (const backup of result.fileBackups) {
          const compressed = backup.compressed ? '🗜️ ' : '   '
          const size = this.formatBytes(backup.sizeBytes)
          const date = backup.createdAt.toLocaleString()

          console.log(`${compressed}${backup.path}`)
          console.log(`   Size: ${size} | Created: ${date}`)
          if (backup.checksum) {
            console.log(`   Checksum: ${backup.checksum.substring(0, 16)}...`)
          }
          console.log('')
        }
      } else if (showFiles) {
        console.log('📦 File-Level Backups: (none)')
        console.log('')
      }

      if (showTables && result.tableBackups.length > 0) {
        console.log('📊 Table-Level Backups:')
        console.log('─'.repeat(80))

        for (const backup of result.tableBackups) {
          const compressed = backup.compressed ? '🗜️ ' : '   '
          const size = this.formatBytes(backup.sizeBytes)
          const date = backup.createdAt.toLocaleString()

          console.log(`${compressed}${backup.path}`)
          console.log(`   Table: ${backup.tableIdentifier || 'unknown'}`)
          console.log(`   Nodes: ${backup.nodeCount || 0} | Size: ${size} | Created: ${date}`)
          console.log('')
        }
      } else if (showTables) {
        console.log('📊 Table-Level Backups: (none)')
        console.log('')
      }

      console.log('─'.repeat(80))
      console.log(`📈 Summary:`)
      console.log(`   Total Backups: ${result.totalCount}`)
      console.log(`   Total Size: ${this.formatBytes(result.totalSizeBytes)}`)
      console.log(`   File Backups: ${result.fileBackups.length}`)
      console.log(`   Table Backups: ${result.tableBackups.length}`)
    } catch (error) {
      this.logger.error('List backups command failed', toErrorMeta(error))
      console.error(
        '❌ Failed to list backups:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      process.exit(1)
    }
  }

  /**
   * Apply backup retention policy
   *
   * Usage: bun run db:cleanup [options]
   * Examples:
   *   bun run db:cleanup --max-backups 10
   *   bun run db:cleanup --max-age-days 30
   *   bun run db:cleanup --max-backups 5 --max-age-days 7
   */
  async cleanup(args: {
    maxBackups?: number
    maxAgeDays?: number
    minFreeSpaceBytes?: number
    dryRun?: boolean
  }): Promise<void> {
    try {
      this.logger.info('🧹 Applying backup retention policy...', {
        maxBackups: args.maxBackups,
        maxAgeDays: args.maxAgeDays,
        dryRun: args.dryRun,
      })

      if (args.dryRun) {
        console.log('🔍 DRY RUN MODE: No backups will be deleted\n')
      }

      console.log('🧹 Cleaning up old backups...')

      if (!args.maxBackups && !args.maxAgeDays && !args.minFreeSpaceBytes) {
        console.log('⚠️  No retention policy specified!')
        console.log('💡 Use --max-backups, --max-age-days, or --min-free-space-bytes')
        return
      }

      const policy: BackupRetentionPolicy = {
        maxBackups: args.maxBackups,
        maxAgeDays: args.maxAgeDays,
        minFreeSpaceBytes: args.minFreeSpaceBytes,
      }

      console.log('\n📋 Retention Policy:')
      if (args.maxBackups) {
        console.log(`   - Keep maximum ${args.maxBackups} backups`)
      }
      if (args.maxAgeDays) {
        console.log(`   - Delete backups older than ${args.maxAgeDays} days`)
      }
      if (args.minFreeSpaceBytes) {
        console.log(`   - Ensure ${this.formatBytes(args.minFreeSpaceBytes)} free space`)
      }

      if (args.dryRun) {
        console.log('\n✅ Dry run completed (no backups deleted)')
        return
      }

      const result = await this.backupService.applyRetentionPolicy(policy)

      if (result.deletedBackups.length === 0) {
        console.log('\n✅ No backups needed to be deleted')
      } else {
        console.log(`\n🗑️  Deleted ${result.deletedBackups.length} backup(s):`)
        for (const deletedPath of result.deletedBackups) {
          console.log(`   - ${deletedPath}`)
        }
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors during cleanup:')
        for (const error of result.errors) {
          console.log(`   - ${error}`)
        }
      }

      console.log('\n✅ Cleanup completed!')
    } catch (error) {
      this.logger.error('Backup cleanup command failed', toErrorMeta(error))
      console.error('❌ Cleanup failed:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Show backup metrics and statistics
   *
   * Usage: bun run db:stats
   */
  async stats(): Promise<void> {
    try {
      console.log('📊 Backup Statistics\n')

      const metrics = await this.backupService.getMetrics()

      console.log('📈 Overview:')
      console.log(`   Total Backups Created: ${metrics.totalBackups}`)
      console.log(`   Success Rate: ${metrics.successRate.toFixed(1)}%`)
      console.log(`   Total Backup Size: ${this.formatBytes(metrics.totalBackupSize)}`)
      console.log(`   Average Duration: ${metrics.averageBackupDuration.toFixed(0)}ms`)

      if (metrics.lastBackupTime) {
        console.log(`   Last Backup: ${metrics.lastBackupTime.toLocaleString()}`)
      } else {
        console.log('   Last Backup: Never')
      }

      if (metrics.failedBackups.length > 0) {
        console.log('\n❌ Recent Failures:')
        for (const failure of metrics.failedBackups) {
          console.log(`   - ${failure.timestamp.toLocaleString()}`)
          console.log(`     Error: ${failure.error}`)
          if (failure.tableIdentifier) {
            console.log(`     Table: ${failure.tableIdentifier}`)
          }
        }
      } else {
        console.log('\n✅ No recent failures')
      }

      console.log('\n💡 Tip: Run "bun run db:list-backups" to see all backups')
    } catch (error) {
      this.logger.error('Backup stats command failed', toErrorMeta(error))
      console.error('❌ Failed to get stats:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  }

  /**
   * Schedule automated backups (placeholder for future implementation)
   *
   * Usage: bun run db:schedule [--interval daily|weekly|hourly] [--time HH:MM]
   */
  async schedule(args: {
    interval?: 'hourly' | 'daily' | 'weekly'
    time?: string
    compress?: boolean
  }): Promise<void> {
    console.log('📅 Backup Scheduling')
    console.log('⚠️  This feature is not yet implemented')
    console.log('\n💡 For now, use cron or system scheduler:')
    console.log('   # Daily backup at 2 AM')
    console.log('   0 2 * * * cd /path/to/project && bun run db:backup --compress --validate')
    console.log('\n   # Weekly backup on Sundays')
    console.log('   0 3 * * 0 cd /path/to/project && bun run db:backup --compress --validate')
  }

  // Helper methods

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }
}
