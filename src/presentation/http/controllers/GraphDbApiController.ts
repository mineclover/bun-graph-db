import type { TableSchemaLifecycleAspect } from '@/application/aspects/TableSchemaLifecycleAspect.js'
import type { HttpControllerRequest as Request, HttpControllerResponse as Response } from '../adapters/BunControllerAdapter.js'
import { fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
import type { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { ExportTemplateUseCase } from '@/application/use-cases/templates/ExportTemplateUseCase.js'
import { ImportTemplateUseCase } from '@/application/use-cases/templates/ImportTemplateUseCase.js'
import { BUN_GRAPH_DB_API_VERSION } from '@/core/contracts/RestRouteContract.js'
import type { NodeId, NodeRelationId, TableId } from '@/core/types/CommonTypes.js'
import type { TemplateExportFormat } from '@/core/types/TemplateExport.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { buildBunGraphDbOpenApiDocument } from '@/core/schema/BunGraphDbOpenApiDocument.js'
import { ConflictException } from '@/shared/exceptions/DomainException.js'
import type { ExportTemplateData, HealthCheckData, ImportTemplateData } from '../types/ApiResponseTypes.js'
import { sendHandleError, sendNotFound, sendSuccess, sendValidationError } from '../utils/responseHelpers.js'

export class GraphDbApiController {
  constructor(
    protected readonly logger: ILogger,
    private readonly createTableUseCase?: CreateTableUseCase,
    private readonly createNodeUseCase?: CreateNodeUseCase,
    private readonly updateNodeUseCase?: UpdateNodeUseCase,
    private readonly searchNodesUseCase?: SearchNodesUseCase,
    private readonly createRelationUseCase?: CreateRelationUseCase,
    private readonly tableRepository?: ITableRepository,
    private readonly relationTypeRepository?: IRelationTypeRepository,
    private readonly queryTemplateRepository?: IQueryTemplateRepository,
    private readonly executeTemplateWithGraphQLUseCase?: ExecuteTemplateWithGraphQLUseCase,
    private readonly nodeRepository?: INodeRepository,
    private readonly nodeAttributeRepository?: INodeAttributeRepository,
    private readonly attributeRepository?: IAttributeRepository,
    private readonly nodeRelationRepository?: INodeRelationRepository,
    private readonly schemaLifecycle?: TableSchemaLifecycleAspect,
  ) {}

  // System Operations
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const result: HealthCheckData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'Connected',
        version: BUN_GRAPH_DB_API_VERSION,
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Health check')
    }
  }

  async systemStats(_req: Request, res: Response): Promise<void> {
    try {
      const proc = typeof globalThis.process === 'object' && globalThis.process !== null ? globalThis.process : undefined
      const memoryUsage = typeof proc?.memoryUsage === 'function' ? proc.memoryUsage() : undefined
      const used = typeof memoryUsage?.heapUsed === 'number' ? memoryUsage.heapUsed : 0
      const total = typeof memoryUsage?.heapTotal === 'number' ? memoryUsage.heapTotal : 0
      const cpu =
        typeof proc?.cpuUsage === 'function' ? proc.cpuUsage() : { user: 0, system: 0 }

      const result = {
        memory: {
          used,
          total,
          percentage: total > 0 ? Math.round((used / total) * 100) : 0,
        },
        process: {
          pid: typeof proc?.pid === 'number' ? proc.pid : 0,
          cpu,
          platform: typeof proc?.platform === 'string' ? proc.platform : 'web',
        },
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'System stats')
    }
  }

  async getOpenApiDocument(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).type('application/json').json(buildBunGraphDbOpenApiDocument())
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get OpenAPI document')
    }
  }

  // Table Operations
  async createTable(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, description } = req.body

      if (!identifier) {
        sendValidationError(res, 'identifier is required')
        return
      }

      if (!this.createTableUseCase) {
        sendSuccess(res, {
          id: `table-${Date.now()}`,
          identifier,
          name: req.body.name || identifier,
          description: description || null,
        })
        return
      }

      const result = await this.createTableUseCase.execute({
        identifier,
        description,
      })

      sendSuccess(res, result.table)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create table')
    }
  }

  async searchTables(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = (req.query.searchTerm as string) || ''
      const limit = parseInt(req.query.limit as string, 10) || 10
      const offset = parseInt(req.query.offset as string, 10) || 0
      if (!this.tableRepository) {
        sendSuccess(res, {
          tables: [],
          total: 0,
          searchTerm,
          limit,
          offset,
          hasMore: false,
        })
        return
      }
      const tablesResult = await this.tableRepository.findAll({
        search: searchTerm,
        limit,
        offset,
        sortBy: 'createdAt',
        sortDirection: 'DESC',
      })

      const result = {
        tables: (tablesResult.data || []).map((table) => ({
          id: table.id,
          identifier: table.identifier,
          description: table.description,
          createdAt: table.createdAt.toISOString(),
          updatedAt: table.updatedAt.toISOString(),
        })),
        total: tablesResult.total,
        searchTerm,
        limit,
        offset,
        hasMore: tablesResult.hasMore,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search tables')
    }
  }

  async getTable(req: Request, res: Response): Promise<void> {
    try {
      const tableRef = req.params.tableId
      if (!tableRef) {
        sendValidationError(res, 'tableId is required')
        return
      }
      if (!this.tableRepository) {
        sendNotFound(res, `Table ${tableRef}`)
        return
      }

      const table =
        (await this.tableRepository.findById(tableRef as TableId)) ??
        (await this.tableRepository.findByIdentifier(tableRef))
      if (!table) {
        sendNotFound(res, `Table '${tableRef}'`)
        return
      }

      sendSuccess(res, {
        id: table.id,
        identifier: table.identifier,
        description: table.description,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table')
    }
  }

  async deleteTable(req: Request, res: Response): Promise<void> {
    try {
      const tableRef = req.params.tableId
      if (!tableRef) {
        sendValidationError(res, 'tableId is required')
        return
      }
      if (!this.tableRepository) {
        sendNotFound(res, `Table ${tableRef}`)
        return
      }

      const table =
        (await this.tableRepository.findById(tableRef as TableId)) ??
        (await this.tableRepository.findByIdentifier(tableRef))
      if (!table) {
        sendNotFound(res, `Table '${tableRef}'`)
        return
      }

      await this.tableRepository.delete(table.id)
      if (this.schemaLifecycle) {
        this.schemaLifecycle.onTableDeleted(table.id, table.identifier, 'deleteTable')
      } else {
        TableSchemaProjectionService.clearCache(table.id)
      }

      sendSuccess(res, {
        id: table.id,
        identifier: table.identifier,
        deleted: true,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Delete table')
    }
  }

  // Node Operations
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, content, title, description, metadata, attributes } = req.body

      if (!tableId || !content) {
        sendValidationError(res, 'tableId and content are required')
        return
      }

      if (!this.createNodeUseCase) {
        sendSuccess(res, {
          id: `node-${Date.now()}`,
          tableId,
          content,
          title: title || null,
          description: description || null,
          metadata: metadata || null,
        })
        return
      }

      const result = await this.createNodeUseCase.execute({
        tableId,
        content,
        title,
        description,
        ...(metadata !== undefined ? { metadata } : {}),
        attributes: this.normalizeAttributes(attributes),
      })

      sendSuccess(res, result.node)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create node')
    }
  }

  async getNode(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.params.nodeId
      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }
      if (!this.nodeRepository) {
        sendNotFound(res, `Node ${nodeId}`)
        return
      }

      const node = await this.nodeRepository.findById(nodeId as NodeId)
      if (!node) {
        sendNotFound(res, `Node '${nodeId}'`)
        return
      }

      let hydratedAttributes: Record<string, unknown> | undefined
      if (this.nodeAttributeRepository) {
        const nodeAttrs = await this.nodeAttributeRepository.findByNodeId(node.getId())
        const attrIdentifierById = new Map<string, string>()
        if (this.attributeRepository && nodeAttrs.length > 0) {
          const tableAttrs = await this.attributeRepository.findByTableId(node.getTableId(), {
            limit: 500,
            offset: 0,
          })
          for (const attr of tableAttrs.data ?? tableAttrs.nodes ?? []) {
            attrIdentifierById.set(String(attr.getId()), attr.getIdentifier())
          }
        }
        hydratedAttributes = {}
        for (const nodeAttr of nodeAttrs) {
          const attrId = String(nodeAttr.getAttributeId())
          const key = attrIdentifierById.get(attrId) ?? attrId
          hydratedAttributes[key] = nodeAttr.getParsedValue()
        }
      }

      sendSuccess(res, nodeFromEntity(node, hydratedAttributes))
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get node')
    }
  }

  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.params.nodeId
      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }
      if (!this.nodeRepository) {
        sendNotFound(res, `Node ${nodeId}`)
        return
      }

      const node = await this.nodeRepository.findById(nodeId as NodeId)
      if (!node) {
        sendNotFound(res, `Node '${nodeId}'`)
        return
      }

      await this.nodeRepository.delete(node.getId())
      sendSuccess(res, {
        id: String(node.getId()),
        tableId: String(node.getTableId()),
        deleted: true,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Delete node')
    }
  }

  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.params.nodeId || req.body.nodeId || req.body.id
      const { tableId, tableIdentifier, content, title, description, metadata, attributes } = req.body

      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }

      if (!this.updateNodeUseCase) {
        sendSuccess(res, {
          id: nodeId,
          tableId: tableId || null,
          content: content || null,
          title: title || null,
          description: description || null,
          metadata: metadata || null,
        })
        return
      }

      const result = await this.updateNodeUseCase.execute(nodeId, {
        tableId,
        tableIdentifier,
        content,
        title,
        description,
        metadata,
        attributes: this.normalizeAttributes(attributes),
      })

      sendSuccess(res, result.node)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Update node')
    }
  }

  async searchNodes(req: Request, res: Response): Promise<void> {
    try {
      const tableId = req.query.tableId as string
      const search = (req.query.search as string) || ''
      const limit = parseInt(req.query.limit as string, 10) || 10
      const offset = parseInt(req.query.offset as string, 10) || 0

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      if (!this.searchNodesUseCase) {
        sendSuccess(res, {
          nodes: [],
          total: 0,
          hasMore: false,
          tableId,
          query: search,
          limit,
          offset,
        })
        return
      }

      const result = await this.searchNodesUseCase.execute({
        tableId,
        query: search,
        limit,
        offset,
      })

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search nodes')
    }
  }

  // Relation Operations
  async createRelation(req: Request, res: Response): Promise<void> {
    try {
      const {
        fromNodeId,
        toNodeId,
        sourceNodeId,
        targetNodeId,
        relationshipType,
        relationType,
        relationTypeId,
        tableId,
        properties,
        strength,
        confidence,
      } = req.body

      const resolvedSourceNodeId = sourceNodeId ?? fromNodeId
      const resolvedTargetNodeId = targetNodeId ?? toNodeId
      const resolvedRelationTypeName = relationshipType ?? relationType

      if (
        !resolvedSourceNodeId ||
        !resolvedTargetNodeId ||
        !tableId ||
        (!resolvedRelationTypeName && !relationTypeId)
      ) {
        sendValidationError(
          res,
          'sourceNodeId (or fromNodeId), targetNodeId (or toNodeId), tableId, and relationType (or relationshipType / relationTypeId) are required',
        )
        return
      }

      const resolvedRelationType =
        relationTypeId ||
        (resolvedRelationTypeName && this.relationTypeRepository
          ? (await this.relationTypeRepository.findByIdentifier(resolvedRelationTypeName))?.getId()
          : undefined)

      if (!resolvedRelationType) {
        sendValidationError(res, 'A valid relationType, relationshipType, or relationTypeId is required')
        return
      }

      if (!this.createRelationUseCase) {
        const nowIso = new Date().toISOString()
        sendSuccess(res, {
          id: `relation-${Date.now()}`,
          fromNodeId: resolvedSourceNodeId,
          toNodeId: resolvedTargetNodeId,
          sourceNodeId: resolvedSourceNodeId,
          targetNodeId: resolvedTargetNodeId,
          tableId,
          relationTypeId: resolvedRelationType,
          relationshipType: resolvedRelationTypeName || relationTypeId,
          relationType: resolvedRelationTypeName || relationTypeId,
          properties: properties || null,
          strength: strength ?? null,
          confidence: confidence ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        return
      }

      const result = await this.createRelationUseCase.execute({
        tableId,
        sourceNodeId: resolvedSourceNodeId,
        targetNodeId: resolvedTargetNodeId,
        relationTypeId: resolvedRelationType,
        properties: properties || null,
        strength,
        confidence,
      })

      const relationName = resolvedRelationTypeName || relationTypeId
      sendSuccess(res, {
        id: result.relation.id,
        fromNodeId: result.relation.sourceNodeId,
        toNodeId: result.relation.targetNodeId,
        sourceNodeId: result.relation.sourceNodeId,
        targetNodeId: result.relation.targetNodeId,
        tableId: result.relation.tableId,
        relationTypeId: result.relation.relationTypeId,
        relationshipType: relationName,
        relationType: relationName,
        properties: result.relation.properties,
        strength: result.relation.strength,
        confidence: result.relation.confidence,
        createdAt: result.relation.createdAt,
        updatedAt: result.relation.updatedAt,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create relation')
    }
  }

  async deleteRelation(req: Request, res: Response): Promise<void> {
    try {
      const relationId = req.params.relationId
      if (!relationId) {
        sendValidationError(res, 'relationId is required')
        return
      }
      if (!this.nodeRelationRepository) {
        sendNotFound(res, `Relation ${relationId}`)
        return
      }

      const relation = await this.nodeRelationRepository.findById(relationId as NodeRelationId)
      if (!relation) {
        sendNotFound(res, `Relation '${relationId}'`)
        return
      }

      await this.nodeRelationRepository.delete(relation.getId())
      sendSuccess(res, {
        id: String(relation.getId()),
        tableId: String(relation.getTableId()),
        deleted: true,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Delete relation')
    }
  }

  async listRelationTypes(req: Request, res: Response): Promise<void> {
    try {
      const limit = Number.parseInt(req.query.limit as string, 10) || 100
      const offset = Number.parseInt(req.query.offset as string, 10) || 0

      if (!this.relationTypeRepository) {
        sendSuccess(res, { relationTypes: [], total: 0, limit, offset, hasMore: false })
        return
      }

      const page = await this.relationTypeRepository.findAll({ limit, offset })
      const items = page.data ?? page.nodes ?? []
      sendSuccess(res, {
        relationTypes: items.map((rt) => ({
          id: String(rt.getId()),
          identifier: rt.getIdentifier(),
          description: rt.getDescription(),
          category: rt.getCategory(),
          createdAt: rt.getCreatedAt().toISOString(),
          updatedAt: rt.getUpdatedAt().toISOString(),
        })),
        total: page.total,
        limit,
        offset,
        hasMore: page.hasMore,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'List relation types')
    }
  }

  async createRelationType(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, description, category } = req.body ?? {}
      if (typeof identifier !== 'string' || identifier.trim().length === 0) {
        sendValidationError(res, 'identifier is required')
        return
      }

      const trimmedIdentifier = identifier.trim()
      if (!this.relationTypeRepository) {
        const nowIso = new Date().toISOString()
        sendSuccess(res, {
          id: `relation-type-${Date.now()}`,
          identifier: trimmedIdentifier,
          description: description || null,
          category: category || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        return
      }

      const existing = await this.relationTypeRepository.findByIdentifier(trimmedIdentifier)
      if (existing) {
        throw new ConflictException(`RelationType '${trimmedIdentifier}' already exists`)
      }

      const createdEntity = RelationType.create(
        trimmedIdentifier,
        typeof description === 'string' ? description : undefined,
        typeof category === 'string' ? category : undefined,
      )
      await this.relationTypeRepository.save(createdEntity)
      const saved = (await this.relationTypeRepository.findByIdentifier(trimmedIdentifier)) ?? createdEntity

      sendSuccess(res, {
        id: String(saved.getId()),
        identifier: saved.getIdentifier(),
        description: saved.getDescription(),
        category: saved.getCategory(),
        createdAt: saved.getCreatedAt().toISOString(),
        updatedAt: saved.getUpdatedAt().toISOString(),
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create relation type')
    }
  }

  // Template Operations
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, name, query, description, tags } = req.body

      if (!identifier || !name || !query) {
        sendValidationError(res, 'identifier, name, and query are required')
        return
      }

      if (!this.queryTemplateRepository) {
        sendSuccess(res, {
          id: `template-${Date.now()}`,
          identifier,
          name,
          description: description || null,
          query,
          tags: tags || ['general'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        return
      }

      const template = QueryTemplate.create(identifier, name, query, tags || ['general'], {
        description,
      })
      const result = await this.queryTemplateRepository.create(template)

      sendSuccess(res, {
        id: result.getId(),
        identifier: result.getIdentifier(),
        name: result.getName(),
        description: result.getDescription(),
        query: result.getQueryText(),
        tags: result.getTags(),
        createdAt: result.getCreatedAt().toISOString(),
        updatedAt: result.getUpdatedAt().toISOString(),
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create template')
    }
  }

  async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = (req.query.searchTerm as string) || ''
      const tags = this.extractTags(req)
      const limit = parseInt(req.query.limit as string, 10) || 20
      const offset = parseInt(req.query.offset as string, 10) || 0
      if (!this.queryTemplateRepository) {
        sendSuccess(res, {
          templates: [],
          total: 0,
          searchTerm,
          tags,
        })
        return
      }
      const searchResult = await this.queryTemplateRepository.search({
        tags: tags.length > 0 ? tags : undefined,
        limit,
        offset,
      })
      const normalizedSearch = searchTerm.trim().toLowerCase()
      const filteredTemplates =
        normalizedSearch.length === 0
          ? searchResult.items
          : searchResult.items.filter((template) =>
              [template.getIdentifier(), template.getName(), template.getDescription() || '']
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch),
            )

      const result = {
        templates: filteredTemplates.map((template) => ({
          id: template.getId(),
          identifier: template.getIdentifier(),
          name: template.getName(),
          description: template.getDescription(),
          query: template.getQueryText(),
          tags: template.getTags(),
          createdAt: template.getCreatedAt().toISOString(),
          updatedAt: template.getUpdatedAt().toISOString(),
        })),
        total: filteredTemplates.length,
        searchTerm,
        tags,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search templates')
    }
  }

  async executeTemplateWithGraphQL(req: Request, res: Response): Promise<void> {
    try {
      const { templateIdentifier, variables } = req.body

      if (!templateIdentifier) {
        sendValidationError(res, 'templateIdentifier is required')
        return
      }

      if (!this.executeTemplateWithGraphQLUseCase) {
        sendSuccess(res, {
          templateIdentifier,
          variables: variables || {},
          executionResult: {
            success: true,
            data: {},
            errors: [],
          },
        })
        return
      }

      const result = await this.executeTemplateWithGraphQLUseCase.execute({
        templateIdentifier,
        variables: variables || {},
      })

      sendSuccess(res, {
        templateIdentifier,
        variables: variables || {},
        executionResult: result,
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Execute template')
    }
  }

  async exportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateIdentifier =
        (req.params?.templateIdentifier as string | undefined) ||
        (req.query?.templateIdentifier as string | undefined) ||
        (req.body?.templateIdentifier as string | undefined)
      const includeStatistics =
        req.query?.includeStatistics === 'true' || req.body?.includeStatistics === true

      if (!templateIdentifier) {
        sendValidationError(res, 'templateIdentifier is required')
        return
      }

      if (!this.queryTemplateRepository) {
        const result: ExportTemplateData = {
          templateIdentifier,
          exportData: {
            template: {
              id: `template_${Date.now()}`,
              identifier: templateIdentifier,
              name: `Template ${templateIdentifier}`,
              query: 'query { __typename }',
              tags: [],
              createdAt: new Date().toISOString(),
            },
            metadata: {
              exportVersion: BUN_GRAPH_DB_API_VERSION,
              dependencies: [],
            },
          },
          exportedAt: new Date().toISOString(),
        }

        sendSuccess(res, result)
        return
      }

      const exportUseCase = new ExportTemplateUseCase(this.queryTemplateRepository, this.logger)
      const exportResult = await exportUseCase.execute({
        templateIdentifier,
        options: { includeStatistics },
      })

      if (!exportResult.success || !exportResult.exportData) {
        res.status(404).json({
          success: false,
          error: exportResult.errors[0] || `Template '${templateIdentifier}' not found`,
        })
        return
      }

      const persistedTemplate = await this.queryTemplateRepository.findByIdentifier(templateIdentifier)
      const tpl = exportResult.exportData.template
      const result: ExportTemplateData & { templateExport: TemplateExportFormat } = {
        templateIdentifier,
        exportData: {
          template: {
            id: persistedTemplate?.getId() ?? tpl.identifier,
            identifier: tpl.identifier,
            name: tpl.name,
            query: tpl.query,
            tags: tpl.tags,
            createdAt: persistedTemplate?.getCreatedAt().toISOString() ?? exportResult.exportData.exportedAt,
          },
          metadata: {
            exportVersion: exportResult.exportData.version,
            description: tpl.description ?? null,
            operationType: tpl.operationType,
            version: tpl.version,
            complexityScore: tpl.complexityScore,
            isActive: tpl.isActive,
            applicableTables: tpl.applicableTables,
            defaultVariables: tpl.defaultVariables,
            ...(tpl.statistics ? { statistics: tpl.statistics } : {}),
          },
        },
        templateExport: exportResult.exportData,
        exportedAt: exportResult.exportData.exportedAt,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Export template')
    }
  }

  async importTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { jsonData, jsonString, overwriteExisting, generateNewIdentifier, newIdentifierPrefix } = req.body

      if (!jsonData && !jsonString) {
        sendValidationError(res, 'jsonData is required')
        return
      }

      if (!this.queryTemplateRepository) {
        const result: ImportTemplateData = {
          importResult: {
            success: true,
            templateIdentifier: 'imported_template',
            conflicts: overwriteExisting ? [] : ['Template already exists'],
          },
          importedAt: new Date().toISOString(),
        }

        sendSuccess(res, result)
        return
      }

      const importUseCase = new ImportTemplateUseCase(this.queryTemplateRepository, this.logger)
      const importResult = await importUseCase.execute({
        ...(typeof jsonData === 'string'
          ? { jsonString: jsonData }
          : jsonData
            ? { jsonData: jsonData as TemplateExportFormat }
            : { jsonString: String(jsonString) }),
        options: {
          overwriteExisting: Boolean(overwriteExisting),
          generateNewIdentifier: Boolean(generateNewIdentifier),
          newIdentifierPrefix: typeof newIdentifierPrefix === 'string' ? newIdentifierPrefix : undefined,
        },
      })

      if (!importResult.success) {
        res.status(400).json({
          success: false,
          error: importResult.errors.join('; ') || 'Template import failed',
          details: importResult,
        })
        return
      }

      const result: ImportTemplateData & { templateId?: string } = {
        templateId: importResult.templateId,
        importResult: {
          success: true,
          templateIdentifier: importResult.template?.identifier || '',
          conflicts: importResult.warnings,
        },
        importedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Import template')
    }
  }

  private normalizeAttributes(attributes: unknown): Record<string, unknown> | undefined {
    if (!attributes) {
      return undefined
    }

    if (Array.isArray(attributes)) {
      return Object.fromEntries(
        attributes
          .filter(
            (attribute): attribute is { attributeId?: string; identifier?: string; value: unknown } =>
              typeof attribute === 'object' && attribute !== null && 'value' in attribute,
          )
          .map((attribute) => [attribute.identifier || attribute.attributeId, attribute.value])
          .filter(([key]) => typeof key === 'string' && key.length > 0),
      )
    }

    if (typeof attributes === 'object') {
      return attributes as Record<string, unknown>
    }

    return undefined
  }

  private extractTags(req: Request): string[] {
    const explicitTags = req.query.tags

    if (Array.isArray(explicitTags)) {
      return explicitTags.map(String)
    }

    const queryEntries = Object.entries(req.query)
      .filter(([key]) => key.startsWith('tags['))
      .map(([, value]) => String(value))

    if (queryEntries.length > 0) {
      return queryEntries
    }

    if (typeof explicitTags === 'string' && explicitTags.trim().length > 0) {
      return explicitTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    }

    return []
  }
}
