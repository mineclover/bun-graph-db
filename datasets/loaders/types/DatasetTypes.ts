// Type definitions for dataset management

export interface TableSchema {
  identifier: string
  name: string
  description: string
  attributes: AttributeSchema[]
}

export interface AttributeSchema {
  identifier: string
  name: string
  description: string
  dataType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'TEXT' | 'DATE'
  isRequired: boolean
  defaultValue?: unknown
  constraints?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
}

export interface RelationTypeSchema {
  identifier: string
  name: string
  description: string
  sourceTable: string
  targetTable: string
  properties?: {
    strength?: number
    confidence?: number
    bidirectional?: boolean
  }
}

export interface DomainSchema {
  version: string
  name: string
  description: string
  tables: TableSchema[]
  relationTypes: RelationTypeSchema[]
  metadata?: {
    created: string
    author: string
    tags: string[]
  }
}

export interface FixtureNode {
  content: string
  title?: string
  description?: string
  attributes?: Record<string, unknown>
  metadata?: {
    weight?: number
    importance?: number
    tags?: string[]
  }
}

export interface FixtureRelation {
  sourceNodeContent: string
  targetNodeContent: string
  relationTypeIdentifier: string
  properties?: {
    strength?: number
    confidence?: number
  }
}

export interface DomainFixtures {
  version: string
  domain: string
  size: 'small' | 'medium' | 'large' | 'enterprise'
  tables: Record<string, FixtureNode[]>
  relations: FixtureRelation[]
  metadata: {
    totalNodes: number
    totalRelations: number
    generated: string
    description: string
  }
}

export interface QueryTemplate {
  identifier: string
  name: string
  description: string
  templateType: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
  tags: string[]
  queryText: string
  variablesSchema?: any
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  complexityScore: number
  version?: string
  author?: string
  usageHints?: string[]
}

export interface TemplateCollection {
  version: string
  name: string
  description: string
  domain?: string
  templates: QueryTemplate[]
  metadata?: {
    created: string
    author: string
    tags: string[]
  }
}

export type DatasetSize = 'small' | 'medium' | 'large' | 'enterprise'
export type DomainType = 'ecommerce' | 'social' | 'enterprise' | 'knowledge'
export type TemplateType = 'queries' | 'mutations' | 'subscriptions' | 'complex'

export interface LoaderOptions {
  validate?: boolean
  cache?: boolean
  timeout?: number
  retries?: number
}

export interface GeneratorOptions {
  size: DatasetSize
  domain: DomainType
  seed?: number
  customRatio?: {
    nodes?: Record<string, number>
    relations?: Record<string, number>
  }
  includeMetadata?: boolean
  format?: 'json' | 'csv' | 'sql'
}