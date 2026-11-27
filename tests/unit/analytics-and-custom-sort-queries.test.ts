import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { graphql, type GraphQLSchema } from 'graphql'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { DatabaseTokens, GraphQLTokens, RepositoryTokens } from '@/infrastructure/container/tokens/index.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import type { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { GraphQLSchemaBuilder } from '@/presentation/graphql/GraphQLSchemaBuilder.js'
import type { TemplateMutations } from '@/presentation/graphql/mutations/TemplateMutations.js'

const SCHEMA_SQL = readFileSync(resolve(import.meta.dirname, '../../scripts/database/schema.sql'), 'utf8')

interface GqlResult<T = Record<string, unknown>> {
  data?: T
  errors?: readonly { message: string }[]
}

async function execGql<T = Record<string, unknown>>(
  schema: GraphQLSchema,
  source: string,
  variableValues: Record<string, unknown> = {},
): Promise<GqlResult<T>> {
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: {
      requestId: 'analytics-test',
      startTime: new Date(),
      requestCache: new Map(),
    },
  })
  return result as GqlResult<T>
}

describe('Track 2: Remaining 12 Unwired GraphQL Queries & Schema Completeness', () => {
  let container: DIContainer
  let schema: GraphQLSchema

  beforeEach(async () => {
    container = await createTestContainer()
    const db = (await container.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
    applyDatabaseMigrations(db, createDatabaseMigrations(SCHEMA_SQL))
    schema = await new GraphQLSchemaBuilder(container).build()
    const templateMutations = (await container.resolve(GraphQLTokens.TEMPLATE_MUTATIONS)) as TemplateMutations
    templateMutations.setSchema(schema)
  })

  afterEach(async () => {
    await container.dispose()
  })

  test('wires 100% of real Query and Mutation SDL fields in root-resolvers', () => {
    const typesArray = loadFilesSync(resolve(import.meta.dirname, '../../src/presentation/graphql/schema'), {
      extensions: ['graphql'],
      recursive: true,
    })
    const doc = mergeTypeDefs(typesArray)
    const rootCode = readFileSync(
      resolve(import.meta.dirname, '../../src/presentation/graphql/resolvers/root-resolvers.ts'),
      'utf8',
    )

    for (const opType of ['Query', 'Mutation'] as const) {
      const fields = new Set<string>()
      for (const def of doc.definitions) {
        if (
          (def.kind === 'ObjectTypeDefinition' || def.kind === 'ObjectTypeExtension') &&
          def.name.value === opType
        ) {
          for (const field of def.fields ?? []) {
            if (field.name.value !== '_empty' && field.name.value !== '_schema') {
              fields.add(field.name.value)
            }
          }
        }
      }
      const missing = [...fields].filter((field) => !new RegExp(`\\b${field}\\s*[:(]`).test(rootCode))
      expect(missing).toEqual([])
    }
  })

  test('exposes customSortFunctions and customSortFunction from CustomSortFunctionRegistry', async () => {
    const res = await execGql<{
      allFns: Array<{
        id: string
        name: string
        supportedDataTypes: string[]
        priority: number
        parameters: Array<{ name: string; type: string }>
        examples: Array<{ title: string; direction: string }>
      }>
      stringFns: Array<{ id: string }>
      naturalOnly: { id: string; priority: number } | null
      missingFn: { id: string } | null
    }>(
      schema,
      `query {
        allFns: customSortFunctions {
          id name supportedDataTypes priority
          parameters { name type }
          examples { title direction }
        }
        stringFns: customSortFunctions(dataType: STRING, search: "length", tags: ["length"]) {
          id
        }
        naturalOnly: customSortFunction(functionId: "natural-string") {
          id priority
        }
        missingFn: customSortFunction(functionId: "does-not-exist") {
          id
        }
      }`,
    )

    expect(res.errors).toBeUndefined()
    expect(res.data?.allFns.length).toBeGreaterThanOrEqual(4)
    expect(res.data?.stringFns.map((f) => f.id)).toEqual(['length-sort'])
    expect(res.data?.naturalOnly).toEqual({ id: 'natural-string', priority: 60 })
    expect(res.data?.missingFn).toBeNull()
  })

  test('executes nodeAttributeAnalytics, attributeValueDistribution, attributeCompleteness, and nodeWithTypedAttributes', async () => {
    const typesRes = await execGql<{
      attributeTypes: { attributeTypes: Array<{ id: string; identifier: string }> }
    }>(schema, `query { attributeTypes(pagination: { limit: 50 }) { attributeTypes { id identifier } } }`)
    const typeIdByIdent = new Map(
      (typesRes.data?.attributeTypes.attributeTypes ?? []).map((t) => [t.identifier, t.id]),
    )

    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "typed_catalog", name: "Typed Catalog" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    const skuAttrRes = await execGql<{ createAttribute: { attribute: { id: string } } }>(
      schema,
      `mutation($t: ID!, $at: ID!) {
        createAttribute(input: { tableId: $t, identifier: "sku", name: "SKU", attributeTypeId: $at }) {
          attribute { id }
        }
      }`,
      { t: tableId, at: typeIdByIdent.get('string') },
    )
    const priceAttrRes = await execGql<{ createAttribute: { attribute: { id: string } } }>(
      schema,
      `mutation($t: ID!, $at: ID!) {
        createAttribute(input: { tableId: $t, identifier: "price", name: "Price", attributeTypeId: $at }) {
          attribute { id }
        }
      }`,
      { t: tableId, at: typeIdByIdent.get('number') },
    )
    const catAttrRes = await execGql<{ createAttribute: { attribute: { id: string } } }>(
      schema,
      `mutation($t: ID!, $at: ID!) {
        createAttribute(input: { tableId: $t, identifier: "category", name: "Category", attributeTypeId: $at }) {
          attribute { id }
        }
      }`,
      { t: tableId, at: typeIdByIdent.get('string') },
    )

    const skuId = skuAttrRes.data?.createAttribute.attribute.id ?? ''
    const priceId = priceAttrRes.data?.createAttribute.attribute.id ?? ''
    const catId = catAttrRes.data?.createAttribute.attribute.id ?? ''
    expect(skuId).toBeTruthy()
    expect(priceId).toBeTruthy()
    expect(catId).toBeTruthy()

    const n1Res = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($t: ID!) {
        createNode(input: { tableId: $t, content: "Item 1" }) { node { id } }
      }`,
      { t: tableId },
    )
    const n2Res = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($t: ID!) {
        createNode(input: { tableId: $t, content: "Item 2" }) { node { id } }
      }`,
      { t: tableId },
    )
    const n1Id = n1Res.data?.createNode.node.id ?? ''
    const n2Id = n2Res.data?.createNode.node.id ?? ''

    await execGql(
      schema,
      `mutation($n: ID!, $attrs: [NodeAttributeInput!]!) {
        bulkSetNodeAttributes(nodeId: $n, attributes: $attrs) { success }
      }`,
      {
        n: n1Id,
        attrs: [
          { attributeId: skuId, value: 'SKU-01' },
          { attributeId: priceId, value: '120' },
          { attributeId: catId, value: 'hardware' },
        ],
      },
    )
    await execGql(
      schema,
      `mutation($n: ID!, $attrs: [NodeAttributeInput!]!) {
        bulkSetNodeAttributes(nodeId: $n, attributes: $attrs) { success }
      }`,
      {
        n: n2Id,
        attrs: [{ attributeId: catId, value: 'hardware' }],
      },
    )

    const db = (await container.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
    db.run('UPDATE attributes SET is_required = 1 WHERE id IN (?, ?)', [skuId, priceId])

    const attrAnalyticsRes = await execGql<{
      nodeAttributeAnalytics: {
        totalNodes: number
        totalAttributes: number
        completenessPercentage: number
        attributeStats: Array<{ identifier: string; totalValues: number; uniqueValues: number }>
        typeDistribution: Array<{ jsonType: string; usageCount: number }>
        valueRanges: Array<{ identifier: string; minValue: string | null; maxValue: string | null }>
      }
      attributeValueDistribution: Array<{ value: string; count: number; percentage: number }>
      attributeCompleteness: {
        totalNodes: number
        totalRequiredAttributes: number
        totalOptionalAttributes: number
        completeNodes: number
        incompleteNodes: number
        completenessRate: number
      }
      n1Typed: {
        content: string
        completenessScore: number
        typedAttributes: Array<{ parsedValue: unknown; isValid: boolean; attribute: { identifier: string } }>
        missingRequiredAttributes: Array<{ identifier: string }>
      } | null
      n2Typed: {
        completenessScore: number
        missingRequiredAttributes: Array<{ identifier: string }>
      } | null
    }>(
      schema,
      `query($t: ID!, $catId: ID!, $n1: ID!, $n2: ID!) {
        nodeAttributeAnalytics(tableId: $t) {
          totalNodes
          totalAttributes
          completenessPercentage
          attributeStats { identifier totalValues uniqueValues }
          typeDistribution { jsonType usageCount }
          valueRanges { identifier minValue maxValue }
        }
        attributeValueDistribution(attributeId: $catId, groupBy: VALUE) {
          value count percentage
        }
        attributeCompleteness(tableId: $t) {
          totalNodes totalRequiredAttributes totalOptionalAttributes completeNodes incompleteNodes completenessRate
        }
        n1Typed: nodeWithTypedAttributes(nodeId: $n1) {
          content
          completenessScore
          typedAttributes { parsedValue isValid attribute { identifier } }
          missingRequiredAttributes { identifier }
        }
        n2Typed: nodeWithTypedAttributes(nodeId: $n2) {
          completenessScore
          missingRequiredAttributes { identifier }
        }
      }`,
      { t: tableId, catId, n1: n1Id, n2: n2Id },
    )

    expect(attrAnalyticsRes.errors).toBeUndefined()
    expect(attrAnalyticsRes.data?.nodeAttributeAnalytics.totalNodes).toBe(2)
    expect(attrAnalyticsRes.data?.nodeAttributeAnalytics.totalAttributes).toBe(3)
    expect(attrAnalyticsRes.data?.attributeValueDistribution).toEqual([
      { value: 'hardware', count: 2, percentage: 100 },
    ])
    expect(attrAnalyticsRes.data?.attributeCompleteness).toEqual({
      totalNodes: 2,
      totalRequiredAttributes: 2,
      totalOptionalAttributes: 1,
      completeNodes: 1,
      incompleteNodes: 1,
      completenessRate: 50,
    })
    expect(attrAnalyticsRes.data?.n1Typed?.completenessScore).toBe(100)
    expect(attrAnalyticsRes.data?.n1Typed?.missingRequiredAttributes).toEqual([])
    const priceTyped = attrAnalyticsRes.data?.n1Typed?.typedAttributes.find(
      (a) => a.attribute.identifier === 'price',
    )
    expect(priceTyped?.parsedValue).toBe(120)
    expect(priceTyped?.isValid).toBe(true)
    expect(attrAnalyticsRes.data?.n2Typed?.missingRequiredAttributes.map((a) => a.identifier).sort()).toEqual([
      'price',
      'sku',
    ])
  })

  test('tracks real template executions and resolves all 6 template performance analytics queries', async () => {
    const tpl1Res = await execGql<{ createTemplate: { success: boolean; template: { id: string } } }>(
      schema,
      `mutation {
        createTemplate(input: {
          identifier: "fast_tables_tpl"
          name: "Fast Tables"
          applicableTables: ["orders"]
          complexityScore: 2
          query: "query FastTables { tables { totalCount } }"
        }) { success template { id } }
      }`,
    )
    const tpl2Res = await execGql<{ createTemplate: { success: boolean; template: { id: string } } }>(
      schema,
      `mutation {
        createTemplate(input: {
          identifier: "orders_alt_tpl"
          name: "Orders Alternative"
          applicableTables: ["orders"]
          complexityScore: 8
          query: "query OrdersAlt { tables { totalCount } }"
        }) { success template { id } }
      }`,
    )
    const tpl1Id = tpl1Res.data?.createTemplate.template.id ?? ''
    const tpl2Id = tpl2Res.data?.createTemplate.template.id ?? ''
    expect(tpl1Id).toBeTruthy()
    expect(tpl2Id).toBeTruthy()

    // Execute tpl1 once through real GraphQL mutation -> writes to template_executions & updates usage_count trigger
    const exec1 = await execGql<{ executeTemplateWithGraphQL: { success: boolean } }>(
      schema,
      `mutation { executeTemplateWithGraphQL(templateIdentifier: "fast_tables_tpl") { success } }`,
    )
    expect(exec1.errors).toBeUndefined()
    expect(exec1.data?.executeTemplateWithGraphQL.success).toBe(true)

    // Seed historical slow and fast executions with known durations so thresholds/trends are deterministic
    const templateRepo = await container.resolve<IQueryTemplateRepository>(
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
    )
    await templateRepo.recordExecution?.({
      templateId: tpl1Id,
      executionTimeMs: 12,
      variablesUsed: { run: 2 },
      resultCount: 3,
      success: true,
      errorMessage: null,
      userContext: 'analyst-1',
    })
    await templateRepo.recordExecution?.({
      templateId: tpl2Id,
      executionTimeMs: 640,
      variablesUsed: { heavy: true },
      resultCount: 5,
      success: true,
      errorMessage: null,
      userContext: 'analyst-2',
    })

    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const end = new Date(Date.now() + 60 * 1000).toISOString()

    const perfRes = await execGql<{
      templatePerformanceAnalytics: {
        totalTemplates: number
        activeTemplates: number
        totalExecutions: number
        successRate: number
        performanceDistribution: { fast: number; medium: number; slow: number; percentiles: { p50: number } }
        usagePatterns: {
          mostUsedTemplates: Array<{ template: { identifier: string }; usageCount: number }>
          operationTypeDistribution: Array<{ operationType: string; count: number }>
        }
        recentMetrics: { last24Hours: { totalExecutions: number } }
      }
      getHotQueries: Array<{ usageRank: number; template: { identifier: string } }>
      getTemplateExecutionHistory: {
        totalCount: number
        edges: Array<{ node: { template: { identifier: string }; executionTimeMs: number } }>
      }
      getTemplatePerformanceTrends: Array<{ templateId: string; executionCount: number; movingAverage: number }>
      getSlowQueries: Array<{
        template: { identifier: string }
        slowExecutionCount: number
        optimizationSuggestions: string[]
      }>
      getTemplateRecommendations: Array<{
        template: { identifier: string }
        score: number
        reason: string
      }>
    }>(
      schema,
      `query($tpl1Id: ID!, $tpl2Id: ID!, $start: DateTime!, $end: DateTime!) {
        templatePerformanceAnalytics {
          totalTemplates
          activeTemplates
          totalExecutions
          successRate
          performanceDistribution { fast medium slow percentiles { p50 } }
          usagePatterns {
            mostUsedTemplates { template { identifier } usageCount }
            operationTypeDistribution { operationType count }
          }
          recentMetrics { last24Hours { totalExecutions } }
        }
        getHotQueries(limit: 5, performanceThreshold: 150, usageThreshold: 2) {
          usageRank
          template { identifier }
        }
        getTemplateExecutionHistory(templateId: $tpl1Id, pagination: { limit: 10, offset: 0 }) {
          totalCount
          edges { node { template { identifier } executionTimeMs } }
        }
        getTemplatePerformanceTrends(
          templateIds: [$tpl1Id]
          timeRange: { start: $start, end: $end }
          granularity: HOUR
        ) {
          templateId
          executionCount
          movingAverage
        }
        getSlowQueries(threshold: 500, limit: 10) {
          template { identifier }
          slowExecutionCount
          optimizationSuggestions
        }
        getTemplateRecommendations(
          context: { currentTemplate: $tpl2Id, tableIds: ["orders"], operationType: QUERY }
          limit: 5
        ) {
          template { identifier }
          score
          reason
        }
      }`,
      { tpl1Id, tpl2Id, start, end },
    )

    expect(perfRes.errors).toBeUndefined()
    expect(perfRes.data?.templatePerformanceAnalytics.totalTemplates).toBeGreaterThanOrEqual(2)
    expect(perfRes.data?.templatePerformanceAnalytics.totalExecutions).toBe(3)
    expect(perfRes.data?.templatePerformanceAnalytics.performanceDistribution.fast).toBe(2)
    expect(perfRes.data?.templatePerformanceAnalytics.performanceDistribution.slow).toBe(1)
    expect(perfRes.data?.templatePerformanceAnalytics.recentMetrics.last24Hours.totalExecutions).toBe(3)
    expect(perfRes.data?.getHotQueries.map((h) => h.template.identifier)).toEqual(['fast_tables_tpl'])
    expect(perfRes.data?.getTemplateExecutionHistory.totalCount).toBe(2)
    expect(perfRes.data?.getTemplatePerformanceTrends[0]?.templateId).toBe(tpl1Id)
    expect(perfRes.data?.getSlowQueries.map((s) => s.template.identifier)).toEqual(['orders_alt_tpl'])
    expect(perfRes.data?.getSlowQueries[0]?.slowExecutionCount).toBe(1)
    expect(perfRes.data?.getTemplateRecommendations[0]?.template.identifier).toBe('fast_tables_tpl')
  })

  test('resolves getActiveDoc, getDocs, and searchDocs with DocsFilter SDL input', async () => {
    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "docs_filter_tbl", name: "Docs Filter" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    await execGql(
      schema,
      `mutation($t: ID!) { createDoc(input: { tableId: $t, category: usage, content: "Usage guide" }) { success doc { id } } }`,
      { t: tableId },
    )
    await execGql(
      schema,
      `mutation($t: ID!) { createDoc(input: { tableId: $t, category: spec, content: "Spec contract" }) { success doc { id } } }`,
      { t: tableId },
    )

    const docsRes = await execGql<{
      active: { version: number; category: string; content: string } | null
      listed: { totalCount: number; docs: Array<{ category: string }> }
      searched: { totalCount: number; docs: Array<{ category: string; version: number }> }
    }>(
      schema,
      `query($t: ID!) {
        active: getActiveDoc(tableId: $t, category: usage) {
          version
          category
          content
        }
        listed: getDocs(tableId: $t, filter: { category: usage, isActive: true }) {
          totalCount
          docs { category }
        }
        searched: searchDocs(filter: { tableId: $t, category: usage, isActive: true }) {
          totalCount
          docs { category version }
        }
      }`,
      { t: tableId },
    )

    expect(docsRes.errors).toBeUndefined()
    expect(docsRes.data?.active?.version).toBe(1)
    expect(docsRes.data?.active?.content).toBe('Usage guide')
    expect(docsRes.data?.listed.totalCount).toBe(1)
    expect(docsRes.data?.listed.docs.map((d) => d.category)).toEqual(['usage'])
    expect(docsRes.data?.searched.totalCount).toBe(1)
    expect(docsRes.data?.searched.docs[0]).toEqual({ category: 'usage', version: 1 })
  })
})
