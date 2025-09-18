import type { AttributeType } from '@/domain/entities/AttributeType.js'

// Data Transfer Object for AttributeType entity
export interface AttributeTypeDto {
  id: string
  identifier: string
  jsonType: string
  format: string | null
  description: string | null
  validationSchema: object | null
  referenceConfig: object | null
  defaultValue: any
  examples: any[] | null
  createdAt: string
  updatedAt: string
}

export function fromEntity(attributeType: AttributeType): AttributeTypeDto {
  return {
    id: attributeType.getId(),
    identifier: attributeType.getIdentifier(),
    jsonType: attributeType.getJsonType(),
    format: attributeType.getFormat(),
    description: attributeType.getDescription(),
    validationSchema: attributeType.getParsedValidationSchema(),
    referenceConfig: attributeType.getParsedReferenceConfig(),
    defaultValue: attributeType.getParsedDefaultValue(),
    examples: attributeType.getParsedExamples(),
    createdAt: attributeType.getCreatedAt().toISOString(),
    updatedAt: attributeType.getUpdatedAt().toISOString(),
  }
}

export function fromEntities(attributeTypes: AttributeType[]): AttributeTypeDto[] {
  return attributeTypes.map((attributeType) => fromEntity(attributeType))
}

// Input DTOs for operations
export interface CreateAttributeTypeInput {
  identifier: string
  jsonType: string
  format?: string
  description?: string
  validationSchema?: object
  referenceConfig?: object
  defaultValue?: any
  examples?: any[]
}

export interface UpdateAttributeTypeInput {
  identifier?: string
  jsonType?: string
  format?: string | null
  description?: string | null
  validationSchema?: object | null
  referenceConfig?: object | null
  defaultValue?: any | null
  examples?: any[] | null
}

export interface GetAttributeTypesInput {
  limit?: number
  offset?: number
  jsonType?: string
}

// Output DTOs for operations
export interface CreateAttributeTypeOutput {
  attributeType: AttributeTypeDto
}

export interface GetAttributeTypeOutput {
  attributeType: AttributeTypeDto | null
}

export interface GetAttributeTypesOutput {
  attributeTypes: AttributeTypeDto[]
  total: number
  hasMore: boolean
}

export interface UpdateAttributeTypeOutput {
  attributeType: AttributeTypeDto
}

export interface DeleteAttributeTypeOutput {
  success: boolean
}
