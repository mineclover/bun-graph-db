/**
 * API Coverage Analysis Test
 *
 * Tests whether GraphQL API Queries provide sufficient coverage
 * for all SQL operations in the system
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { glob } from 'glob'
import type { IntrospectionField, IntrospectionObjectType, IntrospectionQuery } from 'graphql'
import { buildSchema, introspectionFromSchema } from 'graphql'

interface SQLOperation {
  file: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP'
  table?: string
  description?: string
  line?: number
}

interface APIOperation {
  name: string
  type: 'Query' | 'Mutation' | 'Subscription'
  description?: string
  returnType: string
  args: string[]
}

interface CoverageAnalysis {
  totalSQLOperations: number
  totalAPIOperations: number
  coveredOperations: number
  uncoveredOperations: SQLOperation[]
  redundantOperations: APIOperation[]
  coveragePercentage: number
  recommendations: string[]
}

describe('API Coverage Analysis', () => {
  let schemaContent: string
  let introspection: IntrospectionQuery
  let sqlOperations: SQLOperation[]
  let apiOperations: APIOperation[]

  beforeAll(async () => {
    // Load GraphQL schema
    const schemaPath = join(process.cwd(), 'generated/schema.graphql')
    schemaContent = readFileSync(schemaPath, 'utf-8')

    const schema = buildSchema(schemaContent)
    introspection = introspectionFromSchema(schema)

    // Extract SQL operations
    sqlOperations = await extractSQLOperations()

    // Extract API operations
    apiOperations = extractAPIOperations(introspection)
  })

  it('should identify all SQL operations in repository files', async () => {
    console.log('\n=== SQL Operations Found ===')

    const operationsByType = sqlOperations.reduce(
      (acc, op) => {
        acc[op.operation] = (acc[op.operation] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.log('Operations by type:', operationsByType)
    console.log('Total SQL operations:', sqlOperations.length)

    expect(sqlOperations.length).toBeGreaterThan(0)
    expect(operationsByType.SELECT).toBeGreaterThan(0)
    expect(operationsByType.INSERT).toBeGreaterThan(0)
  })

  it('should identify all API operations in GraphQL schema', () => {
    console.log('\n=== API Operations Found ===')

    const operationsByType = apiOperations.reduce(
      (acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.log('Operations by type:', operationsByType)
    console.log('Total API operations:', apiOperations.length)

    expect(apiOperations.length).toBeGreaterThan(0)
    expect(operationsByType.Query).toBeGreaterThan(0)
    expect(operationsByType.Mutation).toBeGreaterThan(0)
  })

  it('should analyze coverage between SQL and API operations', () => {
    const analysis = analyzeCoverage(sqlOperations, apiOperations)

    console.log('\n=== Coverage Analysis ===')
    console.log(`Total SQL Operations: ${analysis.totalSQLOperations}`)
    console.log(`Total API Operations: ${analysis.totalAPIOperations}`)
    console.log(`Coverage: ${analysis.coveragePercentage.toFixed(1)}%`)
    console.log(`Covered Operations: ${analysis.coveredOperations}`)
    console.log(`Uncovered Operations: ${analysis.uncoveredOperations.length}`)

    if (analysis.uncoveredOperations.length > 0) {
      console.log('\n--- Uncovered SQL Operations ---')
      analysis.uncoveredOperations.forEach((op) => {
        console.log(`${op.operation} in ${op.file}${op.table ? ` (table: ${op.table})` : ''}`)
      })
    }

    if (analysis.recommendations.length > 0) {
      console.log('\n--- Recommendations ---')
      for (const rec of analysis.recommendations) {
        console.log(`- ${rec}`)
      }
    }

    // Coverage should be reasonable (>= 70%)
    expect(analysis.coveragePercentage).toBeGreaterThanOrEqual(70)
  })

  it('should identify missing CRUD operations for each entity', () => {
    const entities = ['Table', 'Node', 'Attribute', 'Relation', 'Template']
    const missingOperations: Record<string, string[]> = {}

    entities.forEach((entity) => {
      const missing: string[] = []

      // Check for basic CRUD operations
      const hasCreate = apiOperations.some(
        (op) =>
          op.type === 'Mutation' && op.name.toLowerCase().includes(`create${entity.toLowerCase()}`)
      )
      const hasRead = apiOperations.some(
        (op) =>
          op.type === 'Query' &&
          (op.name.toLowerCase().includes(entity.toLowerCase()) ||
            op.name.toLowerCase().includes(`get${entity.toLowerCase()}`) ||
            op.name.toLowerCase().includes(`search${entity.toLowerCase()}`))
      )
      const hasUpdate = apiOperations.some(
        (op) =>
          op.type === 'Mutation' && op.name.toLowerCase().includes(`update${entity.toLowerCase()}`)
      )
      const hasDelete = apiOperations.some(
        (op) =>
          op.type === 'Mutation' && op.name.toLowerCase().includes(`delete${entity.toLowerCase()}`)
      )

      if (!hasCreate) missing.push('CREATE')
      if (!hasRead) missing.push('READ')
      if (!hasUpdate) missing.push('UPDATE')
      if (!hasDelete) missing.push('DELETE')

      if (missing.length > 0) {
        missingOperations[entity] = missing
      }
    })

    console.log('\n=== Missing CRUD Operations ===')
    Object.entries(missingOperations).forEach(([entity, operations]) => {
      console.log(`${entity}: Missing ${operations.join(', ')}`)
    })

    // Most entities should have complete CRUD operations
    expect(Object.keys(missingOperations).length).toBeLessThanOrEqual(2)
  })

  it('should validate template execution coverage', () => {
    const templateOperations = apiOperations.filter(
      (op) =>
        op.name.toLowerCase().includes('template') || op.name.toLowerCase().includes('execute')
    )

    console.log('\n=== Template Execution Operations ===')
    templateOperations.forEach((op) => {
      console.log(`${op.type}: ${op.name} -> ${op.returnType}`)
    })

    // Should have template execution capabilities
    const hasExecuteTemplate = templateOperations.some((op) => op.name.includes('executeTemplate'))
    const hasCreateTemplate = templateOperations.some((op) => op.name.includes('createTemplate'))
    const hasSearchTemplates = templateOperations.some(
      (op) => op.name.includes('searchTemplate') || op.name.includes('getTemplate')
    )

    expect(hasExecuteTemplate).toBe(true)
    expect(hasCreateTemplate).toBe(true)
    expect(hasSearchTemplates).toBe(true)
  })
})

// Helper functions
async function extractSQLOperations(): Promise<SQLOperation[]> {
  const operations: SQLOperation[] = []
  const sqlFiles = await glob('src/infrastructure/database/sqlite/**/*.ts')

  for (const file of sqlFiles) {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Match SQL operations
      const sqlPattern = /(?:^|[\s=`'"(])(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)[\s\n]/i
      const match = sqlPattern.exec(trimmed)

      if (match) {
        const operation = match[1].toUpperCase() as SQLOperation['operation']

        // Try to extract table name
        let table: string | undefined
        const tablePatterns = [/(?:FROM|INTO|UPDATE|TABLE)\s+`?(\w+)`?/i, /(?:JOIN)\s+`?(\w+)`?/i]

        for (const pattern of tablePatterns) {
          const tableMatch = pattern.exec(trimmed)
          if (tableMatch) {
            table = tableMatch[1]
            break
          }
        }

        operations.push({
          file: file.replace(`${process.cwd()}/`, ''),
          operation,
          table,
          line: index + 1,
          description: trimmed.substring(0, 100),
        })
      }
    })
  }

  return operations
}

function extractAPIOperations(introspection: IntrospectionQuery): APIOperation[] {
  const operations: APIOperation[] = []

  const types = ['Query', 'Mutation', 'Subscription']

  types.forEach((typeName) => {
    const type = introspection.__schema.types.find(
      (t) => t.name === typeName
    ) as IntrospectionObjectType
    if (type?.fields) {
      type.fields.forEach((field: IntrospectionField) => {
        operations.push({
          name: field.name,
          type: typeName as 'Query' | 'Mutation' | 'Subscription',
          description: field.description || undefined,
          returnType: getTypeString(field.type),
          args: field.args?.map((arg) => `${arg.name}: ${getTypeString(arg.type)}`) || [],
        })
      })
    }
  })

  return operations
}

function getTypeString(type: any): string {
  if (type.kind === 'NON_NULL') {
    return `${getTypeString(type.ofType)}!`
  }
  if (type.kind === 'LIST') {
    return `[${getTypeString(type.ofType)}]`
  }
  return type.name || 'Unknown'
}

function analyzeCoverage(sqlOps: SQLOperation[], apiOps: APIOperation[]): CoverageAnalysis {
  const covered: SQLOperation[] = []
  const uncovered: SQLOperation[] = []
  const recommendations: string[] = []

  // Analyze SQL to API mapping
  sqlOps.forEach((sqlOp) => {
    const isCovered = checkOperationCoverage(sqlOp, apiOps)
    if (isCovered) {
      covered.push(sqlOp)
    } else {
      uncovered.push(sqlOp)
    }
  })

  const coveragePercentage = (covered.length / sqlOps.length) * 100

  // Generate recommendations
  if (coveragePercentage < 80) {
    recommendations.push('Coverage is below 80% - consider adding more API operations')
  }

  const uncoveredByTable = groupBy(uncovered, (op) => op.table || 'unknown')
  Object.entries(uncoveredByTable).forEach(([table, ops]) => {
    if (ops.length > 2) {
      recommendations.push(
        `Table '${table}' has ${ops.length} uncovered operations - consider adding comprehensive API for this entity`
      )
    }
  })

  return {
    totalSQLOperations: sqlOps.length,
    totalAPIOperations: apiOps.length,
    coveredOperations: covered.length,
    uncoveredOperations: uncovered,
    redundantOperations: [], // TODO: implement redundancy detection
    coveragePercentage,
    recommendations,
  }
}

function checkOperationCoverage(sqlOp: SQLOperation, apiOps: APIOperation[]): boolean {
  const { operation, table } = sqlOp

  // Map SQL operations to expected API operations
  const operationMapping = {
    SELECT: ['Query'],
    INSERT: ['Mutation'],
    UPDATE: ['Mutation'],
    DELETE: ['Mutation'],
    CREATE: ['Mutation'],
    DROP: ['Mutation'],
  }

  const expectedTypes = operationMapping[operation] || []

  // Check if there's a corresponding API operation
  return apiOps.some((apiOp) => {
    if (!expectedTypes.includes(apiOp.type)) return false

    // Check for table/entity name match
    if (table) {
      const entityNames = [
        table.toLowerCase(),
        table
          .replace(/s$/, '')
          .toLowerCase(), // remove plural
        table
          .replace(/_/g, '')
          .toLowerCase(), // remove underscores
      ]

      return entityNames.some(
        (entityName) =>
          apiOp.name.toLowerCase().includes(entityName) ||
          apiOp.returnType.toLowerCase().includes(entityName)
      )
    }

    return true // Generic match if no table specified
  })
}

function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    },
    {} as Record<K, T[]>
  )
}
