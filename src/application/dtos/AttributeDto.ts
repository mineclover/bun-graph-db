import type {
  BaseEntityDto,
  DeleteOutput,
  GetManyInput,
  WithDescription,
  WithIdentifier,
  WithMetadata,
} from '@/core/types/UseCaseTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'

// Data Transfer Object for Attribute entity
export interface AttributeDto
  extends BaseEntityDto,
    WithIdentifier,
    WithDescription,
    WithMetadata<object> {
  tableId: string
  name: string
  attributeTypeId: string
  isRequired: boolean
}

export function fromEntity(attribute: Attribute): AttributeDto {
  console.log('DEBUG: AttributeDto.fromEntity input:', {
    id: attribute.getId(),
    attributeTypeId: attribute.getAttributeTypeId(),
    attributeTypeIdType: typeof attribute.getAttributeTypeId(),
  })

  const dto: AttributeDto = {
    id: attribute.getId(),
    tableId: attribute.getTableId(),
    identifier: attribute.getIdentifier(),
    name: attribute.getName(), // This already handles fallback to identifier
    attributeTypeId: attribute.getAttributeTypeId(),
    description: attribute.getDescription(),
    isRequired: attribute.getIsRequired(),
    metadata: attribute.getParsedMetadata(),
    createdAt: attribute.getCreatedAt().toISOString(),
    updatedAt: attribute.getUpdatedAt().toISOString(),
  }

  console.log('DEBUG: AttributeDto.fromEntity output:', {
    id: dto.id,
    name: dto.name,
    attributeTypeId: dto.attributeTypeId,
    attributeTypeIdType: typeof dto.attributeTypeId,
  })

  return dto
}

export function fromEntities(attributes: Attribute[]): AttributeDto[] {
  return attributes.map((attribute) => fromEntity(attribute))
}

// Input DTOs for operations
export interface CreateAttributeInput {
  tableId: string
  identifier: string
  name?: string
  attributeTypeId: string
  description?: string
  isRequired?: boolean
  metadata?: object
}

export interface UpdateAttributeInput {
  description?: string | null
  isRequired?: boolean
  metadata?: object | null
}

// Use generic GetManyInput with attribute-specific filters
export interface GetAttributesInput
  extends GetManyInput<{
    tableId?: string
    attributeTypeId?: string
    requiredOnly?: boolean
  }> {}

// Output DTOs for operations - using standard patterns
export interface CreateAttributeOutput {
  attribute: AttributeDto
}

export interface GetAttributeOutput {
  attribute: AttributeDto | null
}

export interface GetAttributesOutput {
  attributes: AttributeDto[]
  total: number
  hasMore: boolean
}

export interface UpdateAttributeOutput {
  attribute: AttributeDto
}

// Use generic DeleteOutput
export type DeleteAttributeOutput = DeleteOutput
