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
import { Database } from 'bun:sqlite'
import type { ILogger } from '@/application/ports/ILogger.js'
import { getDatabasePath } from '@/config/database.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import type { JsonlBackupService } from './JsonlBackupService.js'

export interface AutoPersistenceConfig {
  /** Enable auto-restore on startup (default: true) */
  autoRestoreOnStartup: boolean
  /** Enable auto-backup on shutdown (default: true) */
  autoBackupOnShutdown: boolean
  /** Enable full JSONL auto-save after write operations (default: false) */
  autoSaveOnWrite: boolean
  /** Debounce delay for auto-save in ms (default: 30000) */
  autoSaveDebounceMs: number
  /** Backup directory for JSONL files */
  backupDir: string
}

const DEFAULT_CONFIG: AutoPersistenceConfig = {
  autoRestoreOnStartup: true,
  autoBackupOnShutdown: true,
  // SQLite is already durable. Full JSONL snapshots are intentionally opt-in
  // because their cost grows with the entire database, not the changed rows.
  autoSaveOnWrite: false,
  autoSaveDebounceMs: 30000,
  backupDir: './backups/jsonl',
}

export class AutoPersistenceService {
  private config: AutoPersistenceConfig
  private saveTimeout: Timer | null = null
  private isDirty = false
  private dirtyGeneration = 0
  private persistedGeneration = 0
  private savePromise: Promise<{ success: boolean; error?: string }> | null = null
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
      if (this.hasExistingDatabaseContent()) {
        this.logger.info('[AutoPersistence] Existing database content detected, skipping startup restore')
        return { restored: false }
      }

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

    if (this.savePromise) {
      await this.savePromise
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
    this.dirtyGeneration++

    this.scheduleAutoSave()
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

    let result = await this.performAutoSave()
    while (result.success && this.isDirty && !this.isShuttingDown) {
      result = await this.performAutoSave()
    }
    return result
  }

  /**
   * Get persistence status
   */
  getStatus(): {
    isDirty: boolean
    lastSaveTime: Date | null
    config: AutoPersistenceConfig
    pendingSave: boolean
    saveInProgress: boolean
    dirtyGeneration: number
    persistedGeneration: number
  } {
    return {
      isDirty: this.isDirty,
      lastSaveTime: this.lastSaveTime,
      config: this.config,
      pendingSave: this.saveTimeout !== null,
      saveInProgress: this.savePromise !== null,
      dirtyGeneration: this.dirtyGeneration,
      persistedGeneration: this.persistedGeneration,
    }
  }

  // ===== Private Methods =====

  private async performAutoSave(): Promise<{ success: boolean; error?: string }> {
    if (!this.isDirty) {
      return { success: true }
    }

    if (this.savePromise) return this.savePromise

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    const generation = this.dirtyGeneration
    const savePromise = this.exportGeneration(generation)
    this.savePromise = savePromise
    try {
      return await savePromise
    } finally {
      if (this.savePromise === savePromise) this.savePromise = null
      if (this.isDirty && !this.isShuttingDown) this.scheduleAutoSave()
    }
  }

  private async exportGeneration(generation: number): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug('[AutoPersistence] Performing auto-save...')

      const result = await this.jsonlBackupService.export({
        outputDir: this.config.backupDir,
        includeSchema: true,
        includeRelations: true,
      })

      if (result.success) {
        this.persistedGeneration = Math.max(this.persistedGeneration, generation)
        this.isDirty = this.dirtyGeneration > generation
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

  private scheduleAutoSave(): void {
    if (!this.config.autoSaveOnWrite || this.isShuttingDown) return
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null
      void this.performAutoSave()
    }, this.config.autoSaveDebounceMs)
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

  private hasExistingDatabaseContent(): boolean {
    const dbPath = getDatabasePath()
    if (!existsSync(dbPath)) {
      return false
    }

    let db: Database | null = null

    try {
      db = new Database(dbPath)
      const tablesTable = db
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='tables'")
        .get()

      if (!tablesTable) {
        return false
      }

      const tableCount = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM tables').get()?.count ?? 0
      const nodeCount = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM nodes').get()?.count ?? 0

      return tableCount > 0 || nodeCount > 0
    } catch (error) {
      this.logger.debug('[AutoPersistence] Existing database content check failed; restore will continue', toErrorMeta(error))
      return false
    } finally {
      db?.close()
    }
  }
}
