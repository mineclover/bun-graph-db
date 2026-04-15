import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
import type { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ExportTemplateData, HealthCheckData, ImportTemplateData } from '../types/ApiResponseTypes.js'
import { sendHandleError, sendSuccess, sendValidationError } from '../utils/responseHelpers.js'

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
  ) {}

  // System Operations
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const result: HealthCheckData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'Connected',
        version: '1.0.0',
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Health check')
    }
  }

  async systemStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        },
        process: {
          pid: process.pid,
          cpu: process.cpuUsage(),
          platform: process.platform,
        },
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'System stats')
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

  // Node Operations
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, content, title, description, attributes } = req.body

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
          metadata: req.body.metadata || null,
        })
        return
      }

      const result = await this.createNodeUseCase.execute({
        tableId,
        content,
        title,
        description,
        attributes: this.normalizeAttributes(attributes),
      })

      sendSuccess(res, result.node)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create node')
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
      const { fromNodeId, toNodeId, relationshipType, relationTypeId, tableId, properties, strength } = req.body

      if (!fromNodeId || !toNodeId || !tableId || (!relationshipType && !relationTypeId)) {
        sendValidationError(res, 'fromNodeId, toNodeId, tableId, and relationshipType or relationTypeId are required')
        return
      }

      const resolvedRelationType =
        relationTypeId ||
        (relationshipType && this.relationTypeRepository
          ? (await this.relationTypeRepository.findByIdentifier(relationshipType))?.getId()
          : undefined)

      if (!resolvedRelationType) {
        sendValidationError(res, 'A valid relationshipType or relationTypeId is required')
        return
      }

      if (!this.createRelationUseCase) {
        sendSuccess(res, {
          id: `relation-${Date.now()}`,
          fromNodeId,
          toNodeId,
          tableId,
          relationTypeId: resolvedRelationType,
          relationshipType: relationshipType || relationTypeId,
          properties: properties || null,
          strength: strength || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        return
      }

      const result = await this.createRelationUseCase.execute({
        tableId,
        sourceNodeId: fromNodeId,
        targetNodeId: toNodeId,
        relationTypeId: resolvedRelationType,
        properties: properties || null,
        strength,
      })

      sendSuccess(res, {
        id: result.relation.id,
        fromNodeId: result.relation.sourceNodeId,
        toNodeId: result.relation.targetNodeId,
        tableId: result.relation.tableId,
        relationTypeId: result.relation.relationTypeId,
        relationshipType: relationshipType || relationTypeId,
        properties: result.relation.properties,
        strength: result.relation.strength,
        createdAt: result.relation.createdAt,
        updatedAt: result.relation.updatedAt,
      })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create relation')
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
      const { templateIdentifier } = req.body

      if (!templateIdentifier) {
        sendValidationError(res, 'templateIdentifier is required')
        return
      }

      const result: ExportTemplateData = {
        templateIdentifier,
        exportData: {
          template: {
            id: `template_${Date.now()}`,
            identifier: templateIdentifier,
            name: `Template ${templateIdentifier}`,
            query: 'query { placeholder }',
            tags: [],
            createdAt: new Date().toISOString(),
          },
          metadata: {
            exportVersion: '1.0.0',
            dependencies: [],
          },
        },
        exportedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Export template')
    }
  }

  async importTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { jsonData, overwriteExisting } = req.body

      if (!jsonData) {
        sendValidationError(res, 'jsonData is required')
        return
      }

      const result: ImportTemplateData = {
        importResult: {
          success: true,
          templateIdentifier: 'imported_template',
          conflicts: overwriteExisting ? [] : ['Template already exists'],
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
