import type { AttributeTypeId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class AttributeType {
  constructor(
    private readonly id: AttributeTypeId,
    private readonly identifier: string,
    private readonly jsonType: string,
    private readonly format: string | null,
    private readonly description: string | null,
    private readonly validationSchema: string | null,
    private readonly referenceConfig: string | null,
    private readonly defaultValue: string | null,
    private readonly examples: string | null,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    this.validateIdentifier(identifier)
    this.validateJsonType(jsonType)
    this.validateFormat(format)
    this.validateJsonStrings()
  }

  static create(
    identifier: string,
    jsonType: string,
    format?: string,
    description?: string,
    validationSchema?: string,
    referenceConfig?: string,
    defaultValue?: string,
    examples?: string
  ): AttributeType {
    return new AttributeType(
      null as any as AttributeTypeId,
      identifier,
      jsonType,
      format || null,
      description || null,
      validationSchema || null,
      referenceConfig || null,
      defaultValue || null,
      examples || null,
      new Date(),
      new Date()
    )
  }

  static fromDatabase(
    id: string,
    identifier: string,
    jsonType: string,
    format: string | null,
    description: string | null,
    validationSchema: string | null,
    referenceConfig: string | null,
    defaultValue: string | null,
    examples: string | null,
    createdAt: Date,
    updatedAt: Date
  ): AttributeType {
    return new AttributeType(
      id as AttributeTypeId,
      identifier,
      jsonType,
      format,
      description,
      validationSchema,
      referenceConfig,
      defaultValue,
      examples,
      createdAt,
      updatedAt
    )
  }

  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim() === '') {
      throw new DomainException('AttributeType identifier cannot be empty', 'DOMAIN_ERROR')
    }

    if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
      throw new DomainException(
        'AttributeType identifier must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
        'DOMAIN_ERROR'
      )
    }

    if (identifier.length > 50) {
      throw new DomainException(
        'AttributeType identifier cannot exceed 50 characters',
        'DOMAIN_ERROR'
      )
    }
  }

  private validateJsonType(jsonType: string): void {
    const validJsonTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']
    if (!validJsonTypes.includes(jsonType)) {
      throw new DomainException(
        `Invalid JSON type. Must be one of: ${validJsonTypes.join(', ')}`,
        'DOMAIN_ERROR'
      )
    }
  }

  private validateFormat(format: string | null): void {
    if (!format) return

    const validFormats = ['date', 'time', 'date-time', 'email', 'uri', 'uuid', 'reference']
    if (!validFormats.includes(format)) {
      throw new DomainException(
        `Invalid format. Must be one of: ${validFormats.join(', ')}`,
        'DOMAIN_ERROR'
      )
    }
  }

  private validateJsonStrings(): void {
    const jsonFields = [
      { field: 'validationSchema', value: this.validationSchema },
      { field: 'referenceConfig', value: this.referenceConfig },
      { field: 'defaultValue', value: this.defaultValue },
      { field: 'examples', value: this.examples },
    ]

    for (const { field, value } of jsonFields) {
      if (value !== null) {
        try {
          JSON.parse(value)
        } catch (error) {
          throw new DomainException(`${field} must be valid JSON`, 'DOMAIN_ERROR')
        }
      }
    }
  }

  getId(): AttributeTypeId {
    return this.id
  }

  getIdentifier(): string {
    return this.identifier
  }

  getJsonType(): string {
    return this.jsonType
  }

  getFormat(): string | null {
    return this.format
  }

  getDescription(): string | null {
    return this.description
  }

  getValidationSchema(): string | null {
    return this.validationSchema
  }

  getReferenceConfig(): string | null {
    return this.referenceConfig
  }

  getDefaultValue(): string | null {
    return this.defaultValue
  }

  getExamples(): string | null {
    return this.examples
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  getParsedValidationSchema(): object | null {
    if (!this.validationSchema) return null
    try {
      return JSON.parse(this.validationSchema)
    } catch {
      return null
    }
  }

  getParsedReferenceConfig(): object | null {
    if (!this.referenceConfig) return null
    try {
      return JSON.parse(this.referenceConfig)
    } catch {
      return null
    }
  }

  getParsedDefaultValue(): any {
    if (!this.defaultValue) return null
    try {
      return JSON.parse(this.defaultValue)
    } catch {
      return this.defaultValue
    }
  }

  getParsedExamples(): any[] | null {
    if (!this.examples) return null
    try {
      const parsed = JSON.parse(this.examples)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  isReference(): boolean {
    return this.format === 'reference'
  }

  toDatabase(): {
    id: AttributeTypeId | null
    identifier: string
    json_type: string
    format: string | null
    description: string | null
    validation_schema: string | null
    reference_config: string | null
    default_value: string | null
    examples: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      identifier: this.identifier,
      json_type: this.jsonType,
      format: this.format,
      description: this.description,
      validation_schema: this.validationSchema,
      reference_config: this.referenceConfig,
      default_value: this.defaultValue,
      examples: this.examples,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}
