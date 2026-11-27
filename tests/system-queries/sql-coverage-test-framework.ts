/**
 * SQL Coverage Test Framework
 *
 * Comprehensive testing architecture for ensuring 100% SQL utilization
 * through GraphQL API operations
 */

import { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { glob } from 'glob'
import { buildASTSchema, execute, type GraphQLSchema, parse } from 'graphql'

export interface SQLCoverageConfig {
  testDatabase: string
  schemaPath: string
  repositoryPaths: string[]
  excludePatterns: string[]
  coverageThreshold: number
  maxComplexity: number
}

export interface SQLOperation {
  file: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP'
  table: string
  method: string
  sqlQuery: string
  line: number
  isCovered: boolean
  coveringAPI?: string
  testCases: SQLTestCase[]
}

export interface SQLTestCase {
  name: string
  graphqlQuery: string
  variables?: Record<string, any>
  expectedTables: string[]
  expectedOperations: string[]
  setupData?: any[]
  assertions: TestAssertion[]
}

export interface TestAssertion {
  type: 'database' | 'response' | 'performance'
  target: string
  condition: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists'
  value: any
}

export interface CoverageReport {
  totalOperations: number
  coveredOperations: number
  uncoveredOperations: SQLOperation[]
  coveragePercentage: number
  missingAPIs: MissingAPI[]
  testResults: TestResult[]
  recommendations: string[]
}

export interface MissingAPI {
  entity: string
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  suggestedAPI: string
  rationale: string
}

export interface TestResult {
  testName: string
  success: boolean
  sqlOperationsCovered: string[]
  executionTime: number
  errors: string[]
}

export class SQLCoverageTestFramework {
  private config: SQLCoverageConfig
  private schema: GraphQLSchema
  private database: Database
  private sqlOperations: SQLOperation[] = []
  private testCases: SQLTestCase[] = []

  constructor(config: SQLCoverageConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    // Load GraphQL schema from distributed files
    const typesArray = loadFilesSync(this.config.schemaPath, {
      extensions: ['graphql'],
      recursive: true,
    })
    const typeDefs = mergeTypeDefs(typesArray)
    // Build schema directly from AST using buildASTSchema
    this.schema = buildASTSchema(typeDefs)

    // Initialize test database
    this.database = new Database(this.config.testDatabase)

    // Extract all SQL operations
    await this.extractSQLOperations()

    // Generate test cases
    await this.generateTestCases()
  }

  async runFullCoverageTest(): Promise<CoverageReport> {
    const startTime = Date.now()
    const testResults: TestResult[] = []
    let coveredOperations = 0

    console.log('🚀 Starting comprehensive SQL coverage test...\n')

    // Run all test cases
    for (const testCase of this.testCases) {
      const result = await this.runTestCase(testCase)
      testResults.push(result)

      if (result.success) {
        coveredOperations += result.sqlOperationsCovered.length
        // Mark operations as covered
        this.markOperationsAsCovered(result.sqlOperationsCovered)
      }
    }

    const uncoveredOperations = this.sqlOperations.filter((op) => !op.isCovered)
    const coveragePercentage = (coveredOperations / this.sqlOperations.length) * 100

    const report: CoverageReport = {
      totalOperations: this.sqlOperations.length,
      coveredOperations,
      uncoveredOperations,
      coveragePercentage,
      missingAPIs: this.identifyMissingAPIs(uncoveredOperations),
      testResults,
      recommendations: this.generateRecommendations(uncoveredOperations, coveragePercentage),
    }

    console.log(`✅ Coverage test completed in ${Date.now() - startTime}ms`)
    this.printCoverageReport(report)

    return report
  }

  private async extractSQLOperations(): Promise<void> {
    const operations: SQLOperation[] = []

    for (const pattern of this.config.repositoryPaths) {
      const files = await glob(pattern)

      for (const file of files) {
        if (this.shouldExcludeFile(file)) continue

        const content = readFileSync(file, 'utf-8')
        const fileOperations = this.parseSQLFromFile(file, content)
        operations.push(...fileOperations)
      }
    }

    this.sqlOperations = operations
    console.log(
      `📊 Extracted ${operations.length} SQL operations from ${this.config.repositoryPaths.length} repository files`,
    )
  }

  private parseSQLFromFile(filePath: string, content: string): SQLOperation[] {
    const operations: SQLOperation[] = []
    const lines = content.split('\n')
    const className = this.extractClassName(content)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Match SQL operations with more context
      const sqlPatterns = [
        /(?:^|[\s=`'"(])(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+/i,
        /db\.(get|all|run|exec)\s*\(\s*[`'"]([^`'"]+)[`'"]/i,
        /query\s*=\s*[`'"]([^`'"]*(?:SELECT|INSERT|UPDATE|DELETE)[^`'"]*)[`'"]/i,
      ]

      for (const pattern of sqlPatterns) {
        const match = pattern.exec(line)
        if (match) {
          const operation = this.extractOperationType(match[0])
          const table = this.extractTableName(match[0])
          const method = this.extractMethodName(content, i)

          operations.push({
            file: filePath.replace(`${process.cwd()}/`, ''),
            operation,
            table,
            method: `${className}.${method}`,
            sqlQuery: match[0],
            line: i + 1,
            isCovered: false,
            testCases: [],
          })
        }
      }
    }

    return operations
  }

  private async generateTestCases(): Promise<void> {
    const testCases: SQLTestCase[] = []

    // Group operations by entity/table
    const operationsByTable = this.groupOperationsByTable()

    for (const [table, operations] of Object.entries(operationsByTable)) {
      // Generate CRUD test cases for each table
      const crudTests = this.generateCRUDTestCases(table, operations)
      testCases.push(...crudTests)

      // Generate complex query test cases
      const complexTests = this.generateComplexQueryTestCases(table, operations)
      testCases.push(...complexTests)

      // Generate edge case test cases
      const edgeTests = this.generateEdgeCaseTestCases(table, operations)
      testCases.push(...edgeTests)
    }

    this.testCases = testCases
    console.log(
      `🧪 Generated ${testCases.length} test cases covering ${Object.keys(operationsByTable).length} entities`,
    )
  }

  private generateCRUDTestCases(table: string, operations: SQLOperation[]): SQLTestCase[] {
    const testCases: SQLTestCase[] = []
    const entityName = this.tableToEntityName(table)

    // CREATE test case
    if (operations.some((op) => op.operation === 'INSERT')) {
      testCases.push({
        name: `Create ${entityName} - covers INSERT operations`,
        graphqlQuery: this.generateCreateMutation(entityName),
        variables: this.generateSampleData(entityName),
        expectedTables: [table],
        expectedOperations: ['INSERT'],
        assertions: [
          {
            type: 'database',
            target: table,
            condition: 'exists',
            value: true,
          },
          {
            type: 'response',
            target: 'success',
            condition: 'equals',
            value: true,
          },
        ],
      })
    }

    // READ test case
    if (operations.some((op) => op.operation === 'SELECT')) {
      testCases.push({
        name: `Read ${entityName} - covers SELECT operations`,
        graphqlQuery: this.generateReadQuery(entityName),
        variables: {},
        expectedTables: [table],
        expectedOperations: ['SELECT'],
        setupData: [this.generateSampleData(entityName)],
        assertions: [
          {
            type: 'response',
            target: 'data',
            condition: 'exists',
            value: true,
          },
        ],
      })
    }

    // UPDATE test case
    if (operations.some((op) => op.operation === 'UPDATE')) {
      testCases.push({
        name: `Update ${entityName} - covers UPDATE operations`,
        graphqlQuery: this.generateUpdateMutation(entityName),
        variables: { id: 'test-id', ...this.generateSampleData(entityName) },
        expectedTables: [table],
        expectedOperations: ['UPDATE'],
        setupData: [this.generateSampleData(entityName)],
        assertions: [
          {
            type: 'response',
            target: 'success',
            condition: 'equals',
            value: true,
          },
        ],
      })
    }

    // DELETE test case
    if (operations.some((op) => op.operation === 'DELETE')) {
      testCases.push({
        name: `Delete ${entityName} - covers DELETE operations`,
        graphqlQuery: this.generateDeleteMutation(entityName),
        variables: { id: 'test-id' },
        expectedTables: [table],
        expectedOperations: ['DELETE'],
        setupData: [this.generateSampleData(entityName)],
        assertions: [
          {
            type: 'response',
            target: 'success',
            condition: 'equals',
            value: true,
          },
        ],
      })
    }

    return testCases
  }

  private generateComplexQueryTestCases(table: string, operations: SQLOperation[]): SQLTestCase[] {
    const testCases: SQLTestCase[] = []
    const entityName = this.tableToEntityName(table)

    // Search/Filter test case
    testCases.push({
      name: `Search ${entityName} with filters - covers complex SELECT`,
      graphqlQuery: this.generateSearchQuery(entityName),
      variables: {
        filter: { search: 'test' },
        pagination: { limit: 10, offset: 0 },
      },
      expectedTables: [table],
      expectedOperations: ['SELECT'],
      setupData: Array(5)
        .fill(null)
        .map(() => this.generateSampleData(entityName)),
      assertions: [
        {
          type: 'response',
          target: 'nodes',
          condition: 'exists',
          value: true,
        },
        {
          type: 'performance',
          target: 'executionTime',
          condition: 'less_than',
          value: 1000,
        },
      ],
    })

    // Aggregation test case
    if (operations.some((op) => op.sqlQuery.includes('COUNT') || op.sqlQuery.includes('SUM'))) {
      testCases.push({
        name: `${entityName} aggregation - covers aggregate SELECT`,
        graphqlQuery: this.generateAggregationQuery(entityName),
        variables: {},
        expectedTables: [table],
        expectedOperations: ['SELECT'],
        setupData: Array(10)
          .fill(null)
          .map(() => this.generateSampleData(entityName)),
        assertions: [
          {
            type: 'response',
            target: 'totalCount',
            condition: 'greater_than',
            value: 0,
          },
        ],
      })
    }

    return testCases
  }

  private generateEdgeCaseTestCases(table: string, _operations: SQLOperation[]): SQLTestCase[] {
    const testCases: SQLTestCase[] = []
    const entityName = this.tableToEntityName(table)

    // Large dataset test
    testCases.push({
      name: `${entityName} large dataset handling`,
      graphqlQuery: this.generateReadQuery(entityName),
      variables: { pagination: { limit: 100 } },
      expectedTables: [table],
      expectedOperations: ['SELECT'],
      setupData: Array(150)
        .fill(null)
        .map(() => this.generateSampleData(entityName)),
      assertions: [
        {
          type: 'performance',
          target: 'executionTime',
          condition: 'less_than',
          value: 2000,
        },
      ],
    })

    // Empty result test
    testCases.push({
      name: `${entityName} empty result handling`,
      graphqlQuery: this.generateReadQuery(entityName),
      variables: { filter: { search: 'nonexistent' } },
      expectedTables: [table],
      expectedOperations: ['SELECT'],
      assertions: [
        {
          type: 'response',
          target: 'nodes',
          condition: 'equals',
          value: [],
        },
      ],
    })

    return testCases
  }

  private async runTestCase(testCase: SQLTestCase): Promise<TestResult> {
    const startTime = Date.now()
    let success = false
    const errors: string[] = []
    const sqlOperationsCovered: string[] = []

    try {
      // Setup test data if needed
      if (testCase.setupData) {
        await this.setupTestData(testCase.setupData)
      }

      // Parse and execute GraphQL query
      const document = parse(testCase.graphqlQuery)
      const result = await execute({
        schema: this.schema,
        document,
        variableValues: testCase.variables,
      })

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors.map((err) => err.message))
      } else {
        // Run assertions
        const assertionResults = await this.runAssertions(testCase.assertions, result.data)

        if (assertionResults.every((r) => r.success)) {
          success = true
          // Track which SQL operations were covered
          sqlOperationsCovered.push(...this.identifyCoveredOperations(testCase))
        } else {
          errors.push(...assertionResults.filter((r) => !r.success).map((r) => r.error))
        }
      }

      // Cleanup test data
      await this.cleanupTestData()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return {
      testName: testCase.name,
      success,
      sqlOperationsCovered,
      executionTime: Date.now() - startTime,
      errors,
    }
  }

  // Helper methods for test generation and execution
  private tableToEntityName(table: string): string {
    // Convert table name to entity name (e.g., 'node_attributes' -> 'NodeAttribute')
    return table
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }

  private generateCreateMutation(entityName: string): string {
    const lowerEntityName = entityName.charAt(0).toLowerCase() + entityName.slice(1)
    return `
      mutation Create${entityName}($input: Create${entityName}Input!) {
        create${entityName}(input: $input) {
          success
          ${lowerEntityName} {
            id
            createdAt
            updatedAt
          }
          errors {
            message
            code
          }
        }
      }
    `
  }

  private generateReadQuery(entityName: string): string {
    const pluralName = `${entityName.toLowerCase()}s`
    return `
      query Get${entityName}s($filter: ${entityName}sFilter, $pagination: PaginationInput) {
        ${pluralName}(filter: $filter, pagination: $pagination) {
          nodes {
            id
            createdAt
            updatedAt
          }
          totalCount
          hasNextPage
        }
      }
    `
  }

  private generateUpdateMutation(entityName: string): string {
    const lowerEntityName = entityName.charAt(0).toLowerCase() + entityName.slice(1)
    return `
      mutation Update${entityName}($id: ID!, $input: Update${entityName}Input!) {
        update${entityName}(id: $id, input: $input) {
          success
          ${lowerEntityName} {
            id
            updatedAt
          }
          errors {
            message
            code
          }
        }
      }
    `
  }

  private generateDeleteMutation(entityName: string): string {
    return `
      mutation Delete${entityName}($id: ID!) {
        delete${entityName}(id: $id) {
          success
          errors {
            message
            code
          }
        }
      }
    `
  }

  private generateSearchQuery(entityName: string): string {
    const _pluralName = `${entityName.toLowerCase()}s`
    return `
      query Search${entityName}s($filter: Search${entityName}sFilter!, $pagination: PaginationInput) {
        search${entityName}s(filter: $filter, pagination: $pagination) {
          nodes {
            id
            createdAt
          }
          totalCount
        }
      }
    `
  }

  private generateAggregationQuery(entityName: string): string {
    const pluralName = `${entityName.toLowerCase()}s`
    return `
      query ${entityName}Stats {
        ${pluralName} {
          totalCount
        }
      }
    `
  }

  private generateSampleData(entityName: string): any {
    // Generate appropriate sample data based on entity type
    const baseData = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    switch (entityName.toLowerCase()) {
      case 'table':
        return { ...baseData, identifier: `test-table-${Date.now()}`, description: 'Test table' }
      case 'node':
        return { ...baseData, content: 'Test node content', tableId: 'test-table-id' }
      case 'attribute':
        return {
          ...baseData,
          identifier: 'test-attr',
          tableId: 'test-table-id',
          attributeTypeId: 'test-type-id',
        }
      case 'nodeattribute':
        return {
          ...baseData,
          nodeId: 'test-node-id',
          attributeId: 'test-attr-id',
          value: 'test-value',
        }
      case 'relation':
        return {
          ...baseData,
          sourceNodeId: 'test-source',
          targetNodeId: 'test-target',
          relationTypeId: 'test-rel-type',
        }
      default:
        return baseData
    }
  }

  // Utility methods
  private shouldExcludeFile(file: string): boolean {
    return this.config.excludePatterns.some((pattern) => file.includes(pattern))
  }

  private extractClassName(content: string): string {
    const match = content.match(/export class (\w+)/)
    return match ? match[1] : 'Unknown'
  }

  private extractOperationType(sqlText: string): SQLOperation['operation'] {
    const upperText = sqlText.toUpperCase()
    if (upperText.includes('SELECT')) return 'SELECT'
    if (upperText.includes('INSERT')) return 'INSERT'
    if (upperText.includes('UPDATE')) return 'UPDATE'
    if (upperText.includes('DELETE')) return 'DELETE'
    if (upperText.includes('CREATE')) return 'CREATE'
    if (upperText.includes('DROP')) return 'DROP'
    return 'SELECT' // default
  }

  private extractTableName(sqlText: string): string {
    const patterns = [/(?:FROM|INTO|UPDATE|TABLE|JOIN)\s+`?(\w+)`?/i, /(?:INTO|UPDATE)\s+`?(\w+)`?/i]

    for (const pattern of patterns) {
      const match = pattern.exec(sqlText)
      if (match) return match[1]
    }

    return 'unknown'
  }

  private extractMethodName(content: string, lineIndex: number): string {
    const lines = content.split('\n')

    // Look backwards for method definition
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i].trim()
      const methodMatch = line.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/)
      if (methodMatch) return methodMatch[1]
    }

    return 'unknown'
  }

  private groupOperationsByTable(): Record<string, SQLOperation[]> {
    return this.sqlOperations.reduce(
      (groups, op) => {
        const table = op.table || 'unknown'
        if (!groups[table]) groups[table] = []
        groups[table].push(op)
        return groups
      },
      {} as Record<string, SQLOperation[]>,
    )
  }

  private markOperationsAsCovered(operationKeys: string[]): void {
    for (const key of operationKeys) {
      const operation = this.sqlOperations.find((op) => `${op.file}:${op.line}` === key)
      if (operation) operation.isCovered = true
    }
  }

  private identifyCoveredOperations(testCase: SQLTestCase): string[] {
    // Match test case to SQL operations based on expected tables and operations
    return this.sqlOperations
      .filter((op) => testCase.expectedTables.includes(op.table) && testCase.expectedOperations.includes(op.operation))
      .map((op) => `${op.file}:${op.line}`)
  }

  private identifyMissingAPIs(uncoveredOperations: SQLOperation[]): MissingAPI[] {
    const missingAPIs: MissingAPI[] = []
    const operationsByTable = this.groupBy(uncoveredOperations, (op) => op.table)

    for (const [table, operations] of Object.entries(operationsByTable)) {
      const entityName = this.tableToEntityName(table)
      const operationTypes = new Set(operations.map((op) => op.operation))

      for (const operationType of operationTypes) {
        const crudMap = {
          INSERT: 'CREATE',
          SELECT: 'READ',
          UPDATE: 'UPDATE',
          DELETE: 'DELETE',
        } as const

        const crudOperation = crudMap[operationType as keyof typeof crudMap]
        if (crudOperation) {
          missingAPIs.push({
            entity: entityName,
            operation: crudOperation,
            priority: this.determinePriority(table, operationType, operations.length),
            suggestedAPI: this.suggestAPIName(entityName, crudOperation),
            rationale: `${operations.filter((op) => op.operation === operationType).length} uncovered ${operationType} operations found`,
          })
        }
      }
    }

    return missingAPIs
  }

  private determinePriority(table: string, operation: string, count: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    const criticalTables = ['nodes', 'tables', 'attributes', 'relations']
    const criticalOperations = ['SELECT', 'INSERT']

    if (criticalTables.includes(table) && criticalOperations.includes(operation)) return 'HIGH'
    if (count > 5) return 'HIGH'
    if (count > 2) return 'MEDIUM'
    return 'LOW'
  }

  private suggestAPIName(entityName: string, operation: string): string {
    const operationMap = {
      CREATE: `create${entityName}`,
      READ: `get${entityName} / search${entityName}s`,
      UPDATE: `update${entityName}`,
      DELETE: `delete${entityName}`,
    }
    return operationMap[operation as keyof typeof operationMap] || `${operation.toLowerCase()}${entityName}`
  }

  private generateRecommendations(uncoveredOperations: SQLOperation[], coveragePercentage: number): string[] {
    const recommendations: string[] = []

    if (coveragePercentage < this.config.coverageThreshold) {
      recommendations.push(
        `Coverage is ${coveragePercentage.toFixed(1)}% (target: ${this.config.coverageThreshold}%) - add missing API operations`,
      )
    }

    const operationsByTable = this.groupBy(uncoveredOperations, (op) => op.table)
    const problematicTables = Object.entries(operationsByTable)
      .filter(([_, ops]) => ops.length > 3)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 3)

    for (const [table, operations] of problematicTables) {
      recommendations.push(`Table '${table}' has ${operations.length} uncovered operations - prioritize API completion`)
    }

    if (uncoveredOperations.some((op) => op.operation === 'UPDATE')) {
      recommendations.push('Missing UPDATE operations detected - add comprehensive update mutations')
    }

    if (uncoveredOperations.some((op) => op.operation === 'DELETE')) {
      recommendations.push('Missing DELETE operations detected - implement cascade deletion APIs')
    }

    return recommendations
  }

  private async setupTestData(_data: any[]): Promise<void> {
    // Setup test data in database
    // This would implement actual data insertion logic
  }

  private async cleanupTestData(): Promise<void> {
    // Clean up test data
    // This would implement cleanup logic
  }

  private async runAssertions(
    assertions: TestAssertion[],
    data: any,
  ): Promise<Array<{ success: boolean; error?: string }>> {
    const results: Array<{ success: boolean; error?: string }> = []

    for (const assertion of assertions) {
      try {
        const result = await this.runSingleAssertion(assertion, data)
        results.push({ success: result })
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Assertion failed',
        })
      }
    }

    return results
  }

  private async runSingleAssertion(assertion: TestAssertion, data: any): Promise<boolean> {
    switch (assertion.type) {
      case 'response':
        return this.checkResponseAssertion(assertion, data)
      case 'database':
        return this.checkDatabaseAssertion(assertion)
      case 'performance':
        return this.checkPerformanceAssertion(assertion)
      default:
        return false
    }
  }

  private checkResponseAssertion(assertion: TestAssertion, data: any): boolean {
    const value = this.getNestedValue(data, assertion.target)

    switch (assertion.condition) {
      case 'equals':
        return value === assertion.value
      case 'contains':
        return Array.isArray(value) ? value.includes(assertion.value) : false
      case 'exists':
        return value !== undefined && value !== null
      case 'greater_than':
        return typeof value === 'number' && value > assertion.value
      case 'less_than':
        return typeof value === 'number' && value < assertion.value
      default:
        return false
    }
  }

  private checkDatabaseAssertion(_assertion: TestAssertion): boolean {
    // Implement database assertion logic
    return true // Placeholder
  }

  private checkPerformanceAssertion(_assertion: TestAssertion): boolean {
    // Implement performance assertion logic
    return true // Placeholder
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private groupBy<T, K extends string | number | symbol>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item)
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
        return groups
      },
      {} as Record<K, T[]>,
    )
  }

  private printCoverageReport(report: CoverageReport): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 SQL COVERAGE ANALYSIS REPORT')
    console.log('='.repeat(60))

    console.log(`\n📈 Coverage Statistics:`)
    console.log(`   Total SQL Operations: ${report.totalOperations}`)
    console.log(`   Covered Operations: ${report.coveredOperations}`)
    console.log(`   Coverage Percentage: ${report.coveragePercentage.toFixed(1)}%`)
    console.log(`   Target Threshold: ${this.config.coverageThreshold}%`)

    const status = report.coveragePercentage >= this.config.coverageThreshold ? '✅ PASSED' : '❌ FAILED'
    console.log(`   Status: ${status}`)

    if (report.missingAPIs.length > 0) {
      console.log(`\n🚨 Missing APIs (${report.missingAPIs.length}):`)
      report.missingAPIs
        .sort((a, b) => {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        })
        .forEach((api) => {
          const priorityIcon = api.priority === 'HIGH' ? '🔥' : api.priority === 'MEDIUM' ? '⚠️' : 'ℹ️'
          console.log(`   ${priorityIcon} ${api.entity}.${api.operation}: ${api.suggestedAPI}`)
          console.log(`      Rationale: ${api.rationale}`)
        })
    }

    if (report.uncoveredOperations.length > 0) {
      console.log(`\n🔍 Uncovered Operations (showing top 10):`)
      report.uncoveredOperations.slice(0, 10).forEach((op) => {
        console.log(`   ${op.operation} ${op.table} in ${op.method} (${op.file}:${op.line})`)
      })
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`)
      report.recommendations.forEach((rec) => {
        console.log(`   - ${rec}`)
      })
    }

    console.log(`\n${'='.repeat(60)}`)
  }

  async cleanup(): Promise<void> {
    this.database?.close()
  }
}

// Export configuration and factory function
export function createSQLCoverageFramework(config: Partial<SQLCoverageConfig> = {}): SQLCoverageTestFramework {
  const defaultConfig: SQLCoverageConfig = {
    testDatabase: ':memory:',
    // Use a path that doesn't exist to trigger schema generation from distributed files
    schemaPath: join(process.cwd(), 'src/presentation/graphql/schema'),
    repositoryPaths: ['src/infrastructure/database/sqlite/**/*.ts'],
    excludePatterns: ['.test.', '.spec.', 'node_modules'],
    coverageThreshold: 85,
    maxComplexity: 10,
  }

  return new SQLCoverageTestFramework({ ...defaultConfig, ...config })
}
