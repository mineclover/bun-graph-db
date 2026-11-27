/**
 * JSONL Backup Service
 *
 * Provides GitHub-friendly JSONL backup/restore functionality
 * - Text-based format for git diff compatibility
 * - Per-table files for granular tracking
 * - Line-by-line format for streaming
 */

import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { NodeId, RelationTypeId } from '@/core/types/CommonTypes.js'
import type {
  JsonlAttributeEntry,
  JsonlBackupManifest,
  JsonlEmbeddingEntry,
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
import { Attribute } from '@/domain/entities/Attribute.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type {
  INodeEmbeddingRepository,
  UpsertNodeEmbeddingInput,
} from '@/domain/repositories/INodeEmbeddingRepository.js'
import type {
  INodeMutationRepository,
  NodeAttributeBatchWrite,
} from '@/domain/repositories/INodeMutationRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

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
    private readonly logger: ILogger,
    private readonly createNodeUseCase?: Pick<CreateNodeUseCase, 'execute'>,
    private readonly schemaGate?: NodeAttributeSchemaGate,
    private readonly nodeEmbeddingRepository?: INodeEmbeddingRepository,
    private readonly nodeMutationRepository?: INodeMutationRepository,
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
    let embeddingsExported: number | undefined
    let totalBytes = 0

    try {
      this.logger.info('Starting JSONL export', { outputDir, options })

      // Ensure output directory exists
      this.ensureDirectory(outputDir)
      this.ensureDirectory(join(outputDir, 'tables'))

      // Get tables to export
      const allTablesData = await this.collectAllPages((offset, limit) =>
        this.tableRepository.findAll({ limit, offset }),
      )
      const tablesToExport =
        options.tableIds || options.tableIdentifiers
          ? allTablesData.filter(
              (t) =>
                (options.tableIds ? options.tableIds.includes(t.id) : false) ||
                (options.tableIdentifiers
                  ? options.tableIdentifiers.includes(t.identifier)
                  : false),
            )
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
          errors.push(`Failed to export relations: ${error}`)
        }
      }

      // Export persistent node embeddings when explicitly requested
      if (options.includeEmbeddings === true) {
        if (!this.nodeEmbeddingRepository) {
          warnings.push('includeEmbeddings requested, but nodeEmbeddingRepository is not configured')
          embeddingsExported = 0
        } else {
          try {
            const embeddingsFile = await this.exportEmbeddings(outputDir, tablesToExport)
            files.push(embeddingsFile)
            totalBytes += embeddingsFile.sizeBytes
            embeddingsExported = embeddingsFile.lineCount
          } catch (error) {
            errors.push(`Failed to export embeddings: ${error}`)
          }
        }
      }

      // The manifest is the commit marker. Never replace a last-known-good
      // manifest for a partial snapshot.
      if (errors.length === 0) {
        const manifest = await this.writeManifest(outputDir, files, tablesToExport)
        totalBytes += manifest.sizeBytes
        files.push(manifest)
      }

      this.logger.info('JSONL export completed', {
        tablesExported,
        nodesExported,
        relationsExported,
        ...(embeddingsExported !== undefined ? { embeddingsExported } : {}),
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
          ...(embeddingsExported !== undefined ? { embeddingsExported } : {}),
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
          ...(embeddingsExported !== undefined ? { embeddingsExported } : {}),
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
    let embeddingsImported: number | undefined

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

      const manifest: JsonlBackupManifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

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
            ...(manifest.hasEmbeddings ? { embeddingsImported: 0 } : {}),
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
        ? manifest.tables.filter((t) => options.tableIdentifiers?.includes(t.identifier))
        : manifest.tables
      const nodeIdMap = new Map<string, string>()

      for (const tableInfo of tablesToImport) {
        try {
          const result = await this.importTableNodes(
            options.inputDir,
            tableInfo.identifier,
            options.conflictResolution,
            nodeIdMap,
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
          const relResult = await this.importRelations(
            options.inputDir,
            options.conflictResolution,
            nodeIdMap,
          )
          relationsImported = relResult.imported
          warnings.push(...relResult.warnings)
        } catch (error) {
          errors.push(`Failed to import relations: ${error}`)
        }
      }

      // Import embeddings when present in backup (unless explicitly disabled)
      const shouldImportEmbeddings =
        options.includeEmbeddings !== false &&
        (Boolean(manifest.hasEmbeddings) || options.includeEmbeddings === true)
      if (shouldImportEmbeddings) {
        try {
          const embResult = await this.importEmbeddings(
            options.inputDir,
            tablesToImport.map((t) => t.identifier),
            options.conflictResolution,
            nodeIdMap,
          )
          embeddingsImported = embResult.imported
          warnings.push(...embResult.warnings)
        } catch (error) {
          errors.push(`Failed to import embeddings: ${error}`)
        }
      }

      this.logger.info('JSONL import completed', {
        tablesImported,
        nodesImported,
        nodesSkipped,
        nodesUpdated,
        relationsImported,
        ...(embeddingsImported !== undefined ? { embeddingsImported } : {}),
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
          ...(embeddingsImported !== undefined ? { embeddingsImported } : {}),
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
        stats: {
          tablesImported,
          nodesImported,
          nodesSkipped,
          nodesUpdated,
          relationsImported,
          ...(embeddingsImported !== undefined ? { embeddingsImported } : {}),
        },
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
    }>,
  ): Promise<JsonlExportedFile> {
    const schemaPath = join(outputDir, 'schema.jsonl')
    const lines: string[] = []

    for (const table of tables) {
      const attributes = await this.collectAllPages((offset, limit) =>
        this.attributeRepository.findByTableId(table.id, { limit, offset }),
      )
      const attributeTypeIds = [...new Set(attributes.map((attribute) => attribute.getAttributeTypeId()))]
      const attributeTypes = await this.attributeTypeRepository.findByIds(attributeTypeIds)
      const attributeTypesById = new Map(attributeTypes.map((attributeType) => [attributeType.getId(), attributeType]))

      const attributeEntries: JsonlAttributeEntry[] = attributes.map((attr) => {
        const attrType = attributeTypesById.get(attr.getAttributeTypeId())
        return {
          id: attr.getId(),
          identifier: attr.getIdentifier(),
          name: attr.getName(),
          attributeTypeId: attr.getAttributeTypeId(),
          attributeType: attrType?.getIdentifier() || 'unknown',
          description: attr.getDescription() || undefined,
          isRequired: attr.getIsRequired(),
        }
      })

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
    await this.writeFileAtomically(schemaPath, content)

    return {
      path: schemaPath,
      type: 'schema',
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async exportTableNodes(
    outputDir: string,
    table: { id: string; identifier: string },
  ): Promise<JsonlExportedFile> {
    const tableDir = join(outputDir, 'tables')
    const filePath = join(tableDir, `${table.identifier}.jsonl`)
    const attributes = await this.collectAllPages((offset, limit) =>
      this.attributeRepository.findByTableId(table.id, { limit, offset }),
    )
    const attributeMap = new Map(attributes.map((attribute) => [attribute.getId(), attribute.getIdentifier()]))
    const temporaryPath = this.temporaryPath(filePath)
    const file = await open(temporaryPath, 'wx')
    let lineCount = 0
    let sizeBytes = 0
    let offset = 0
    let cursor: { createdAt: string; id: string } | undefined
    const pageSize = 500
    const useKeyset = typeof this.nodeRepository.findByTableIdKeyset === 'function'
    let fileClosed = false
    let published = false

    try {
      while (true) {
        let nodes: Node[]
        if (useKeyset && this.nodeRepository.findByTableIdKeyset) {
          const page = await this.nodeRepository.findByTableIdKeyset(table.id, pageSize, cursor)
          nodes = page.nodes
          cursor = page.nextCursor ?? undefined
        } else {
          const page = await this.nodeRepository.findByTableId(table.id, { limit: pageSize, offset })
          nodes = page.data ?? page.nodes ?? page.items ?? []
          offset += nodes.length
        }
        if (nodes.length === 0) break

        const nodeAttributes = await this.nodeAttributeRepository.findByNodeIds(nodes.map((node) => node.getId()))
        const attributesByNodeId = new Map<string, typeof nodeAttributes>()
        for (const attribute of nodeAttributes) {
          const nodeId = attribute.getNodeId()
          const entries = attributesByNodeId.get(nodeId) ?? []
          entries.push(attribute)
          attributesByNodeId.set(nodeId, entries)
        }

        const lines = nodes.map((node) => {
          const nodeEntry: JsonlNodeEntry = {
            _id: node.getId(),
            _title: node.getTitle() || '',
            _content: node.getContent(),
            _createdAt: node.getCreatedAt().toISOString(),
            _updatedAt: node.getUpdatedAt().toISOString(),
          }
          for (const attribute of attributesByNodeId.get(node.getId()) ?? []) {
            const identifier = attributeMap.get(attribute.getAttributeId())
            if (identifier) nodeEntry[identifier] = attribute.getValue()
          }
          return JSON.stringify(nodeEntry)
        })
        const chunk = `${lineCount > 0 ? '\n' : ''}${lines.join('\n')}`
        await file.write(chunk)
        lineCount += lines.length
        sizeBytes += Buffer.byteLength(chunk, 'utf-8')
        if (nodes.length < pageSize || (useKeyset && !cursor)) break
      }
      await file.close()
      fileClosed = true
      await rename(temporaryPath, filePath)
      published = true
    } finally {
      if (!fileClosed) await file.close().catch(() => undefined)
      if (!published) await rm(temporaryPath, { force: true }).catch(() => undefined)
    }

    return {
      path: filePath,
      type: 'table',
      tableIdentifier: table.identifier,
      lineCount,
      sizeBytes,
    }
  }

  private async exportRelationTypes(outputDir: string): Promise<JsonlExportedFile> {
    const filePath = join(outputDir, 'relation-types.jsonl')
    const lines: string[] = []

    const relationTypes = await this.collectAllPages((offset, limit) =>
      this.relationTypeRepository.findAll({ limit, offset }),
    )

    for (const rt of relationTypes) {
      const entry: JsonlRelationTypeEntry = {
        id: rt.getId(),
        identifier: rt.getIdentifier(),
        description: rt.getDescription() || undefined,
        category: rt.getCategory() || undefined,
      }
      lines.push(JSON.stringify(entry))
    }

    const content = lines.join('\n')
    await this.writeFileAtomically(filePath, content)

    return {
      path: filePath,
      type: 'relation-types',
      lineCount: lines.length,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    }
  }

  private async exportRelations(outputDir: string): Promise<JsonlExportedFile> {
    const filePath = join(outputDir, 'relations.jsonl')
    const relationTypes = await this.collectAllPages((offset, limit) =>
      this.relationTypeRepository.findAll({ limit, offset }),
    )
    const relationTypesById = new Map(relationTypes.map((relationType) => [relationType.getId(), relationType.getIdentifier()]))
    const temporaryPath = this.temporaryPath(filePath)
    const file = await open(temporaryPath, 'wx')
    let lineCount = 0
    let sizeBytes = 0
    let offset = 0
    let cursor: { createdAt: string; id: string } | undefined
    const pageSize = 1000
    const useKeyset = typeof this.nodeRelationRepository.findAllKeyset === 'function'
    let fileClosed = false
    let published = false

    try {
      while (true) {
        let relations: NodeRelation[]
        if (useKeyset && this.nodeRelationRepository.findAllKeyset) {
          const page = await this.nodeRelationRepository.findAllKeyset(pageSize, cursor)
          relations = page.relations
          cursor = page.nextCursor ?? undefined
        } else {
          const page = await this.nodeRelationRepository.findAll({ limit: pageSize, offset })
          relations = page.data ?? page.nodes ?? page.items ?? []
          offset += relations.length
        }
        if (relations.length === 0) break
        const lines = relations.map((relation) => {
          const entry: JsonlRelationEntry = {
            id: relation.getId(),
            fromNodeId: relation.getSourceNodeId(),
            toNodeId: relation.getTargetNodeId(),
            relationTypeId: relation.getRelationTypeId(),
            relationType: relationTypesById.get(relation.getRelationTypeId()) || 'unknown',
            strength: relation.getStrength(),
            properties: relation.getProperties() || undefined,
            createdAt: relation.getCreatedAt().toISOString(),
          }
          return JSON.stringify(entry)
        })
        const chunk = `${lineCount > 0 ? '\n' : ''}${lines.join('\n')}`
        await file.write(chunk)
        lineCount += lines.length
        sizeBytes += Buffer.byteLength(chunk, 'utf-8')
        if (relations.length < pageSize || (useKeyset && !cursor)) break
      }
      await file.close()
      fileClosed = true
      await rename(temporaryPath, filePath)
      published = true
    } finally {
      if (!fileClosed) await file.close().catch(() => undefined)
      if (!published) await rm(temporaryPath, { force: true }).catch(() => undefined)
    }

    return {
      path: filePath,
      type: 'relations',
      lineCount,
      sizeBytes,
    }
  }

  private async exportEmbeddings(
    outputDir: string,
    tables: Array<{ id: string; identifier: string }>,
  ): Promise<JsonlExportedFile> {
    if (!this.nodeEmbeddingRepository) {
      throw new Error('nodeEmbeddingRepository is required to export embeddings')
    }

    const filePath = join(outputDir, 'embeddings.jsonl')
    const temporaryPath = this.temporaryPath(filePath)
    const file = await open(temporaryPath, 'wx')
    let lineCount = 0
    let sizeBytes = 0
    const pageSize = 500
    let fileClosed = false
    let published = false

    try {
      for (const table of tables) {
        if (typeof this.nodeEmbeddingRepository.findByTableId === 'function') {
          let offset = 0
          while (true) {
            const embeddings = await this.nodeEmbeddingRepository.findByTableId(
              table.id,
              { limit: pageSize, offset },
            )
            if (embeddings.length === 0) break

            const contentById = await this.loadNodeContentsByIds(
              embeddings.map((record) => record.nodeId),
            )
            const lines = embeddings.map((record) => {
              const entry: JsonlEmbeddingEntry = {
                nodeId: String(record.nodeId),
                tableIdentifier: table.identifier,
                nodeContent: contentById.get(String(record.nodeId)) ?? null,
                model: record.model,
                dimension: record.dimension,
                vector: record.vector,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              }
              return JSON.stringify(entry)
            })
            const chunk = `${lineCount > 0 ? '\n' : ''}${lines.join('\n')}`
            await file.write(chunk)
            lineCount += lines.length
            sizeBytes += Buffer.byteLength(chunk, 'utf-8')
            offset += embeddings.length
            if (embeddings.length < pageSize) break
          }
        } else {
          let offset = 0
          while (true) {
            const page = await this.nodeRepository.findByTableId(table.id, {
              limit: pageSize,
              offset,
            })
            const nodes = page.data ?? page.nodes ?? page.items ?? []
            if (nodes.length === 0) break

            const lines: string[] = []
            for (const node of nodes) {
              const record = await this.nodeEmbeddingRepository.findByNodeId(
                node.getId(),
              )
              if (!record) continue
              const entry: JsonlEmbeddingEntry = {
                nodeId: String(record.nodeId),
                tableIdentifier: table.identifier,
                nodeContent: node.getContent(),
                model: record.model,
                dimension: record.dimension,
                vector: record.vector,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              }
              lines.push(JSON.stringify(entry))
            }
            if (lines.length > 0) {
              const chunk = `${lineCount > 0 ? '\n' : ''}${lines.join('\n')}`
              await file.write(chunk)
              lineCount += lines.length
              sizeBytes += Buffer.byteLength(chunk, 'utf-8')
            }
            offset += nodes.length
            if (nodes.length < pageSize) break
          }
        }
      }
      await file.close()
      fileClosed = true
      await rename(temporaryPath, filePath)
      published = true
    } finally {
      if (!fileClosed) await file.close().catch(() => undefined)
      if (!published) await rm(temporaryPath, { force: true }).catch(() => undefined)
    }

    return {
      path: filePath,
      type: 'embeddings',
      lineCount,
      sizeBytes,
    }
  }

  private async writeManifest(
    outputDir: string,
    files: JsonlExportedFile[],
    _tables: Array<{ identifier: string }>,
  ): Promise<JsonlExportedFile> {
    const manifestPath = join(outputDir, 'manifest.json')

    const tableFiles = files.filter((f) => f.type === 'table')
    const hasEmbeddings = files.some((f) => f.type === 'embeddings')

    const manifest: JsonlBackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      source: 'bun-graph-db',
      tables: tableFiles.flatMap((f) => {
        if (!f.tableIdentifier) {
          return []
        }
        return [{
          identifier: f.tableIdentifier,
          nodeCount: f.lineCount,
          file: `tables/${f.tableIdentifier}.jsonl`,
        }]
      }),
      hasRelations: files.some((f) => f.type === 'relations'),
      hasSchema: files.some((f) => f.type === 'schema'),
      ...(hasEmbeddings ? { hasEmbeddings: true } : {}),
    }

    const content = JSON.stringify(manifest, null, 2)
    await this.writeFileAtomically(manifestPath, content)

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
    options: JsonlImportOptions,
  ): Promise<{ tablesCreated: number; warnings: string[] }> {
    const schemaPath = join(inputDir, 'schema.jsonl')
    const warnings: string[] = []
    let tablesCreated = 0

    if (!existsSync(schemaPath)) {
      warnings.push('schema.jsonl not found, skipping schema import')
      return { tablesCreated: 0, warnings }
    }

    const allowedIdentifiers = options.tableIdentifiers
      ? new Set(options.tableIdentifiers)
      : null
    const canPersistTables = typeof this.tableRepository.save === 'function'
    const canPersistAttributes =
      typeof this.attributeRepository.save === 'function' &&
      typeof this.attributeRepository.findByTableIdAndIdentifier === 'function' &&
      typeof this.attributeTypeRepository.findByIdentifier === 'function'

    for await (const entry of this.readJsonLines<JsonlSchemaEntry>(schemaPath)) {
      if (allowedIdentifiers && !allowedIdentifiers.has(entry.identifier)) {
        continue
      }

      let targetTable = await this.tableRepository.findByIdentifier(entry.identifier)
      if (targetTable) {
        warnings.push(`Table ${entry.identifier} already exists, skipping`)
      } else if (canPersistTables) {
        const saved = await this.tableRepository.save(
          Table.create(entry.identifier, entry.description),
        )
        targetTable =
          (await this.tableRepository.findByIdentifier(entry.identifier)) ??
          saved ??
          null
        tablesCreated++
      } else {
        tablesCreated++
        continue
      }

      if (targetTable && canPersistAttributes && Array.isArray(entry.attributes)) {
        let attributesCreated = false
        for (const attrEntry of entry.attributes) {
          const existingAttr = await this.attributeRepository.findByTableIdAndIdentifier(
            targetTable.id,
            attrEntry.identifier,
          )
          if (existingAttr) continue

          let attrType = await this.attributeTypeRepository.findByIdentifier(
            attrEntry.attributeType,
          )
          if (
            !attrType &&
            typeof this.attributeTypeRepository.save === 'function' &&
            attrEntry.attributeType &&
            attrEntry.attributeType !== 'unknown'
          ) {
            const primitiveTypes = new Set([
              'string',
              'number',
              'integer',
              'boolean',
              'array',
              'object',
            ])
            const inferredJsonType = primitiveTypes.has(attrEntry.attributeType)
              ? attrEntry.attributeType
              : 'string'
            await this.attributeTypeRepository.save(
              AttributeType.create(
                attrEntry.attributeType,
                inferredJsonType,
                undefined,
                attrEntry.description,
              ),
            )
            attrType = await this.attributeTypeRepository.findByIdentifier(
              attrEntry.attributeType,
            )
          }
          if (!attrType) {
            attrType = await this.attributeTypeRepository.findByIdentifier('string')
          }
          if (!attrType) {
            warnings.push(
              `Attribute type '${attrEntry.attributeType}' not available for '${entry.identifier}.${attrEntry.identifier}'`,
            )
            continue
          }

          await this.attributeRepository.save(
            Attribute.create(
              targetTable.id,
              attrEntry.identifier,
              attrType.getId(),
              attrEntry.name || attrEntry.identifier,
              attrEntry.description,
              attrEntry.isRequired,
            ),
          )
          attributesCreated = true
        }

        if (attributesCreated) {
          TableSchemaProjectionService.clearCache(targetTable.id)
        }
      }
    }

    return { tablesCreated, warnings }
  }

  private async importTableNodes(
    inputDir: string,
    tableIdentifier: string,
    conflictResolution: 'skip' | 'overwrite' | 'merge',
    nodeIdMap: Map<string, string>,
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

    const tableGateContext = this.schemaGate
      ? await this.schemaGate.prepareTableGate(table.id)
      : null
    const pendingAttributeWrites: NodeAttributeBatchWrite[] = []
    const flushBatchSize = 500

    const flushPendingAttributes = async (): Promise<void> => {
      if (
        pendingAttributeWrites.length === 0 ||
        !this.nodeMutationRepository?.upsertAttributesBatch
      ) {
        return
      }
      const batch = pendingAttributeWrites.splice(0, pendingAttributeWrites.length)
      await this.nodeMutationRepository.upsertAttributesBatch(batch)
    }

    for await (const entry of this.readJsonLines<JsonlNodeEntry>(filePath)) {
      const attributeEntries = Object.entries(entry).filter(([key]) => !key.startsWith('_'))
      const attributesRecord = Object.fromEntries(attributeEntries)

      // Check if node with same content exists
      const existingNode = await this.nodeRepository.findByTableIdAndContent(table.id, entry._content || '')

      if (existingNode) {
        if (entry._id) {
          nodeIdMap.set(String(entry._id), String(existingNode.getId()))
        }
        switch (conflictResolution) {
          case 'skip':
            skipped++
            continue
          case 'overwrite':
            await this.nodeRepository.update(existingNode.getId(), {
              title: entry._title,
              content: entry._content || undefined,
            })
            if (attributeEntries.length > 0 && this.schemaGate && tableGateContext) {
              const normalized = this.schemaGate.validateAndNormalizePatchWithContext(
                tableGateContext,
                attributeEntries.map(([identifier, value]) => ({
                  attributeIdOrIdentifier: identifier,
                  value,
                })),
              )
              if (this.nodeMutationRepository?.upsertAttributesBatch) {
                for (const item of normalized) {
                  pendingAttributeWrites.push({
                    nodeId: existingNode.getId(),
                    attributeId: item.attributeId,
                    value: item.canonicalValue,
                  })
                }
                if (pendingAttributeWrites.length >= flushBatchSize) {
                  await flushPendingAttributes()
                }
              } else {
                for (const item of normalized) {
                  await this.nodeAttributeRepository.setNodeAttribute(
                    existingNode.getId(),
                    item.attributeId,
                    item.canonicalValue,
                  )
                }
              }
            }
            updated++
            break
          case 'merge':
            if (attributeEntries.length > 0 && this.schemaGate && tableGateContext) {
              const normalized = this.schemaGate.validateAndNormalizePatchWithContext(
                tableGateContext,
                attributeEntries.map(([identifier, value]) => ({
                  attributeIdOrIdentifier: identifier,
                  value,
                })),
              )
              if (this.nodeMutationRepository?.upsertAttributesBatch) {
                for (const item of normalized) {
                  pendingAttributeWrites.push({
                    nodeId: existingNode.getId(),
                    attributeId: item.attributeId,
                    value: item.canonicalValue,
                  })
                }
                if (pendingAttributeWrites.length >= flushBatchSize) {
                  await flushPendingAttributes()
                }
              } else {
                for (const item of normalized) {
                  await this.nodeAttributeRepository.setNodeAttribute(
                    existingNode.getId(),
                    item.attributeId,
                    item.canonicalValue,
                  )
                }
              }
            }
            updated++
            break
        }
      } else {
        if (this.createNodeUseCase) {
          const created = await this.createNodeUseCase.execute({
            tableId: table.id,
            content: entry._content || '',
            title: entry._title || undefined,
            attributes: attributeEntries.length > 0 ? attributesRecord : undefined,
          })
          if (entry._id && created?.node?.id) {
            nodeIdMap.set(String(entry._id), String(created.node.id))
          }
        } else if (typeof this.nodeRepository.save === 'function') {
          await this.nodeRepository.save(
            Node.create(table.id, entry._content || '', entry._title || undefined),
          )
          const savedNode = await this.nodeRepository.findByTableIdAndContent(
            table.id,
            entry._content || '',
          )
          if (entry._id && savedNode) {
            nodeIdMap.set(String(entry._id), String(savedNode.getId()))
          }
        }
        imported++
      }
    }

    await flushPendingAttributes()

    return { imported, skipped, updated }
  }

  private async importRelations(
    inputDir: string,
    conflictResolution: 'skip' | 'overwrite' | 'merge',
    nodeIdMap: ReadonlyMap<string, string>,
  ): Promise<{ imported: number; warnings: string[] }> {
    const filePath = join(inputDir, 'relations.jsonl')
    const warnings: string[] = []
    let imported = 0

    if (!existsSync(filePath)) {
      return { imported: 0, warnings }
    }

    const canPersistRelations =
      typeof this.nodeRelationRepository.save === 'function' &&
      typeof this.nodeRelationRepository.findBySourceNodeId === 'function' &&
      typeof this.relationTypeRepository.findByIdentifier === 'function' &&
      typeof this.nodeRepository.findById === 'function'

    if (!canPersistRelations) {
      for await (const _entry of this.readJsonLines<JsonlRelationEntry>(filePath)) imported++
      return { imported, warnings }
    }

    const relationTypesPath = join(inputDir, 'relation-types.jsonl')
    if (
      existsSync(relationTypesPath) &&
      typeof this.relationTypeRepository.save === 'function'
    ) {
      for await (const rtEntry of this.readJsonLines<JsonlRelationTypeEntry>(
        relationTypesPath,
      )) {
        const existingRt = await this.relationTypeRepository.findByIdentifier(
          rtEntry.identifier,
        )
        if (!existingRt) {
          await this.relationTypeRepository.save(
            RelationType.create(
              rtEntry.identifier,
              rtEntry.description,
              rtEntry.category,
            ),
          )
        }
      }
    }

    const relationTypeIdByIdentifier = new Map<string, RelationTypeId>()

    for await (const entry of this.readJsonLines<JsonlRelationEntry>(filePath)) {
      const mappedSourceId = entry.fromNodeId
        ? (nodeIdMap.get(String(entry.fromNodeId)) ?? String(entry.fromNodeId))
        : null
      const mappedTargetId = entry.toNodeId
        ? (nodeIdMap.get(String(entry.toNodeId)) ?? String(entry.toNodeId))
        : null
      if (!mappedSourceId || !mappedTargetId) {
        warnings.push(`Skipping relation '${entry.id}' with missing endpoint node ID`)
        continue
      }

      const [sourceNode, targetNode] = await Promise.all([
        this.nodeRepository.findById(mappedSourceId as NodeId),
        this.nodeRepository.findById(mappedTargetId as NodeId),
      ])
      if (!sourceNode || !targetNode) {
        warnings.push(
          `Skipping relation '${entry.id}' (${entry.fromNodeId} -> ${entry.toNodeId}): endpoint node not imported`,
        )
        continue
      }

      let relationTypeId = relationTypeIdByIdentifier.get(entry.relationType)
      if (!relationTypeId) {
        let relationType = await this.relationTypeRepository.findByIdentifier(
          entry.relationType,
        )
        if (
          !relationType &&
          typeof this.relationTypeRepository.save === 'function' &&
          entry.relationType &&
          entry.relationType !== 'unknown'
        ) {
          await this.relationTypeRepository.save(
            RelationType.create(entry.relationType),
          )
          relationType = await this.relationTypeRepository.findByIdentifier(
            entry.relationType,
          )
        }
        if (!relationType) {
          warnings.push(
            `Relation type '${entry.relationType}' not found for relation '${entry.id}'`,
          )
          continue
        }
        relationTypeId = relationType.getId()
        relationTypeIdByIdentifier.set(entry.relationType, relationTypeId)
      }

      const existingOutgoing = await this.nodeRelationRepository.findBySourceNodeId(
        sourceNode.getId(),
      )
      const duplicate = existingOutgoing.find(
        (rel) =>
          String(rel.getTargetNodeId()) === String(targetNode.getId()) &&
          String(rel.getRelationTypeId()) === String(relationTypeId),
      )

      if (duplicate) {
        if (conflictResolution === 'skip') {
          continue
        }
        if (typeof this.nodeRelationRepository.delete === 'function') {
          await this.nodeRelationRepository.delete(duplicate.getId())
        }
      }

      await this.nodeRelationRepository.save(
        NodeRelation.create(
          sourceNode.getTableId(),
          sourceNode.getId(),
          'internal',
          targetNode.getId(),
          'internal',
          relationTypeId,
          (entry.properties as Record<string, SafeJsonValue> | undefined) ?? null,
          entry.strength,
        ),
      )
      imported++
    }

    return { imported, warnings }
  }

  private async importEmbeddings(
    inputDir: string,
    allowedTableIdentifiers: readonly string[],
    conflictResolution: 'skip' | 'overwrite' | 'merge',
    nodeIdMap: ReadonlyMap<string, string>,
  ): Promise<{ imported: number; warnings: string[] }> {
    const filePath = join(inputDir, 'embeddings.jsonl')
    const warnings: string[] = []
    if (!existsSync(filePath)) {
      return { imported: 0, warnings }
    }
    if (!this.nodeEmbeddingRepository) {
      warnings.push('embeddings.jsonl found, but nodeEmbeddingRepository is not configured')
      return { imported: 0, warnings }
    }

    const allowedSet =
      allowedTableIdentifiers.length > 0 ? new Set(allowedTableIdentifiers) : null
    const tablesByIdentifier = new Map<
      string,
      { id: string; identifier: string } | null
    >()
    const pendingBatch: UpsertNodeEmbeddingInput[] = []
    let imported = 0
    const batchSize = 500

    const flushBatch = async (): Promise<void> => {
      if (pendingBatch.length === 0 || !this.nodeEmbeddingRepository) return
      const chunk = pendingBatch.splice(0, pendingBatch.length)
      if (this.nodeEmbeddingRepository.upsertMany) {
        const saved = await this.nodeEmbeddingRepository.upsertMany(chunk)
        imported += saved.length
      } else {
        for (const item of chunk) {
          await this.nodeEmbeddingRepository.upsert(item)
          imported++
        }
      }
    }

    for await (const entry of this.readJsonLines<JsonlEmbeddingEntry>(filePath)) {
      if (allowedSet && !allowedSet.has(entry.tableIdentifier)) {
        continue
      }

      let table = tablesByIdentifier.get(entry.tableIdentifier)
      if (table === undefined) {
        const found = await this.tableRepository.findByIdentifier(entry.tableIdentifier)
        table = found ? { id: found.id, identifier: found.identifier } : null
        tablesByIdentifier.set(entry.tableIdentifier, table)
      }
      if (!table) {
        warnings.push(
          `Target table '${entry.tableIdentifier}' not found for embedding on node '${entry.nodeId}'`,
        )
        continue
      }

      let targetNode = null
      const mappedNodeId = entry.nodeId ? nodeIdMap.get(String(entry.nodeId)) : undefined
      if (mappedNodeId) {
        const byMappedId = await this.nodeRepository.findById(mappedNodeId as NodeId)
        if (byMappedId && String(byMappedId.getTableId()) === String(table.id)) {
          targetNode = byMappedId
        }
      }
      if (!targetNode && entry.nodeContent !== null) {
        targetNode = await this.nodeRepository.findByTableIdAndContent(
          table.id,
          entry.nodeContent,
        )
      }
      if (!targetNode && entry.nodeId) {
        const byId = await this.nodeRepository.findById(entry.nodeId as NodeId)
        if (byId && String(byId.getTableId()) === String(table.id)) {
          targetNode = byId
        }
      }
      if (!targetNode) {
        warnings.push(
          `Target node not found in table '${entry.tableIdentifier}' for embedding '${entry.nodeId}'`,
        )
        continue
      }

      if (conflictResolution === 'skip') {
        const existing = await this.nodeEmbeddingRepository.findByNodeId(
          targetNode.getId(),
        )
        if (existing) continue
      }

      pendingBatch.push({
        nodeId: targetNode.getId(),
        tableId: table.id,
        vector: entry.vector,
        model: entry.model,
      })

      if (pendingBatch.length >= batchSize) {
        await flushBatch()
      }
    }

    await flushBatch()
    return { imported, warnings }
  }

  private async loadNodeContentsByIds(
    nodeIds: readonly NodeId[],
  ): Promise<Map<string, string | null>> {
    const contentById = new Map<string, string | null>()
    if (nodeIds.length === 0) return contentById

    if (typeof this.nodeRepository.findByIds === 'function') {
      const nodes = await this.nodeRepository.findByIds([...nodeIds])
      for (const node of nodes) {
        contentById.set(String(node.getId()), node.getContent())
      }
      return contentById
    }

    for (const nodeId of nodeIds) {
      const node = await this.nodeRepository.findById(nodeId)
      if (node) {
        contentById.set(String(node.getId()), node.getContent())
      }
    }
    return contentById
  }

  // ===== Helper Methods =====

  private async collectAllPages<T>(
    loadPage: (offset: number, limit: number) => Promise<{
      data?: T[]
      nodes?: T[]
      items?: T[]
      total?: number
      totalCount?: number
    }>,
    pageSize = 500,
  ): Promise<T[]> {
    const collected: T[] = []
    let offset = 0

    while (true) {
      const page = await loadPage(offset, pageSize)
      const items = page.data ?? page.nodes ?? page.items ?? []
      if (items.length === 0) break
      collected.push(...items)
      offset += items.length
      const total = page.total ?? page.totalCount
      if (items.length < pageSize || (total !== undefined && offset >= total)) break
    }

    return collected
  }

  private async *readJsonLines<T>(filePath: string): AsyncGenerator<T> {
    const input = createReadStream(filePath, { encoding: 'utf-8' })
    const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
    try {
      for await (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as T
      }
    } finally {
      lines.close()
      input.destroy()
    }
  }

  private async writeFileAtomically(filePath: string, content: string): Promise<void> {
    const temporaryPath = this.temporaryPath(filePath)
    try {
      await writeFile(temporaryPath, content, { encoding: 'utf-8', flag: 'wx' })
      await rename(temporaryPath, filePath)
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }

  private temporaryPath(filePath: string): string {
    return `${filePath}.${process.pid}.${randomUUID()}.tmp`
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}
