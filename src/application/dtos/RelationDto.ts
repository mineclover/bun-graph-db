import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { RelationType } from '@/domain/entities/RelationType.js'

// Data Transfer Object for NodeRelation entity
export interface NodeRelationDto {
  id: string
  tableId: string
  sourceNodeId: string | null
  sourceExternalId: string
  targetNodeId: string | null
  targetExternalId: string
  relationTypeId: string
  properties: Record<string, any> | null
  strength: number
  confidence: number
  createdAt: string
  updatedAt: string
}

export function nodeRelationFromEntity(nodeRelation: NodeRelation): NodeRelationDto {
  return {
    id: nodeRelation.getId(),
    tableId: nodeRelation.getTableId(),
    sourceNodeId: nodeRelation.getSourceNodeId(),
    sourceExternalId: nodeRelation.getSourceExternalId(),
    targetNodeId: nodeRelation.getTargetNodeId(),
    targetExternalId: nodeRelation.getTargetExternalId(),
    relationTypeId: nodeRelation.getRelationTypeId(),
    properties: nodeRelation.getProperties(),
    strength: nodeRelation.getStrength(),
    confidence: (nodeRelation as any).getConfidence ? (nodeRelation as any).getConfidence() : 1,
    createdAt: nodeRelation.getCreatedAt().toISOString(),
    updatedAt: nodeRelation.getUpdatedAt().toISOString(),
  }
}

export function nodeRelationFromEntities(nodeRelations: NodeRelation[]): NodeRelationDto[] {
  return nodeRelations.map((nodeRelation) => nodeRelationFromEntity(nodeRelation))
}

// Data Transfer Object for RelationType entity
export interface RelationTypeDto {
  id: string
  identifier: string
  description: string | null
  category: string | null
  createdAt: string
  updatedAt: string
}

export function relationTypeFromEntity(relationType: RelationType): RelationTypeDto {
  return {
    id: relationType.getId(),
    identifier: relationType.getIdentifier(),
    description: relationType.getDescription(),
    category: relationType.getCategory(),
    createdAt: relationType.getCreatedAt().toISOString(),
    updatedAt: relationType.getUpdatedAt().toISOString(),
  }
}

export function relationTypeFromEntities(relationTypes: RelationType[]): RelationTypeDto[] {
  return relationTypes.map((relationType) => relationTypeFromEntity(relationType))
}

// Input DTOs for operations
export interface CreateRelationInput {
  tableId: string
  sourceNodeId?: string | null
  sourceExternalId?: string
  targetNodeId?: string | null
  targetExternalId?: string
  relationTypeId: string
  properties?: Record<string, any> | null
  strength?: number
  confidence?: number
}

export interface CreateRelationTypeInput {
  identifier: string
  description?: string
  category?: string
}

// Output DTOs for operations
export interface CreateRelationOutput {
  relation: NodeRelationDto
}

export interface CreateRelationTypeOutput {
  relationType: RelationTypeDto
}

export interface GetRelationsOutput {
  relations: NodeRelationDto[]
  total: number
  hasMore: boolean
}

export interface GetRelationTypesOutput {
  relationTypes: RelationTypeDto[]
  total: number
  hasMore: boolean
}
