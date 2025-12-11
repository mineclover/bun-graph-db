/**
 * Backup & Restore GraphQL Mutations
 *
 * Handles database backup and restore operations
 */

import type { GraphQLResolveInfo } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { BackupRetentionPolicy, SQLiteBackupOptions, SQLiteRestoreOptions } from '@/core/types/DatabaseBackup.js'
import type { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'

export interface BackupMutationsContext {
  backupService: SQLiteBackupService
  logger: ILogger
}

export class BackupMutations {
  /**
   * Create a full database backup
   */
  static async backupDatabase(
    _parent: unknown,
    args: { input?: SQLiteBackupOptions },
    context: BackupMutationsContext,
    _info: GraphQLResolveInfo,
  ) {
    const { backupService, logger } = context

    try {
      logger.info('[GraphQL] backupDatabase mutation called', { input: args.input })

      const result = await backupService.createBackup(args.input || {})

      logger.info('[GraphQL] backupDatabase completed', {
        success: result.success,
        backupPath: result.backupPath,
        sizeBytes: result.sizeBytes,
      })

      return result
    } catch (error) {
      logger.error('[GraphQL] backupDatabase failed', { error })
      throw error
    }
  }

  /**
   * Restore database from backup
   */
  static async restoreDatabase(
    _parent: unknown,
    args: { input: SQLiteRestoreOptions },
    context: BackupMutationsContext,
    _info: GraphQLResolveInfo,
  ) {
    const { backupService, logger } = context

    try {
      logger.info('[GraphQL] restoreDatabase mutation called', { input: args.input })

      const result = await backupService.restoreBackup(args.input)

      logger.info('[GraphQL] restoreDatabase completed', {
        success: result.success,
        restoredPath: result.restoredPath,
      })

      return result
    } catch (error) {
      logger.error('[GraphQL] restoreDatabase failed', { error })
      throw error
    }
  }

  /**
   * Apply backup retention policy
   */
  static async applyRetentionPolicy(
    _parent: unknown,
    args: { policy: BackupRetentionPolicy },
    context: BackupMutationsContext,
    _info: GraphQLResolveInfo,
  ) {
    const { backupService, logger } = context

    try {
      logger.info('[GraphQL] applyRetentionPolicy mutation called', { policy: args.policy })

      const result = await backupService.applyRetentionPolicy(args.policy)

      // Calculate space freed
      let spaceFreed = 0
      try {
        const fs = require('node:fs')
        for (const deletedPath of result.deletedBackups) {
          try {
            const stats = fs.statSync(deletedPath)
            spaceFreed += stats.size
          } catch (_error) {
            // File already deleted or inaccessible
          }
        }
      } catch (_error) {
        // Ignore errors in space calculation
      }

      logger.info('[GraphQL] applyRetentionPolicy completed', {
        deletedCount: result.deletedBackups.length,
        spaceFreed,
      })

      return {
        deletedBackups: result.deletedBackups,
        errors: result.errors,
        deletedCount: result.deletedBackups.length,
        spaceFreed,
      }
    } catch (error) {
      logger.error('[GraphQL] applyRetentionPolicy failed', { error })
      throw error
    }
  }
}
