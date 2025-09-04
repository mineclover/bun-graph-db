import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ValidationException, NotFoundException, ConflictException } from '@/shared/exceptions/DomainException.js'
import { NodeRelationDto, RelationTypeDto, CreateRelationOutput, CreateRelationTypeOutput } from '@/application/dtos/RelationDto.js'
import { NodeDto } from '@/application/dtos/NodeDto.js'
import type { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import type { NodeRelationId, RelationTypeId, NodeId, TableId } from '@/shared/types/common.js'

// Input types matching GraphQL schema
interface CreateRelationInput {
  tableId: string
  sourceNodeId?: string
  sourceExternalId?: string
  targetNodeId?: string
  targetExternalId?: string
  relationTypeId: string
  properties?: Record<string, any>
  strength?: number
  confidence?: number
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
    properties?: Record<string, any>
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
  nodeFilters?: Record<string, any>
  limit?: number
  offset?: number
}

export class RelationResolver {
  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  // Query resolvers
  async nodeRelation(args: { id: string }): Promise<NodeRelationDto | null> {
    try {
      const relation = await this.nodeRelationRepository.findById(args.id as NodeRelationId)
      return relation ? NodeRelationDto.fromEntity(relation) : null
    } catch (error) {
      this.logger.error('Failed to find node relation by id', { id: args.id, error })
      throw error
    }
  }

  async nodeRelations(args: { tableId: string }): Promise<NodeRelationDto[]> {
    try {
      const result = await this.nodeRelationRepository.findByTableId(
        args.tableId as TableId,
        { limit: 1000, offset: 0 }
      )
      return NodeRelationDto.fromEntities(result.data)
    } catch (error) {
      this.logger.error('Failed to find node relations by table id', { tableId: args.tableId, error })
      return []
    }
  }

  async relationTypes(): Promise<RelationTypeDto[]> {
    try {
      const result = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      return RelationTypeDto.fromEntities(result.data)
    } catch (error) {
      this.logger.error('Failed to find all relation types', { error })
      throw error
    }
  }

  async relationType(args: { id: string }): Promise<RelationTypeDto | null> {
    try {
      const relationType = await this.relationTypeRepository.findById(args.id as RelationTypeId)
      return relationType ? RelationTypeDto.fromEntity(relationType) : null
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
        relationFilters: args.input.relationFilters?.map(f => ({
          relationTypes: f.relationTypes,
          properties: f.properties,
          direction: f.direction,
          depth: f.depth as any // Convert number to RelationDepth enum
        })),
        pathQueries: args.input.pathQueries,
        nodeFilters: args.input.nodeFilters,
        limit: args.input.limit,
        offset: args.input.offset
      })

      return {
        nodes: result.nodes.map(n => ({
          node: n,
          attributes: {}, // TODO: Extract attributes from node
          sourceNodeId: null,
          targetNodeId: null,
          relationTypeId: null,
          properties: null,
          strength: null
        })),
        relations: result.relations || [],
        paths: result.paths || [],
        total: result.total,
        hasMore: result.hasMore
      }
    } catch (error) {
      this.logger.error('Failed to search related nodes', { input: args.input, error })
      throw error
    }
  }

  async findPathsBetweenNodes(args: {
    tableId: string
    startNodeIds: string[]
    endNodeIds: string[]
    maxDepth?: number
    relationTypes?: string[]
  }): Promise<Array<{
    startNodeId: string
    endNodeId: string
    path: string[]
    length: number
  }>> {
    try {
      return await this.searchRelatedNodesUseCase.getDependencies(
        args.tableId,
        args.startNodeIds[0], // Simplified for now
        'OUTGOING' as RelationDirection,
        args.relationTypes
      ) as any // TODO: Implement proper path finding
    } catch (error) {
      this.logger.error('Failed to find paths between nodes', { args, error })
      throw error
    }
  }

  async getDependencyChain(args: {
    tableId: string
    nodeId: string
    direction?: RelationDirection
    relationTypes?: string[]
  }): Promise<Array<{
    nodeId: string
    level: number
    relationPath: string[]
  }>> {
    try {
      return await this.searchRelatedNodesUseCase.getDependencies(
        args.tableId,
        args.nodeId,
        args.direction,
        args.relationTypes
      )
    } catch (error) {
      this.logger.error('Failed to get dependency chain', { args, error })
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
        confidence: args.input.confidence
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
        confidence: result.relation.confidence || 1,
        createdAt: result.relation.createdAt,
        updatedAt: result.relation.updatedAt
      }

      return {
        relation: relationDto,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create relation', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          relation: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: this.getValidationField(error.message)
          }]
        }
      }

      if (error instanceof NotFoundException) {
        return {
          relation: null,
          errors: [{ 
            message: error.message, 
            code: error.code
          }]
        }
      }

      if (error instanceof ConflictException) {
        return {
          relation: null,
          errors: [{ 
            message: error.message, 
            code: error.code
          }]
        }
      }
      
      return {
        relation: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
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
        category: args.input.category
      })

      // Convert the use case output to DTO
      const relationTypeDto: RelationTypeDto = {
        id: result.relationType.id,
        identifier: result.relationType.identifier,
        description: result.relationType.description,
        category: result.relationType.category,
        createdAt: result.relationType.createdAt,
        updatedAt: result.relationType.updatedAt
      }

      return {
        relationType: relationTypeDto,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create relation type', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          relationType: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }

      if (error instanceof ConflictException) {
        return {
          relationType: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }
      
      return {
        relationType: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
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
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to delete relation', { id: args.id, error })
      
      return {
        success: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  // Field resolvers for NodeRelation
  async table_field(relation: NodeRelationDto): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findById(relation.tableId as TableId)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to resolve table field for relation', { relationId: relation.id, error })
      return null
    }
  }

  async sourceNode_field(relation: NodeRelationDto): Promise<NodeDto | null> {
    try {
      if (!relation.sourceNodeId) return null
      
      const node = await this.nodeRepository.findById(relation.sourceNodeId as NodeId)
      return node ? NodeDto.fromEntity(node) : null
    } catch (error) {
      this.logger.error('Failed to resolve source node field', { relationId: relation.id, error })
      return null
    }
  }

  async targetNode_field(relation: NodeRelationDto): Promise<NodeDto | null> {
    try {
      if (!relation.targetNodeId) return null
      
      const node = await this.nodeRepository.findById(relation.targetNodeId as NodeId)
      return node ? NodeDto.fromEntity(node) : null
    } catch (error) {
      this.logger.error('Failed to resolve target node field', { relationId: relation.id, error })
      return null
    }
  }

  async relationType_field(relation: NodeRelationDto): Promise<RelationTypeDto | null> {
    try {
      const relationType = await this.relationTypeRepository.findById(relation.relationTypeId as RelationTypeId)
      return relationType ? RelationTypeDto.fromEntity(relationType) : null
    } catch (error) {
      this.logger.error('Failed to resolve relation type field', { relationId: relation.id, error })
      return null
    }
  }

  // Field resolvers for Node (relations)
  async outgoingRelations_field(node: NodeDto): Promise<NodeRelationDto[]> {
    try {
      if (!node.id) return []
      
      const result = await this.nodeRelationRepository.findBySourceNodeId(node.id as NodeId, { limit: 100, offset: 0 })
      return NodeRelationDto.fromEntities(result.data)
    } catch (error) {
      this.logger.error('Failed to resolve outgoing relations', { nodeId: node.id, error })
      return []
    }
  }

  async incomingRelations_field(node: NodeDto): Promise<NodeRelationDto[]> {
    try {
      if (!node.id) return []
      
      const result = await this.nodeRelationRepository.findByTargetNodeId(node.id as NodeId, { limit: 100, offset: 0 })
      return NodeRelationDto.fromEntities(result.data)
    } catch (error) {
      this.logger.error('Failed to resolve incoming relations', { nodeId: node.id, error })
      return []
    }
  }

  async relationCount_field(node: NodeDto): Promise<number> {
    try {
      if (!node.id) return 0
      
      const relations = await this.nodeRelationRepository.findByNodeId(node.id as NodeId, { limit: 1000, offset: 0 })
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