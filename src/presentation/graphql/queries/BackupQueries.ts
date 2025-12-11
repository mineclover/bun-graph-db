/**
 * Backup & Restore GraphQL Queries
 *
 * Handles backup listing and metrics queries
 */

import type { GraphQLResolveInfo } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SQLiteBackupService } from '@/domain/services/SQLiteBackupService.js'

export interface BackupQueriesContext {
  backupService: SQLiteBackupService
  logger: ILogger
}

interface BackupListFilterInput {
  type?: 'FILE' | 'TABLE' | 'ALL'
  createdAfter?: string
  createdBefore?: string
}

export class BackupQueries {
  /**
   * List all available backups
   */
  static async listBackups(
    _parent: unknown,
    args: { filter?: BackupListFilterInput },
    context: BackupQueriesContext,
    _info: GraphQLResolveInfo,
  ) {
    const { backupService, logger } = context

    try {
      logger.info('[GraphQL] listBackups query called', { filter: args.filter })

      const result = await backupService.listBackups()

      // Apply filters if provided
      if (args.filter) {
        const { type, createdAfter, createdBefore } = args.filter

        if (type && type !== 'ALL') {
          if (type === 'FILE') {
            result.tableBackups = []
          } else if (type === 'TABLE') {
            result.fileBackups = []
          }
        }

        if (createdAfter) {
          const afterDate = new Date(createdAfter)
          result.fileBackups = result.fileBackups.filter((b) => b.createdAt >= afterDate)
          result.tableBackups = result.tableBackups.filter((b) => b.createdAt >= afterDate)
        }

        if (createdBefore) {
          const beforeDate = new Date(createdBefore)
          result.fileBackups = result.fileBackups.filter((b) => b.createdAt <= beforeDate)
          result.tableBackups = result.tableBackups.filter((b) => b.createdAt <= beforeDate)
        }

        // Recalculate totals after filtering
        result.totalCount = result.fileBackups.length + result.tableBackups.length
        result.totalSizeBytes =
          result.fileBackups.reduce((sum, b) => sum + b.sizeBytes, 0) +
          result.tableBackups.reduce((sum, b) => sum + b.sizeBytes, 0)
      }

      logger.info('[GraphQL] listBackups completed', {
        fileBackupsCount: result.fileBackups.length,
        tableBackupsCount: result.tableBackups.length,
        totalCount: result.totalCount,
      })

      return result
    } catch (error) {
      logger.error('[GraphQL] listBackups failed', { error })
      throw error
    }
  }

  /**
   * Get backup metrics and statistics
   */
  static async backupMetrics(
    _parent: unknown,
    _args: unknown,
    context: BackupQueriesContext,
    _info: GraphQLResolveInfo,
  ) {
    const { backupService, logger } = context

    try {
      logger.info('[GraphQL] backupMetrics query called')

      const metrics = await backupService.getMetrics()

      logger.info('[GraphQL] backupMetrics completed', {
        totalBackups: metrics.totalBackups,
        successRate: metrics.successRate,
      })

      return metrics
    } catch (error) {
      logger.error('[GraphQL] backupMetrics failed', { error })
      throw error
    }
  }
}
