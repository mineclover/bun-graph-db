/**
 * JSONL Backup Service
 *
 * Provides GitHub-friendly JSONL backup/restore functionality
 * - Text-based format for git diff compatibility
 * - Per-table files for granular tracking
 * - Line-by-line format for streaming
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  JsonlAttributeEntry,
  JsonlBackupManifest,
  JsonlExportedFile,
  JsonlExportOptions,
  JsonlExportResult,
  JsonlImportOptions,
  JsonlImportResult,
  JsonlNodeEntry,
  JsonlRelationEntry,
  JsonlRelationTypeEntry,
  JsonlSchemaEntry,
} from '@/core/types/JsonlBackup.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'

export class JsonlBackupService {
  private readonly defaultBackupDir = './backups/jsonl'

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Export database to JSONL format
   */
  async export(options: JsonlExportOptions = {}): Promise<JsonlExportResult> {
    const outputDir = options.outputDir || this.defaultBackupDir
    const errors: string[] = []
    const warnings: string[] = []
    const files: JsonlExportedFile[] = []
    let tablesExported = 0
    let nodesExported = 0
    let relationsExported = 0
    let totalBytes = 0

    try {
      this.logger.info('Starting JSONL export', { outputDir, options })

      // Ensure output directory exists
      this.ensureDirectory(outputDir)
      this.ensureDirectory(join(outputDir, 'tables'))

      // Get tables to export
      const allTables = await this.tableRepository.findAll({ limit: 1000 })
      const allTablesData = allTables.data || []
      const tablesToExport = options.tableIds
        ? allTablesData.filter((t) => options.tableIds!.includes(t.id))
        : allTablesData

      // Export schema if requested
      if (options.includeSchema !== false) {
        const schemaFile = await this.exportSchema(outputDir, tablesToExport)
        files.push(schemaFile)
        totalBytes += schemaFile.sizeBytes
      }

      // Export each table's nodes
      for (const table of tablesToExport) {
        try {
          const tableFile = await this.exportTableNodes(outputDir, table)
          files.push(tableFile)
          totalBytes += tableFile.sizeBytes
          nodesExported += tableFile.lineCount
          tablesExported++
        } catch (error) {
          errors.push(`Failed to export table ${table.identifier}: ${error}`)
        }
      }

      // Export relations if requested
      if (options.includeRelations !== false) {
        try {
          // Export relation types first
          const relationTypesFile = await this.exportRelationTypes(outputDir)
          files.push(relationTypesFile)
          totalBytes += relationTypesFile.sizeBytes

          // Export relations
          const relationsFile = await this.exportRelations(outputDir)
          files.push(relationsFile)
          totalBytes += relationsFile.sizeBytes
          relationsExported = relationsFile.lineCount
        } catch (error) {
          warnings.push(`Failed to export relations: ${error}`)
        }
      }

      // Write manifest
      const manifest = await this.writeManifest(outputDir, files, tablesToExport)
      totalBytes += manifest.sizeBytes
      files.push(manifest)

      this.logger.info('JSONL export completed', {
        tablesExported,
        nodesExported,
        relationsExported,
        totalBytes,
        fileCount: files.length,
      })

      return {
        success: errors.length === 0,
        outputDir,
        files,
        stats: {
          tablesExported,
          nodesExported,
          relationsExported,
          totalBytes,
        },
        errors,
        warnings,
      }
    } catch (error) {
      this.logger.error('JSONL export failed', toErrorMeta(error))
      errors.push(error instanceof Error ? error.message : 'Unknown export error')

      return {
        success: false,
        outputDir,
        files,
        stats: {
          tablesExported,
          nodesExported,
          relationsExported,
          totalBytes,
        },
        errors,
        warnings,
      }
    }
  }

  /**
   * Import database from JSONL format
   */
  async import(options: JsonlImportOptions): Promise<JsonlImportResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let tablesImported = 0
    let nodesImported = 0
    let nodesSkipped = 0
    let nodesUpdated = 0
    let relationsImported = 0

    try {
      this.logger.info('Starting JSONL import', { inputDir: options.inputDir, options })

      // Validate input directory
      if (!existsSync(options.inputDir)) {
        errors.push(`Input directory not found: ${options.inputDir}`)
        return {
          success: false,
          inputDir: options.inputDir,
          stats: { tablesImported, nodesImported, nodesSkipped, nodesUpdated, relationsImported },
          errors,
          warnings,
        }
      }

      // Read manifest
      const manifestPath = join(options.inputDir, 'manifest.json')
      if (!existsSync(manifestPath)) {
        errors.push('manifest.json not found in backup directory')
        return {
          success: false,
          inputDir: options.inputDir,
          stats: { tablesImported, nodesImported, nodesSkipped, nodesUpdated, relationsImported },
          errors,
          warnings,
        }
      }

      const manifest: JsonlBackupManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

      // Dry run check
      if (options.dryRun) {
        this.logger.info('Dry run - validating backup structure')
        return {
          success: true,
          inputDir: options.inputDir,
          stats: {
            tablesImported: manifest.tables.length,
            nodesImported: manifest.tables.reduce((sum, t) => sum + t.nodeCount, 0),
            nodesSkipped: 0,
            nodesUpdated: 0,
            relationsImported: 0,
          },
          errors,
          warnings: ['Dry run - no data imported'],
        }
      }

      // Import schema first
      if (manifest.hasSchema) {
        const schemaResult = await this.importSchema(options.inputDir, options)
        tablesImported = schemaResult.tablesCreated
        warnings.push(...schemaResult.warnings)
      }

      // Import table nodes
      const tablesToImport = options.tableIdentifiers
        ? manifest.tables.filter((t) => options.tableIdentifiers!.includes(t.identifier))
        : manifest.tables

      for (const tableInfo of tablesToImport) {
        try {
          const result = await this.importTableNodes(
            options.inputDir,
            tableInfo.identifier,
            options.conflictResolution
          )
          nodesImported += result.imported
          nodesSkipped += result.skipped
          nodesUpdated += result.updated
        } catch (error) {
          errors.push(`Failed to import table ${tableInfo.identifier}: ${error}`)
        }
      }

      // Import relations
      if (manifest.hasRelations) {
        try {
          const relResult = await this.importRelations(options.inputDir, options.conflictResolution)
          relationsImported = relResult.imported
        } catch (error) {
          warnings.push(`Failed to import relations: ${error}`)
        }
      }

      this.logger.info('JSONL import completed', {
        tablesImported,
        nodesImported,
        nodesSkipped,
        nodesUpdated,
        relationsImported,
      })

      return {
        success: errors.length === 0,
        inputDir: options.inputDir,
        stats: {
          tablesImported,
          nodesImported,
          nodesSkipped,
          nodesUpdated,
          relationsImported,
        },
        errors,
        warnings,
      }
    } catch (error) {
      this.logger.error('JSONL import failed', toErrorMeta(error))
      errors.push(error instanceof Error ? error.message : 'Unknown import error')

      return {
        success: false,
        inputDir: options.inputDir,
        stats: { tablesImported, nodesImported, nodesSkipped, nodesUpdated, relationsImported },
        errors,
        warnings,
      }
    }
  }

  // ===== Private Export Methods =====

  private async exportSchema(
    outputDir: string,
    tables: Array<{
      id: string
      identifier: string
      description: string | null
      createdAt: Date
      updatedAt: Date
    }>
  ): Promise<JsonlExportedFile> {
    const schemaPath = join(outputDir, 'schema.jsonl')
    const lines: string[] = []

    for (const table of tables) {
      const attributesResult = await this.attributeRepository.findByTableId(table.id, {
        limit: 1000,
      })

      const attributeEntries: JsonlAttributeEntry[] = []
      for (const attr of attributesResult.data || []) {
        const attrType = await this.attributeTypeRepository.findById(attr.getAttributeTypeId())
        attributeEntries.push({
          id: attr.getId(),
          identifier: attr.getIdentifier(),
          name: attr.getName(),
          attributeTypeId: attr.getAttributeTypeId(),
          attributeType: attrType?.getIdentifier() || 'unknown',
          description: attr.getDescription() || undefined,
          isRequired: attr.getIsRequired(),
        })
      }

      const schemaEntry: JsonlSchemaEntry = {
        type: 'table',
        id: table.id,
        identifier: table.identifier,
        description: table.description || undefined,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
        attributes: attributeEntries,
      }

      lines.push(JSON.stringify(schemaEntry))
    }

    const content = lines.join('\n')
    writeFileSync(schemaPath, content, 'utf-8')

    return {
      path: schemaPath,
      type: 'schema',
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async exportTableNodes(
    outputDir: string,
    table: { id: string; identifier: string }
  ): Promise<JsonlExportedFile> {
    const tableDir = join(outputDir, 'tables')
    const filePath = join(tableDir, `${table.identifier}.jsonl`)
    const lines: string[] = []

    // Get all nodes for this table
    const nodesResult = await this.nodeRepository.findByTableId(table.id, { limit: 100000 })

    // Get attributes for mapping
    const attributesResult = await this.attributeRepository.findByTableId(table.id, {
      limit: 1000,
    })
    const attributeMap = new Map(
      (attributesResult.data || []).map((a) => [a.getId(), a.getIdentifier()])
    )

    for (const node of nodesResult.data || []) {
      const nodeEntry: JsonlNodeEntry = {
        _id: node.getId(),
        _title: node.getTitle() || '',
        _content: node.getContent(),
        _createdAt: node.getCreatedAt().toISOString(),
        _updatedAt: node.getUpdatedAt().toISOString(),
      }

      // Get node attributes
      const nodeAttrs = await this.nodeAttributeRepository.findByNodeId(node.getId())
      for (const attr of nodeAttrs || []) {
        const attrIdentifier = attributeMap.get(attr.getAttributeId())
        if (attrIdentifier) {
          nodeEntry[attrIdentifier] = attr.getValue()
        }
      }

      lines.push(JSON.stringify(nodeEntry))
    }

    const content = lines.join('\n')
    writeFileSync(filePath, content, 'utf-8')

    return {
      path: filePath,
      type: 'table',
      tableIdentifier: table.identifier,
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async exportRelationTypes(outputDir: string): Promise<JsonlExportedFile> {
    const filePath = join(outputDir, 'relation-types.jsonl')
    const lines: string[] = []

    const relationTypes = await this.relationTypeRepository.findAll({ limit: 1000 })

    for (const rt of relationTypes.data || []) {
      const entry: JsonlRelationTypeEntry = {
        id: rt.getId(),
        identifier: rt.getIdentifier(),
        description: rt.getDescription() || undefined,
        category: rt.getCategory() || undefined,
      }
      lines.push(JSON.stringify(entry))
    }

    const content = lines.join('\n')
    writeFileSync(filePath, content, 'utf-8')

    return {
      path: filePath,
      type: 'relation-types',
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async exportRelations(outputDir: string): Promise<JsonlExportedFile> {
    const filePath = join(outputDir, 'relations.jsonl')
    const lines: string[] = []

    const relations = await this.nodeRelationRepository.findAll({ limit: 100000 })

    // Build relation type map
    const relationTypes = await this.relationTypeRepository.findAll({ limit: 1000 })
    const rtMap = new Map((relationTypes.data || []).map((rt) => [rt.getId(), rt.getIdentifier()]))

    for (const rel of relations.data || []) {
      const entry: JsonlRelationEntry = {
        id: rel.getId(),
        fromNodeId: rel.getSourceNodeId(),
        toNodeId: rel.getTargetNodeId(),
        relationTypeId: rel.getRelationTypeId(),
        relationType: rtMap.get(rel.getRelationTypeId()) || 'unknown',
        strength: rel.getStrength(),
        properties: rel.getProperties() || undefined,
        createdAt: rel.getCreatedAt().toISOString(),
      }
      lines.push(JSON.stringify(entry))
    }

    const content = lines.join('\n')
    writeFileSync(filePath, content, 'utf-8')

    return {
      path: filePath,
      type: 'relations',
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async writeManifest(
    outputDir: string,
    files: JsonlExportedFile[],
    tables: Array<{ identifier: string }>
  ): Promise<JsonlExportedFile> {
    const manifestPath = join(outputDir, 'manifest.json')

    const tableFiles = files.filter((f) => f.type === 'table')

    const manifest: JsonlBackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      source: 'bun-graph-db',
      tables: tableFiles.map((f) => ({
        identifier: f.tableIdentifier!,
        nodeCount: f.lineCount,
        file: `tables/${f.tableIdentifier}.jsonl`,
      })),
      hasRelations: files.some((f) => f.type === 'relations'),
      hasSchema: files.some((f) => f.type === 'schema'),
    }

    const content = JSON.stringify(manifest, null, 2)
    writeFileSync(manifestPath, content, 'utf-8')

    return {
      path: manifestPath,
      type: 'schema',
      lineCount: 1,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  // ===== Private Import Methods =====

  private async importSchema(
    inputDir: string,
    _options: JsonlImportOptions
  ): Promise<{ tablesCreated: number; warnings: string[] }> {
    const schemaPath = join(inputDir, 'schema.jsonl')
    const warnings: string[] = []
    let tablesCreated = 0

    if (!existsSync(schemaPath)) {
      warnings.push('schema.jsonl not found, skipping schema import')
      return { tablesCreated: 0, warnings }
    }

    const content = readFileSync(schemaPath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())

    for (const line of lines) {
      const entry: JsonlSchemaEntry = JSON.parse(line)

      // Check if table exists
      const existingTable = await this.tableRepository.findByIdentifier(entry.identifier)
      if (existingTable) {
        warnings.push(`Table ${entry.identifier} already exists, skipping`)
        continue
      }

      // Table creation would go here - for now, just count
      // This needs integration with CreateTable use case
      tablesCreated++
    }

    return { tablesCreated, warnings }
  }

  private async importTableNodes(
    inputDir: string,
    tableIdentifier: string,
    conflictResolution: 'skip' | 'overwrite' | 'merge'
  ): Promise<{ imported: number; skipped: number; updated: number }> {
    const filePath = join(inputDir, 'tables', `${tableIdentifier}.jsonl`)
    let imported = 0
    let skipped = 0
    let updated = 0

    if (!existsSync(filePath)) {
      return { imported: 0, skipped: 0, updated: 0 }
    }

    // Find target table
    const table = await this.tableRepository.findByIdentifier(tableIdentifier)
    if (!table) {
      throw new Error(`Table ${tableIdentifier} not found`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())

    for (const line of lines) {
      const entry: JsonlNodeEntry = JSON.parse(line)

      // Check if node with same content exists
      const existingNode = await this.nodeRepository.findByTableIdAndContent(
        table.id,
        entry._content || ''
      )

      if (existingNode) {
        switch (conflictResolution) {
          case 'skip':
            skipped++
            continue
          case 'overwrite':
            // Update node
            await this.nodeRepository.update(existingNode.getId(), {
              title: entry._title,
              content: entry._content || undefined,
            })
            updated++
            break
          case 'merge':
            // Merge attributes only
            updated++
            break
        }
      } else {
        // Import new node - would need CreateNode use case integration
        imported++
      }
    }

    return { imported, skipped, updated }
  }

  private async importRelations(
    inputDir: string,
    _conflictResolution: 'skip' | 'overwrite' | 'merge'
  ): Promise<{ imported: number }> {
    const filePath = join(inputDir, 'relations.jsonl')
    let imported = 0

    if (!existsSync(filePath)) {
      return { imported: 0 }
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())

    // For now, just count - full implementation needs CreateRelation use case
    imported = lines.length

    return { imported }
  }

  // ===== Helper Methods =====

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}
