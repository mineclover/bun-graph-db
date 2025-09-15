/**
 * Schema Reflection System
 *
 * SQLite 스키마 → GraphQL 스키마 → TypeScript 타입 간의 자동 동기화를 제공
 * 메타데이터 기반 스키마 진화 및 검증 시스템
 */

import type { Database } from 'bun:sqlite'

export interface ColumnInfo {
  name: string
  type: string
  notnull: boolean
  dflt_value: string | null
  pk: boolean
}

export interface ForeignKeyInfo {
  table: string
  from: string
  to: string
}

export interface TableSchema {
  name: string
  columns: ColumnInfo[]
  primaryKeys: string[]
  foreignKeys: ForeignKeyInfo[]
  indexes: IndexInfo[]
}

export interface IndexInfo {
  name: string
  unique: boolean
  columns: string[]
  partial: boolean
  expression?: string
}

export interface GraphQLFieldMapping {
  sqliteColumn: string
  graphqlField: string
  graphqlType: string
  resolver?: string
  validation?: string
  transformation?: string
}

export interface SchemaIntegrationMetadata {
  table: string
  graphqlType: string
  description: string
  fields: GraphQLFieldMapping[]
  relationships: RelationshipMapping[]
  queryTemplates: string[] // 연관된 쿼리 템플릿 식별자들
}

export interface RelationshipMapping {
  type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany'
  targetTable: string
  targetType: string
  foreignKey: string
  resolverName: string
  inverse?: string
}

export class SchemaReflection {
  constructor(private readonly db: Database) {}

  /**
   * SQLite 데이터베이스에서 모든 테이블 스키마 정보를 추출
   */
  async extractDatabaseSchema(): Promise<TableSchema[]> {
    const tables = this.db
      .query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
      .all() as { name: string }[]

    const schemas: TableSchema[] = []

    for (const table of tables) {
      const columns = this.db.query(`PRAGMA table_info(${table.name})`).all() as ColumnInfo[]
      const foreignKeys = this.db.query(`PRAGMA foreign_key_list(${table.name})`).all() as any[]
      const indexes = this.extractIndexes(table.name)

      const primaryKeys = columns.filter((col) => col.pk).map((col) => col.name)

      const mappedForeignKeys: ForeignKeyInfo[] = foreignKeys.map((fk) => ({
        table: fk.table,
        from: fk.from,
        to: fk.to,
      }))

      schemas.push({
        name: table.name,
        columns,
        primaryKeys,
        foreignKeys: mappedForeignKeys,
        indexes,
      })
    }

    return schemas
  }

  /**
   * 테이블의 인덱스 정보를 추출
   */
  private extractIndexes(tableName: string): IndexInfo[] {
    const indexes = this.db
      .query(`
      SELECT name, [unique], sql, partial 
      FROM sqlite_master 
      WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%'
    `)
      .all(tableName) as any[]

    return indexes.map((idx) => {
      const info = this.db.query(`PRAGMA index_info(${idx.name})`).all() as any[]
      return {
        name: idx.name,
        unique: Boolean(idx.unique),
        columns: info.map((i) => i.name).filter(Boolean),
        partial: Boolean(idx.partial),
        expression: idx.sql,
      }
    })
  }

  /**
   * 스키마 통합 메타데이터를 기반으로 GraphQL 타입 정의 생성
   */
  generateGraphQLSchema(schemas: TableSchema[], metadata: SchemaIntegrationMetadata[]): string {
    const typeDefs: string[] = []

    for (const meta of metadata) {
      const schema = schemas.find((s) => s.name === meta.table)
      if (!schema) continue

      // GraphQL 타입 정의 생성
      const typeLines = [`type ${meta.graphqlType} implements Node {`]

      // ID 필드는 항상 포함
      typeLines.push(`  id: ID!`)

      // 메타데이터 기반 필드 매핑
      for (const fieldMapping of meta.fields) {
        const column = schema.columns.find((c) => c.name === fieldMapping.sqliteColumn)
        if (!column) continue

        const nullable = !column.notnull && !column.pk ? '' : '!'
        typeLines.push(`  ${fieldMapping.graphqlField}: ${fieldMapping.graphqlType}${nullable}`)
      }

      // 관계 필드
      for (const rel of meta.relationships) {
        const relType = this.getGraphQLRelationType(rel)
        typeLines.push(`  ${rel.resolverName}: ${relType}`)
      }

      typeLines.push(`}`)
      typeDefs.push(typeLines.join('\n'))

      // Input 타입들 생성
      typeDefs.push(this.generateInputTypes(meta))

      // Connection 타입 생성
      typeDefs.push(this.generateConnectionTypes(meta))
    }

    return typeDefs.join('\n\n')
  }

  private getGraphQLRelationType(rel: RelationshipMapping): string {
    switch (rel.type) {
      case 'oneToOne':
        return `${rel.targetType}`
      case 'oneToMany':
        return `[${rel.targetType}!]!`
      case 'manyToOne':
        return `${rel.targetType}!`
      case 'manyToMany':
        return `[${rel.targetType}!]!`
    }
  }

  private generateInputTypes(meta: SchemaIntegrationMetadata): string {
    const createInput = `input Create${meta.graphqlType}Input {\n${meta.fields
      .filter(
        (f) =>
          !f.sqliteColumn.includes('id') &&
          !f.sqliteColumn.includes('created_at') &&
          !f.sqliteColumn.includes('updated_at')
      )
      .map((f) => `  ${f.graphqlField}: ${f.graphqlType.replace('!', '')}`)
      .join('\n')}\n}`

    const updateInput = `input Update${meta.graphqlType}Input {\n${meta.fields
      .filter(
        (f) =>
          !f.sqliteColumn.includes('id') &&
          !f.sqliteColumn.includes('created_at') &&
          !f.sqliteColumn.includes('updated_at')
      )
      .map((f) => `  ${f.graphqlField}: ${f.graphqlType.replace('!', '')}`)
      .join('\n')}\n}`

    return [createInput, updateInput].join('\n\n')
  }

  private generateConnectionTypes(meta: SchemaIntegrationMetadata): string {
    const typeName = meta.graphqlType
    return `type ${typeName}Connection implements Connection {
  ${typeName.toLowerCase()}s: [${typeName}!]!
  totalCount: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}`
  }

  /**
   * TypeScript 인터페이스 생성
   */
  generateTypeScriptTypes(schemas: TableSchema[], metadata: SchemaIntegrationMetadata[]): string {
    const interfaces: string[] = []

    for (const meta of metadata) {
      const schema = schemas.find((s) => s.name === meta.table)
      if (!schema) continue

      const interfaceLines = [`export interface ${meta.graphqlType} {`]

      for (const fieldMapping of meta.fields) {
        const column = schema.columns.find((c) => c.name === fieldMapping.sqliteColumn)
        if (!column) continue

        const tsType = this.sqliteToTypeScript(column.type, !column.notnull)
        const optional = column.notnull ? '' : '?'
        interfaceLines.push(`  ${fieldMapping.graphqlField}${optional}: ${tsType}`)
      }

      interfaceLines.push(`}`)
      interfaces.push(interfaceLines.join('\n'))
    }

    return interfaces.join('\n\n')
  }

  private sqliteToTypeScript(sqliteType: string, nullable: boolean): string {
    const baseType = sqliteType.toUpperCase()
    let tsType: string

    if (baseType.includes('INT')) {
      tsType = 'number'
    } else if (baseType.includes('TEXT') || baseType.includes('CHAR')) {
      tsType = 'string'
    } else if (baseType.includes('BOOLEAN')) {
      tsType = 'boolean'
    } else if (baseType.includes('REAL') || baseType.includes('DOUBLE')) {
      tsType = 'number'
    } else {
      tsType = 'any'
    }

    return nullable ? `${tsType} | null` : tsType
  }

  /**
   * 쿼리 템플릿과 스키마의 정합성 검증
   */
  async validateQueryTemplateCompatibility(
    _templateId: string,
    queryText: string,
    _schemas: TableSchema[]
  ): Promise<ValidationResult> {
    // GraphQL 쿼리 파싱 및 스키마 검증
    const usedTypes = this.extractTypesFromQuery(queryText)
    const usedFields = this.extractFieldsFromQuery(queryText)

    const issues: ValidationIssue[] = []

    for (const typeName of usedTypes) {
      // 메타데이터에서 해당 타입 찾기
      const meta = await this.findMetadataForType(typeName)
      if (!meta) {
        issues.push({
          severity: 'error',
          message: `Type '${typeName}' not found in schema metadata`,
          location: 'query',
        })
        continue
      }

      // 필드 존재성 검증
      const typeFields = usedFields[typeName] || []
      for (const field of typeFields) {
        const fieldMapping = meta.fields.find((f) => f.graphqlField === field)
        if (!fieldMapping) {
          issues.push({
            severity: 'error',
            message: `Field '${field}' not found in type '${typeName}'`,
            location: `${typeName}.${field}`,
          })
        }
      }
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      complexity: this.calculateQueryComplexity(queryText, usedTypes.length, usedFields),
    }
  }

  private extractTypesFromQuery(query: string): string[] {
    // 간단한 정규식 기반 타입 추출 (실제로는 GraphQL 파서 사용 권장)
    const typeMatches = query.match(/\b([A-Z][a-zA-Z]*)\b/g) || []
    return [...new Set(typeMatches)]
  }

  private extractFieldsFromQuery(_query: string): Record<string, string[]> {
    // 실제 구현에서는 GraphQL AST 파싱 필요
    return {}
  }

  private async findMetadataForType(_typeName: string): Promise<SchemaIntegrationMetadata | null> {
    // 메타데이터 저장소에서 타입 조회
    return null
  }

  private calculateQueryComplexity(
    _query: string,
    typeCount: number,
    fields: Record<string, string[]>
  ): number {
    // 복잡도 계산 로직
    const fieldCount = Object.values(fields).flat().length
    return Math.min(typeCount * 2 + fieldCount * 0.5, 10)
  }
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  complexity: number
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  location: string
}
