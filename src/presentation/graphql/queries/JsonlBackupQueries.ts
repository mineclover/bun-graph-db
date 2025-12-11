/**
 * JSONL Backup GraphQL Queries
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { JsonlBackupManifest } from '@/core/types/JsonlBackup.js'
import type { JsonlBackupService } from '@/domain/services/JsonlBackupService.js'

export class JsonlBackupQueries {
  constructor(
    private readonly jsonlBackupService: JsonlBackupService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Inspect a JSONL backup without importing
   */
  async inspectJsonlBackup(_parent: unknown, args: { inputDir: string }) {
    try {
      this.logger.info('Inspecting JSONL backup', { inputDir: args.inputDir })

      const manifestPath = join(args.inputDir, 'manifest.json')

      if (!existsSync(manifestPath)) {
        this.logger.warn('Manifest not found', { manifestPath })
        return null
      }

      const manifest: JsonlBackupManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

      return {
        version: manifest.version,
        createdAt: new Date(manifest.createdAt),
        source: manifest.source,
        tables: manifest.tables.map((t) => ({
          identifier: t.identifier,
          nodeCount: t.nodeCount,
          file: t.file,
        })),
        hasRelations: manifest.hasRelations,
        hasSchema: manifest.hasSchema,
      }
    } catch (error) {
      this.logger.error('Failed to inspect JSONL backup', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Export database to JSONL format
   */
  async exportJsonl(
    _parent: unknown,
    args: {
      input?: {
        outputDir?: string
        tableIds?: string[]
        includeRelations?: boolean
        includeSchema?: boolean
        prettyPrint?: boolean
      }
    },
  ) {
    try {
      this.logger.info('Executing JSONL export', { input: args.input })

      const result = await this.jsonlBackupService.export({
        outputDir: args.input?.outputDir,
        tableIds: args.input?.tableIds,
        includeRelations: args.input?.includeRelations,
        includeSchema: args.input?.includeSchema,
        prettyPrint: args.input?.prettyPrint,
      })

      return {
        success: result.success,
        outputDir: result.outputDir,
        files: result.files.map((f) => ({
          path: f.path,
          type: this.mapFileType(f.type),
          tableIdentifier: f.tableIdentifier,
          lineCount: f.lineCount,
          sizeBytes: f.sizeBytes,
        })),
        stats: {
          tablesExported: result.stats.tablesExported,
          nodesExported: result.stats.nodesExported,
          relationsExported: result.stats.relationsExported,
          totalBytes: result.stats.totalBytes,
        },
        errors: result.errors,
        warnings: result.warnings,
      }
    } catch (error) {
      this.logger.error('JSONL export failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        success: false,
        outputDir: args.input?.outputDir || './backups/jsonl',
        files: [],
        stats: {
          tablesExported: 0,
          nodesExported: 0,
          relationsExported: 0,
          totalBytes: 0,
        },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }

  /**
   * Import database from JSONL format
   */
  async importJsonl(
    _parent: unknown,
    args: {
      input: {
        inputDir: string
        tableIdentifiers?: string[]
        conflictResolution: 'SKIP' | 'OVERWRITE' | 'MERGE'
        validateSchema?: boolean
        dryRun?: boolean
      }
    },
  ) {
    try {
      this.logger.info('Executing JSONL import', { input: args.input })

      const result = await this.jsonlBackupService.import({
        inputDir: args.input.inputDir,
        tableIdentifiers: args.input.tableIdentifiers,
        conflictResolution: args.input.conflictResolution.toLowerCase() as 'skip' | 'overwrite' | 'merge',
        validateSchema: args.input.validateSchema,
        dryRun: args.input.dryRun,
      })

      return {
        success: result.success,
        inputDir: result.inputDir,
        stats: {
          tablesImported: result.stats.tablesImported,
          nodesImported: result.stats.nodesImported,
          nodesSkipped: result.stats.nodesSkipped,
          nodesUpdated: result.stats.nodesUpdated,
          relationsImported: result.stats.relationsImported,
        },
        errors: result.errors,
        warnings: result.warnings,
      }
    } catch (error) {
      this.logger.error('JSONL import failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        success: false,
        inputDir: args.input.inputDir,
        stats: {
          tablesImported: 0,
          nodesImported: 0,
          nodesSkipped: 0,
          nodesUpdated: 0,
          relationsImported: 0,
        },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }

  private mapFileType(type: string): string {
    const mapping: Record<string, string> = {
      schema: 'SCHEMA',
      table: 'TABLE',
      relations: 'RELATIONS',
      'relation-types': 'RELATION_TYPES',
    }
    return mapping[type] || 'SCHEMA'
  }
}
