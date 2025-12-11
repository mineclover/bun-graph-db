/**
 * Auto Persistence Service
 *
 * Provides automatic backup and restore functionality:
 * - Server startup: Auto-restore from latest JSONL backup
 * - Server shutdown: Auto-backup to JSONL
 * - Write operations: Debounced auto-save after mutations
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ILogger } from '@/application/ports/ILogger.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import type { JsonlBackupService } from './JsonlBackupService.js'

export interface AutoPersistenceConfig {
  /** Enable auto-restore on startup (default: true) */
  autoRestoreOnStartup: boolean
  /** Enable auto-backup on shutdown (default: true) */
  autoBackupOnShutdown: boolean
  /** Enable auto-save after write operations (default: true) */
  autoSaveOnWrite: boolean
  /** Debounce delay for auto-save in ms (default: 5000) */
  autoSaveDebounceMs: number
  /** Backup directory for JSONL files */
  backupDir: string
}

const DEFAULT_CONFIG: AutoPersistenceConfig = {
  autoRestoreOnStartup: true,
  autoBackupOnShutdown: true,
  autoSaveOnWrite: true,
  autoSaveDebounceMs: 5000,
  backupDir: './backups/jsonl',
}

export class AutoPersistenceService {
  private config: AutoPersistenceConfig
  private saveTimeout: Timer | null = null
  private isDirty = false
  private lastSaveTime: Date | null = null
  private isShuttingDown = false

  constructor(
    private readonly jsonlBackupService: JsonlBackupService,
    private readonly logger: ILogger,
    config: Partial<AutoPersistenceConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize auto-persistence (call on server startup)
   * Returns true if restore was performed
   */
  async initialize(): Promise<{ restored: boolean; backupPath?: string; error?: string }> {
    if (!this.config.autoRestoreOnStartup) {
      this.logger.info('[AutoPersistence] Auto-restore disabled')
      return { restored: false }
    }

    try {
      const latestBackup = this.findLatestBackup()
      if (!latestBackup) {
        this.logger.info('[AutoPersistence] No previous backup found, starting fresh')
        return { restored: false }
      }

      this.logger.info(`[AutoPersistence] Found backup: ${latestBackup}`)

      // Perform restore
      const result = await this.jsonlBackupService.import({
        inputDir: latestBackup,
        conflictResolution: 'skip', // Don't overwrite existing data
        dryRun: false,
      })

      if (result.success) {
        this.logger.info('[AutoPersistence] Restore completed', {
          tablesImported: result.stats.tablesImported,
          nodesImported: result.stats.nodesImported,
          relationsImported: result.stats.relationsImported,
        })
        return { restored: true, backupPath: latestBackup }
      } else {
        this.logger.warn('[AutoPersistence] Restore had issues', { errors: result.errors })
        return { restored: false, error: result.errors.join(', ') }
      }
    } catch (error) {
      this.logger.error('[AutoPersistence] Restore failed', toErrorMeta(error))
      return { restored: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Shutdown handler (call on server shutdown)
   */
  async shutdown(): Promise<{ backed: boolean; backupPath?: string; error?: string }> {
    this.isShuttingDown = true

    // Cancel any pending auto-save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    if (!this.config.autoBackupOnShutdown) {
      this.logger.info('[AutoPersistence] Auto-backup on shutdown disabled')
      return { backed: false }
    }

    try {
      this.logger.info('[AutoPersistence] Performing shutdown backup...')

      const result = await this.jsonlBackupService.export({
        outputDir: this.config.backupDir,
        includeSchema: true,
        includeRelations: true,
      })

      if (result.success) {
        this.logger.info('[AutoPersistence] Shutdown backup completed', {
          outputDir: result.outputDir,
          tablesExported: result.stats.tablesExported,
          nodesExported: result.stats.nodesExported,
        })
        return { backed: true, backupPath: result.outputDir }
      } else {
        this.logger.warn('[AutoPersistence] Shutdown backup had issues', { errors: result.errors })
        return { backed: false, error: result.errors.join(', ') }
      }
    } catch (error) {
      this.logger.error('[AutoPersistence] Shutdown backup failed', toErrorMeta(error))
      return { backed: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Mark data as dirty (call after write operations)
   * Triggers debounced auto-save if enabled
   */
  markDirty(): void {
    if (!this.config.autoSaveOnWrite || this.isShuttingDown) {
      return
    }

    this.isDirty = true

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    // Set new debounced save
    this.saveTimeout = setTimeout(async () => {
      await this.performAutoSave()
    }, this.config.autoSaveDebounceMs)
  }

  /**
   * Force immediate save (bypass debounce)
   */
  async forceSave(): Promise<{ success: boolean; error?: string }> {
    // Cancel pending auto-save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    return this.performAutoSave()
  }

  /**
   * Get persistence status
   */
  getStatus(): {
    isDirty: boolean
    lastSaveTime: Date | null
    config: AutoPersistenceConfig
    pendingSave: boolean
  } {
    return {
      isDirty: this.isDirty,
      lastSaveTime: this.lastSaveTime,
      config: this.config,
      pendingSave: this.saveTimeout !== null,
    }
  }

  // ===== Private Methods =====

  private async performAutoSave(): Promise<{ success: boolean; error?: string }> {
    if (!this.isDirty) {
      return { success: true }
    }

    try {
      this.logger.debug('[AutoPersistence] Performing auto-save...')

      const result = await this.jsonlBackupService.export({
        outputDir: this.config.backupDir,
        includeSchema: true,
        includeRelations: true,
      })

      if (result.success) {
        this.isDirty = false
        this.lastSaveTime = new Date()
        this.logger.debug('[AutoPersistence] Auto-save completed', {
          nodesExported: result.stats.nodesExported,
        })
        return { success: true }
      } else {
        this.logger.warn('[AutoPersistence] Auto-save had issues', { errors: result.errors })
        return { success: false, error: result.errors.join(', ') }
      }
    } catch (error) {
      this.logger.error('[AutoPersistence] Auto-save failed', toErrorMeta(error))
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private findLatestBackup(): string | null {
    const backupDir = this.config.backupDir

    if (!existsSync(backupDir)) {
      return null
    }

    // Check if current directory has manifest.json
    const manifestPath = join(backupDir, 'manifest.json')
    if (existsSync(manifestPath)) {
      return backupDir
    }

    // Look for dated subdirectories
    try {
      const entries = readdirSync(backupDir)
      const directories = entries
        .map((name) => join(backupDir, name))
        .filter((path) => {
          try {
            return statSync(path).isDirectory() && existsSync(join(path, 'manifest.json'))
          } catch {
            return false
          }
        })
        .sort((a, b) => {
          try {
            return statSync(b).mtime.getTime() - statSync(a).mtime.getTime()
          } catch {
            return 0
          }
        })

      return directories[0] || null
    } catch {
      return null
    }
  }
}
