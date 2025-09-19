import { type NodeDto, fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import {
  type NodeRelationDto,
  nodeRelationFromEntities,
  nodeRelationFromEntity,
  type RelationTypeDto,
  relationTypeFromEntities,
  relationTypeFromEntity,
} from '@/application/dtos/RelationDto.js'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { NodeId, NodeRelationId, RelationTypeId, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

// Input types matching GraphQL schema
interface CreateRelationInput {
  tableId: string
  sourceNodeId?: string
  sourceExternalId?: string
  targetNodeId?: string
  targetExternalId?: string
  relationTypeId: string
  properties?: Record<string, unknown>
  strength?: number
  // Note: confidence is handled in the use case, not in this interface
}

interface CreateRelationTypeInput {
  identifier: string
  description?: string
  category?: string
}

interface SearchRelatedNodesInput {
  tableId: string
  sourceNodeIds?: string[]
  relationFilters?: Array<{
    relationTypes?: string[]
    properties?: Record<string, unknown>
    direction: RelationDirection
    depth: number
  }>
  pathQueries?: Array<{
    startNodeIds?: string[]
    endNodeIds?: string[]
    relationTypes?: string[]
    maxDepth?: number
    shortestPath?: boolean
  }>
  nodeFilters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export class RelationResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  // Query resolvers
  async nodeRelation(
    args: { id: string },
    _context?: GraphQLContext
  ): Promise<NodeRelationDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation ID'),
      ],
      'nodeRelation'
    )

    return this.handleQuery(
      async () => {
        const relation = await this.nodeRelationRepository.findById(args.id as NodeRelationId)
        return relation ? nodeRelationFromEntity(relation) : null
      },
      'findNodeRelationById',
      { id: args.id }
    )
  }

  async nodeRelations(args: {
    filter?: { tableId?: string }
    pagination?: { limit?: number; offset?: number }
  }): Promise<{
    nodes: NodeRelationDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    try {
      const { limit = 10, offset = 0 } = args.pagination || {}

      // If no filter provided, get all node relations
      const result = args.filter?.tableId
        ? await this.nodeRelationRepository.findByTableId(args.filter.tableId as TableId, {
            limit,
            offset,
          })
        : await this.nodeRelationRepository.findAll({ limit, offset })

      return {
        nodes: nodeRelationFromEntities(result.nodes || []),
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
      }
    } catch (error) {
      this.logger.error('Failed to find node relations', {
        filter: args.filter,
        pagination: args.pagination,
        error,
      })
      return {
        nodes: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    }
  }

  async relationTypes(): Promise<RelationTypeDto[]> {
    try {
      const result = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      return relationTypeFromEntities(result.items || [])
    } catch (error) {
      this.logger.error('Failed to find all relation types', { error })
      throw error
    }
  }

  async relationType(args: { id: string }): Promise<RelationTypeDto | null> {
    try {
      const relationType = await this.relationTypeRepository.findById(args.id as RelationTypeId)
      return relationType ? relationTypeFromEntity(relationType) : null
    } catch (error) {
      this.logger.error('Failed to find relation type by id', { id: args.id, error })
      throw error
    }
  }

  // Advanced graph query resolvers
  async searchRelatedNodes(args: { input: SearchRelatedNodesInput }): Promise<any> {
    try {
      const result = await this.searchRelatedNodesUseCase.execute({
        tableId: args.input.tableId,
        sourceNodeIds: args.input.sourceNodeIds,
        relationFilters: args.input.relationFilters?.map((f) => ({
          relationTypes: f.relationTypes,
          properties: f.properties,
          direction: f.direction,
          depth: f.depth as any, // Convert number to RelationDepth enum
        })),
        pathQueries: args.input.pathQueries,
        nodeFilters: args.input.nodeFilters,
        limit: args.input.limit,
        offset: args.input.offset,
      })

      return {
        nodes: result.nodes.map((n) => ({
          node: n,
          attributes: {}, // TODO: Extract attributes from node
          sourceNodeId: null,
          targetNodeId: null,
          relationTypeId: null,
          properties: null,
          strength: null,
        })),
        relations: result.relations || [],
        paths: result.paths || [],
        total: result.total,
        hasMore: result.hasMore,
      }
    } catch (error) {
      this.logger.error('Failed to search related nodes', { input: args.input, error })
      throw error
    }
  }

  async getDependencyChain(args: {
    input: {
      nodeId: string
      direction?: RelationDirection
      maxDepth?: number
      relationTypeIds?: string[]
    }
  }): Promise<{
    nodes: Array<{
      id: string
    }>
    totalCount: number
  }> {
    try {
      const maxDepth = args.input.maxDepth || 5
      const direction = args.input.direction || 'OUTGOING'

      // Implementation for dependency chain analysis
      const visitedNodes = new Set<string>()
      const dependencyNodes: Array<{ id: string }> = []

      const exploreDependencies = async (currentNodeId: string, currentDepth: number) => {
        if (currentDepth >= maxDepth || visitedNodes.has(currentNodeId)) {
          return
        }

        visitedNodes.add(currentNodeId)

        // Find relations based on direction
        const relations =
          direction === 'OUTGOING'
            ? await this.nodeRelationRepository.findBySourceNodeId(currentNodeId as NodeId)
            : await this.nodeRelationRepository.findByTargetNodeId(currentNodeId as NodeId)

        for (const relation of relations) {
          // Filter by relation types if specified
          if (
            args.input.relationTypeIds?.length &&
            !args.input.relationTypeIds.includes(relation.getRelationTypeId())
          ) {
            continue
          }

          const nextNodeId =
            direction === 'OUTGOING' ? relation.getTargetNodeId() : relation.getSourceNodeId()

          if (nextNodeId && !visitedNodes.has(nextNodeId)) {
            dependencyNodes.push({ id: nextNodeId })
            await exploreDependencies(nextNodeId, currentDepth + 1)
          }
        }
      }

      await exploreDependencies(args.input.nodeId, 0)

      return {
        nodes: dependencyNodes,
        totalCount: dependencyNodes.length,
      }
    } catch (error) {
      this.logger.error('Failed to get dependency chain', { input: args.input, error })
      throw error
    }
  }

  async findPathsBetweenNodes(args: {
    input: {
      sourceNodeId: string
      targetNodeId: string
      maxDepth?: number
      relationTypeIds?: string[]
    }
  }): Promise<
    Array<{
      nodes: Array<{ id: string }>
      relations: Array<{ id: string }>
      length: number
      totalWeight?: number
    }>
  > {
    try {
      const maxDepth = args.input.maxDepth || 3
      const sourceNodeId = args.input.sourceNodeId
      const targetNodeId = args.input.targetNodeId

      // BFS algorithm to find all paths between two nodes
      const paths: Array<{
        nodes: Array<{ id: string }>
        relations: Array<{ id: string }>
        length: number
        totalWeight?: number
      }> = []

      interface PathState {
        currentNodeId: string
        visitedNodes: string[]
        usedRelations: string[]
        totalWeight: number
      }

      const queue: PathState[] = [
        {
          currentNodeId: sourceNodeId,
          visitedNodes: [sourceNodeId],
          usedRelations: [],
          totalWeight: 0,
        },
      ]

      while (queue.length > 0) {
        const state = queue.shift()!

        if (state.visitedNodes.length > maxDepth + 1) {
          continue
        }

        if (state.currentNodeId === targetNodeId && state.visitedNodes.length > 1) {
          // Found a path
          paths.push({
            nodes: state.visitedNodes.map((id) => ({ id })),
            relations: state.usedRelations.map((id) => ({ id })),
            length: state.visitedNodes.length - 1,
            totalWeight: state.totalWeight,
          })
          continue
        }

        // Find outgoing relations from current node
        const relations = await this.nodeRelationRepository.findBySourceNodeId(
          state.currentNodeId as NodeId
        )

        for (const relation of relations) {
          const nextNodeId = relation.getTargetNodeId()

          // Skip if nextNodeId is null
          if (!nextNodeId) {
            continue
          }

          // Avoid cycles
          if (state.visitedNodes.includes(nextNodeId)) {
            continue
          }

          // Filter by relation types if specified
          if (
            args.input.relationTypeIds?.length &&
            !args.input.relationTypeIds.includes(relation.getRelationTypeId())
          ) {
            continue
          }

          queue.push({
            currentNodeId: nextNodeId,
            visitedNodes: [...state.visitedNodes, nextNodeId],
            usedRelations: [...state.usedRelations, relation.getId()],
            totalWeight: state.totalWeight + 1, // Simple weight calculation
          })
        }
      }

      // Sort paths by length (shortest first)
      return paths.sort((a, b) => a.length - b.length)
    } catch (error) {
      this.logger.error('Failed to find paths between nodes', { input: args.input, error })
      throw error
    }
  }

  // Mutation resolvers
  async createRelation(args: { input: CreateRelationInput }): Promise<{
    relation: NodeRelationDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createRelationUseCase.execute({
        tableId: args.input.tableId,
        sourceNodeId: args.input.sourceNodeId,
        sourceExternalId: args.input.sourceExternalId,
        targetNodeId: args.input.targetNodeId,
        targetExternalId: args.input.targetExternalId,
        relationTypeId: args.input.relationTypeId,
        properties: args.input.properties,
        strength: args.input.strength,
        // confidence is not part of the use case interface
      })

      // Convert the use case output to DTO
      const relationDto: NodeRelationDto = {
        id: result.relation.id,
        tableId: result.relation.tableId,
        sourceNodeId: result.relation.sourceNodeId,
        sourceExternalId: result.relation.sourceExternalId,
        targetNodeId: result.relation.targetNodeId,
        targetExternalId: result.relation.targetExternalId,
        relationTypeId: result.relation.relationTypeId,
        properties: result.relation.properties,
        strength: result.relation.strength,
        confidence: result.relation.strength || 1,
        createdAt: result.relation.createdAt,
        updatedAt: result.relation.updatedAt,
      }

      return {
        relation: relationDto,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create relation', { input: args.input, error })

      if (error instanceof ValidationException) {
        return {
          relation: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: this.getValidationField(error.message),
            },
          ],
        }
      }

      if (error instanceof NotFoundException) {
        return {
          relation: null,
          errors: [
            {
              message: error.message,
              code: error.code,
            },
          ],
        }
      }

      if (error instanceof ConflictException) {
        return {
          relation: null,
          errors: [
            {
              message: error.message,
              code: error.code,
            },
          ],
        }
      }

      return {
        relation: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async createRelationType(args: { input: CreateRelationTypeInput }): Promise<{
    relationType: RelationTypeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createRelationTypeUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
        category: args.input.category,
      })

      // Convert the use case output to DTO
      const relationTypeDto: RelationTypeDto = {
        id: result.relationType.id,
        identifier: result.relationType.identifier,
        description: result.relationType.description,
        category: result.relationType.category,
        createdAt: result.relationType.createdAt,
        updatedAt: result.relationType.updatedAt,
      }

      return {
        relationType: relationTypeDto,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create relation type', { input: args.input, error })

      if (error instanceof ValidationException) {
        return {
          relationType: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      if (error instanceof ConflictException) {
        return {
          relationType: null,
          errors: [
            {
              message: error.message,
              code: error.code,
              field: 'identifier',
            },
          ],
        }
      }

      return {
        relationType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async updateRelationType(args: {
    id: string
    input: { identifier?: string; description?: string; name?: string }
  }): Promise<{
    relationType: RelationTypeDto | null
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const existingRelationType = await this.relationTypeRepository.findById(
        args.id as RelationTypeId
      )
      if (!existingRelationType) {
        throw new NotFoundException(`Relation type with id ${args.id} not found`)
      }

      // Create updated RelationType entity
      const updatedRelationType = RelationType.fromDatabase(
        existingRelationType.getId()!,
        existingRelationType.getIdentifier(),
        args.input.description !== undefined
          ? args.input.description
          : existingRelationType.getDescription(),
        args.input.name || existingRelationType.getCategory(),
        existingRelationType.getCreatedAt(),
        new Date() // Update timestamp
      )

      await this.relationTypeRepository.update(updatedRelationType)

      const relationTypeDto: RelationTypeDto = {
        id: updatedRelationType.getId(),
        identifier: updatedRelationType.getIdentifier(),
        description: updatedRelationType.getDescription(),
        category: updatedRelationType.getCategory(),
        createdAt: updatedRelationType.getCreatedAt().toISOString(),
        updatedAt: updatedRelationType.getUpdatedAt().toISOString(),
      }

      return {
        relationType: relationTypeDto,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update relation type', { id: args.id, input: args.input, error })

      if (error instanceof NotFoundException) {
        return {
          relationType: null,
          errors: [
            {
              message: error.message,
              code: 'NOT_FOUND',
            },
          ],
        }
      }

      if (error instanceof ValidationException) {
        return {
          relationType: null,
          errors: [
            {
              message: error.message,
              code: 'VALIDATION_ERROR',
            },
          ],
        }
      }

      return {
        relationType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteRelationType(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const existingRelationType = await this.relationTypeRepository.findById(
        args.id as RelationTypeId
      )
      if (!existingRelationType) {
        throw new NotFoundException(`Relation type with id ${args.id} not found`)
      }

      await this.relationTypeRepository.delete(args.id as RelationTypeId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete relation type', { id: args.id, error })

      if (error instanceof NotFoundException) {
        return {
          success: false,
          errors: [
            {
              message: error.message,
              code: 'NOT_FOUND',
            },
          ],
        }
      }

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteRelation(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const relation = await this.nodeRelationRepository.findById(args.id as NodeRelationId)
      if (!relation) {
        throw new NotFoundException(`Relation with id ${args.id} not found`)
      }

      await this.nodeRelationRepository.delete(args.id as NodeRelationId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete relation', { id: args.id, error })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  // Field resolvers for NodeRelation
  async table_field(relation: NodeRelationDto): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findById(relation.tableId as TableId)
      return table ? tableFromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to resolve table field for relation', {
        relationId: relation.id,
        error,
      })
      return null
    }
  }

  async sourceNode_field(relation: NodeRelationDto): Promise<NodeDto | null> {
    try {
      if (!relation.sourceNodeId) return null

      const node = await this.nodeRepository.findById(relation.sourceNodeId as NodeId)
      return node ? nodeFromEntity(node) : null
    } catch (error) {
      this.logger.error('Failed to resolve source node field', { relationId: relation.id, error })
      return null
    }
  }

  async targetNode_field(relation: NodeRelationDto): Promise<NodeDto | null> {
    try {
      if (!relation.targetNodeId) return null

      const node = await this.nodeRepository.findById(relation.targetNodeId as NodeId)
      return node ? nodeFromEntity(node) : null
    } catch (error) {
      this.logger.error('Failed to resolve target node field', { relationId: relation.id, error })
      return null
    }
  }

  async relationType_field(relation: NodeRelationDto): Promise<RelationTypeDto | null> {
    try {
      const relationType = await this.relationTypeRepository.findById(
        relation.relationTypeId as RelationTypeId
      )
      return relationType ? relationTypeFromEntity(relationType) : null
    } catch (error) {
      this.logger.error('Failed to resolve relation type field', { relationId: relation.id, error })
      return null
    }
  }

  // Field resolvers for Node (relations)
  async outgoingRelations_field(node: NodeDto): Promise<NodeRelationDto[]> {
    try {
      if (!node.id) return []

      const result = await this.nodeRelationRepository.findBySourceNodeIdPaginated(
        node.id as NodeId,
        {
          limit: 100,
          offset: 0,
        }
      )
      return nodeRelationFromEntities(result.items || [])
    } catch (error) {
      this.logger.error('Failed to resolve outgoing relations', { nodeId: node.id, error })
      return []
    }
  }

  async incomingRelations_field(node: NodeDto): Promise<NodeRelationDto[]> {
    try {
      if (!node.id) return []

      const result = await this.nodeRelationRepository.findByTargetNodeIdPaginated(
        node.id as NodeId,
        {
          limit: 100,
          offset: 0,
        }
      )
      return nodeRelationFromEntities(result.items || [])
    } catch (error) {
      this.logger.error('Failed to resolve incoming relations', { nodeId: node.id, error })
      return []
    }
  }

  async relationCount_field(node: NodeDto): Promise<number> {
    try {
      if (!node.id) return 0

      const relations = await this.nodeRelationRepository.findByNodeId(node.id as NodeId, {
        limit: 1000,
        offset: 0,
      })
      return relations.incoming.length + relations.outgoing.length
    } catch (error) {
      this.logger.error('Failed to resolve relation count', { nodeId: node.id, error })
      return 0
    }
  }

  private getValidationField(message: string): string | undefined {
    if (message.includes('Table ID')) return 'tableId'
    if (message.includes('Relation type ID')) return 'relationTypeId'
    if (message.includes('source')) return 'sourceNodeId'
    if (message.includes('target')) return 'targetNodeId'
    if (message.includes('strength')) return 'strength'
    return undefined
  }
}
