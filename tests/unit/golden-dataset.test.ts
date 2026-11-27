import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { AccessControl } from '@/application/security/AccessControl.js'
import { createPortableGraphNode } from '@/infrastructure/container/PortableBootstrap.js'
import type {
  DoSqlStorageCursor,
  DoStorageLike,
} from '@/infrastructure/database/sqlite/DoSqliteAdapter.js'
import { Database as NodeSqliteDatabase } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { CLOUDFLARE_DO_HARD_PARAM_LIMIT } from '@/infrastructure/database/sqlite/SqlitePort.js'
import { createCloudflareDurableObjectNode } from '@/presentation/cloudflare/CloudflareSingleNodeWorker.js'
import {
  collectGoldenIdMapFromExistingNode,
  loadGoldenDataset,
  loadGoldenExpected,
  runGoldenGraphQL,
  seedGoldenDataset,
  verifyGoldenDatasetOnNode,
} from '../fixtures/golden/golden-loader.js'

const FORBIDDEN_DO_PRAGMAS = new Set([
  'journal_mode',
  'wal_autocheckpoint',
  'mmap_size',
  'synchronous',
  'busy_timeout',
  'cache_size',
  'temp_store',
  'user_version',
])

function toSqlInput(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    ArrayBuffer.isView(value)
  ) {
    return value as SQLInputValue
  }
  return String(value)
}

function isRowReturningSql(query: string): boolean {
  return (
    /^\s*(?:select|pragma|with|explain)\b/i.test(query) ||
    /\breturning\b/i.test(query)
  )
}

function createStrictDoMockStorage(): DoStorageLike & { close(): void } {
  const raw = new DatabaseSync(':memory:')
  let txActive = false

  return {
    sql: {
      exec: <TRow = Record<string, unknown>>(
        query: string,
        ...bindings: unknown[]
      ): DoSqlStorageCursor<TRow> => {
        if (bindings.length > CLOUDFLARE_DO_HARD_PARAM_LIMIT) {
          throw new Error(`DO parameter ceiling exceeded: ${bindings.length}`)
        }
        for (const forbidden of FORBIDDEN_DO_PRAGMAS) {
          if (new RegExp(`pragma\\s+${forbidden}\\b`, 'i').test(query)) {
            throw new Error(`Forbidden DO PRAGMA: ${forbidden}`)
          }
        }
        const normalized = bindings.map(toSqlInput)
        let rows: TRow[] = []
        let rowsWritten = 0
        if (normalized.length === 0 && !isRowReturningSql(query)) {
          raw.exec(query)
        } else {
          const stmt = raw.prepare(query)
          if (isRowReturningSql(query)) {
            rows = stmt.all(...normalized) as TRow[]
          } else {
            rowsWritten = Number(stmt.run(...normalized).changes)
          }
        }
        return {
          rowsRead: rows.length,
          rowsWritten,
          toArray: () => rows,
          one: () => {
            if (rows.length === 0) throw new Error('Expected one row')
            return rows[0] as TRow
          },
          [Symbol.iterator]: () => rows[Symbol.iterator](),
        }
      },
    },
    transactionSync<T>(callback: () => T): T {
      if (txActive) throw new Error('Nested top-level transactionSync')
      txActive = true
      raw.exec('BEGIN IMMEDIATE')
      try {
        const result = callback()
        raw.exec('COMMIT')
        return result
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      } finally {
        txActive = false
      }
    },
    close(): void {
      raw.close()
    },
  }
}

describe('Core Golden Test Dataset', () => {
  const dataset = loadGoldenDataset()
  const expected = loadGoldenExpected()

  test('verifies all 10 core feature domains, SchemaGate, Hierarchy mutations, REST parity, MCP 2026-07-28, and AccessControl on Node 26 SQLite', async () => {
    const bridgeToken = 'golden-internal-bridge-token-1234567890'
    const accessControl = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN: bridgeToken,
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        'docs-reader': {
          id: 'golden-docs-ro',
          role: 'reader',
          tableIds: ['golden_knowledge_docs'],
        },
        'org-writer': {
          id: 'golden-org-rw',
          role: 'writer',
          tableIds: ['golden_org_hierarchy'],
        },
        'platform-admin': {
          id: 'golden-admin',
          role: 'admin',
          tableIds: ['*'],
        },
      }),
    })

    const db = new NodeSqliteDatabase(':memory:')
    const node = await createPortableGraphNode(db, {
      databaseLabel: ':golden:node26:',
      internalBridgeToken: bridgeToken,
    })

    try {
      const ids = await seedGoldenDataset(node, dataset)
      await verifyGoldenDatasetOnNode(node, ids, expected)

      const docsTableId = ids.tables.knowledge_docs ?? ''
      const docsNodes = ids.nodes.knowledge_docs ?? {}
      const orgNodes = ids.nodes.org_hierarchy ?? {}
      const docsAttrs = ids.attributes.knowledge_docs ?? {}

      // SchemaGate rejects invalid integer type atomically
      const badPatch = await runGoldenGraphQL<{
        bulkSetNodeAttributes: { success: boolean; errors: Array<{ code: string }> }
      }>(
        node,
        `mutation($nodeId: ID!, $attributeId: ID!) {
          bulkSetNodeAttributes(nodeId: $nodeId, attributes: [{ attributeId: $attributeId, value: "not-an-integer" }]) {
            success
            errors { code }
          }
        }`,
        { nodeId: docsNodes.doc_bfs, attributeId: docsAttrs.priority },
      )
      expect(badPatch.bulkSetNodeAttributes.success).toBe(false)

      // SchemaGate rejects createNode when required attributes are missing
      const missingRequiredCreate = await runGoldenGraphQL<{
        createNode: { success: boolean; errors: Array<{ code: string }> }
      }>(
        node,
        `mutation($tableId: ID!) {
          createNode(input: { tableId: $tableId, content: "Missing required attrs node" }) {
            success
            errors { code }
          }
        }`,
        { tableId: docsTableId },
      )
      expect(missingRequiredCreate.createNode.success).toBe(false)

      // moveHierarchyNode rejects cycle-forming move and preserves valid move + restore
      const cycleMove = await runGoldenGraphQL<{
        moveHierarchyNode: { success: boolean; errors: Array<{ code: string }> }
      }>(
        node,
        `mutation($nodeId: ID!, $newParentId: ID!) {
          moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $newParentId }) {
            success
            errors { code }
          }
        }`,
        { nodeId: orgNodes.eng, newParentId: orgNodes.storage },
      )
      expect(cycleMove.moveHierarchyNode.success).toBe(false)
      expect(cycleMove.moveHierarchyNode.errors[0]?.code).toBe('VALIDATION_ERROR')

      const validMove = await runGoldenGraphQL<{
        moveHierarchyNode: { success: boolean; node: { id: string } | null }
      }>(
        node,
        `mutation($nodeId: ID!, $newParentId: ID!) {
          moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $newParentId }) {
            success
            node { id }
          }
        }`,
        { nodeId: orgNodes.runtime, newParentId: orgNodes.ai },
      )
      expect(validMove.moveHierarchyNode.success).toBe(true)
      expect(validMove.moveHierarchyNode.node?.id).toBe(orgNodes.runtime)

      await runGoldenGraphQL(
        node,
        `mutation($nodeId: ID!, $newParentId: ID!) {
          moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $newParentId }) {
            success
          }
        }`,
        { nodeId: orgNodes.runtime, newParentId: orgNodes.platform },
      )

      // Template execution & telemetry analytics
      const tplExec = await runGoldenGraphQL<{
        executeTemplateWithGraphQL: { success: boolean }
      }>(
        node,
        `mutation($tableId: ID!) {
          executeTemplateWithGraphQL(templateIdentifier: "golden-search-docs", variables: { tableId: $tableId, search: "dijkstra" }) {
            success
          }
        }`,
        { tableId: docsTableId },
      )
      expect(tplExec.executeTemplateWithGraphQL.success).toBe(true)

      const tplAnalytics = await runGoldenGraphQL<{
        templatePerformanceAnalytics: { totalTemplates: number; totalExecutions: number }
      }>(
        node,
        `query {
          templatePerformanceAnalytics {
            totalTemplates
            totalExecutions
          }
        }`,
      )
      expect(tplAnalytics.templatePerformanceAnalytics.totalTemplates).toBeGreaterThanOrEqual(2)
      expect(tplAnalytics.templatePerformanceAnalytics.totalExecutions).toBeGreaterThanOrEqual(1)

      // Newly aligned REST routes (template export, relations search, strict invalid node patch)
      const [tplExportResp, relSearchResp, badNodePatchResp] = await Promise.all([
        node.fetch(new Request('http://localhost/api/templates/golden-search-docs/export')),
        node.fetch(new Request(`http://localhost/api/relations/search?tableId=${docsTableId}`)),
        node.fetch(
          new Request('http://localhost/api/nodes/1/unexpected-suffix', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }),
        ),
      ])
      expect(tplExportResp.status).toBe(200)
      expect(relSearchResp.status).toBe(200)
      expect(badNodePatchResp.status).toBe(404)

      const tplExportJson = (await tplExportResp.json()) as {
        success: boolean
        data: {
          exportData: { template: { query: string; tags: string[] } }
          templateExport: { version: string; template: { identifier: string; query: string } }
        }
      }
      expect(tplExportJson.success).toBe(true)
      expect(tplExportJson.data.exportData.template.query).toContain('GoldenSearchDocs')
      expect(tplExportJson.data.exportData.template.query).not.toContain('placeholder')

      const tplImportResp = await node.fetch(
        new Request('http://localhost/api/templates/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonData: tplExportJson.data.templateExport,
            generateNewIdentifier: true,
            newIdentifierPrefix: 'imported-',
          }),
        }),
      )
      expect(tplImportResp.status).toBe(200)
      const tplImportJson = (await tplImportResp.json()) as {
        success: boolean
        data: { importResult: { success: boolean; templateIdentifier: string } }
      }
      expect(tplImportJson.success).toBe(true)
      expect(tplImportJson.data.importResult.success).toBe(true)
      expect(tplImportJson.data.importResult.templateIdentifier).toMatch(/^imported-.*golden-search-docs/)

      // MCP 2026-07-28 + 2025-11-25 LTS verification on golden endpoints
      const modernMeta = {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
      }
      const mcpList = await node.fetch(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'tools/list',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'golden-list',
            method: 'tools/list',
            params: { _meta: modernMeta },
          }),
        }),
      )
      expect(mcpList.status).toBe(200)
      const mcpListJson = (await mcpList.json()) as {
        result: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean }; outputSchema?: object }> }
      }
      const healthTool = mcpListJson.result.tools.find((t) => t.name === 'healthCheck')
      expect(healthTool?.annotations?.readOnlyHint).toBe(true)
      expect(healthTool?.outputSchema).toBeDefined()

      const subProjName = `get-openapi-projection-${docsTableId}`
      const subCall = await node.fetch(
        new Request(`http://localhost/sub/${docsTableId}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'tools/call',
            'Mcp-Name': subProjName,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'golden-sub-proj',
            method: 'tools/call',
            params: { _meta: modernMeta, name: subProjName, arguments: {} },
          }),
        }),
      )
      expect(subCall.status).toBe(200)
      const subCallJson = (await subCall.json()) as {
        result: { isError: boolean; structuredContent?: { validation?: { valid: boolean } } }
      }
      expect(subCallJson.result.isError).toBe(false)
      expect(subCallJson.result.structuredContent?.validation?.valid).toBe(true)

      // GraphQL-backed root MCP tools (e.g. list-backups, export-jsonl) execute through graphqlExecutor
      const mcpBackupDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-golden-mcp-jsonl-'))
      try {
        const listBackupsCall = await node.fetch(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'MCP-Protocol-Version': '2026-07-28',
              'Mcp-Method': 'tools/call',
              'Mcp-Name': 'list-backups',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'golden-list-backups',
              method: 'tools/call',
              params: { _meta: modernMeta, name: 'list-backups', arguments: {} },
            }),
          }),
        )
        expect(listBackupsCall.status).toBe(200)
        const listBackupsJson = (await listBackupsCall.json()) as {
          result: { isError: boolean; structuredContent?: { listBackups?: { totalCount: number } } }
        }
        expect(listBackupsJson.result.isError).toBe(false)
        expect(typeof listBackupsJson.result.structuredContent?.listBackups?.totalCount).toBe('number')

        const exportJsonlCall = await node.fetch(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'MCP-Protocol-Version': '2026-07-28',
              'Mcp-Method': 'tools/call',
              'Mcp-Name': 'export-jsonl',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'golden-mcp-export-jsonl',
              method: 'tools/call',
              params: {
                _meta: modernMeta,
                name: 'export-jsonl',
                arguments: { outputDir: mcpBackupDir, includeEmbeddings: true },
              },
            }),
          }),
        )
        expect(exportJsonlCall.status).toBe(200)
        const exportJsonlCallJson = (await exportJsonlCall.json()) as {
          result: {
            isError: boolean
            structuredContent?: { exportJsonl?: { success: boolean; stats: { embeddingsExported: number } } }
          }
        }
        expect(exportJsonlCallJson.result.isError).toBe(false)
        expect(exportJsonlCallJson.result.structuredContent?.exportJsonl?.success).toBe(true)
        expect(exportJsonlCallJson.result.structuredContent?.exportJsonl?.stats.embeddingsExported).toBe(8)
      } finally {
        rmSync(mcpBackupDir, { recursive: true, force: true })
      }

      // AccessControl enforcement on table-scoped REST & GraphQL routes
      const authedDb = new NodeSqliteDatabase(':memory:')
      const authedNode = await createPortableGraphNode(authedDb, {
        databaseLabel: ':golden:authed:',
        accessControl,
        internalBridgeToken: bridgeToken,
      })
      try {
        const authedIds = await seedGoldenDataset(authedNode, dataset)
        const authedDocsTableId = authedIds.tables.knowledge_docs ?? ''
        const authedOrgTableId = authedIds.tables.org_hierarchy ?? ''
        const docsAttrAllow = await authedNode.fetch(
          new Request(
            `http://localhost/api/attributes/tables/${authedDocsTableId}`,
            { headers: { Authorization: 'Bearer docs-reader' } },
          ),
        )
        expect(docsAttrAllow.status).toBe(200)

        const orgAttrHidden = await authedNode.fetch(
          new Request(
            `http://localhost/api/attributes/tables/${authedOrgTableId}`,
            { headers: { Authorization: 'Bearer docs-reader' } },
          ),
        )
        expect(orgAttrHidden.status).toBe(404)

        const orgWriteForbiddenForDocsReader = await authedNode.fetch(
          new Request('http://localhost/graphql', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer docs-reader',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `mutation { updateTable(id: "${authedOrgTableId}", input: { description: "blocked" }) { success } }`,
            }),
          }),
        )
        expect(orgWriteForbiddenForDocsReader.status).toBe(403)

        const docsWriteHiddenForOrgWriter = await authedNode.fetch(
          new Request('http://localhost/graphql', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer org-writer',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `mutation { createNode(input: { tableId: "${authedDocsTableId}", content: "cross-table-blocked" }) { success } }`,
            }),
          }),
        )
        expect(docsWriteHiddenForOrgWriter.status).toBe(404)
      } finally {
        await authedNode.dispose()
        authedDb.close()
      }
    } finally {
      await node.dispose()
      db.close()
    }
  })

  test('verifies identical golden results under Cloudflare Durable Object SQLite constraints', async () => {
    const storage = createStrictDoMockStorage()
    const doNode = createCloudflareDurableObjectNode(storage, {
      nodeKey: 'golden-do',
    })

    try {
      const node = await doNode.getNode()
      const ids = await seedGoldenDataset(node, dataset)
      await verifyGoldenDatasetOnNode(node, ids, expected)
    } finally {
      const initialized = await doNode.getNode()
      await initialized.dispose()
      doNode.database.close()
      storage.close()
    }
  })

  test('preserves all golden tables, schemas, attributes, relations, and embeddings across JSONL export/import round-trip', async () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-golden-jsonl-'))
    const srcDb = new NodeSqliteDatabase(':memory:')
    const srcNode = await createPortableGraphNode(srcDb, {
      databaseLabel: ':golden:jsonl-src:',
    })

    try {
      await seedGoldenDataset(srcNode, dataset)
      const exported = await runGoldenGraphQL<{
        exportJsonl: {
          success: boolean
          stats: { tablesExported: number; nodesExported: number; relationsExported: number; embeddingsExported: number }
        }
      }>(
        srcNode,
        `mutation($dir: String!) {
          exportJsonl(input: { outputDir: $dir, includeSchema: true, includeRelations: true, includeEmbeddings: true }) {
            success
            stats { tablesExported nodesExported relationsExported embeddingsExported }
          }
        }`,
        { dir: backupDir },
      )
      expect(exported.exportJsonl.success).toBe(true)
      expect(exported.exportJsonl.stats.tablesExported).toBe(3)
      expect(exported.exportJsonl.stats.nodesExported).toBe(21)
      expect(exported.exportJsonl.stats.relationsExported).toBe(19)
      expect(exported.exportJsonl.stats.embeddingsExported).toBe(8)

      const dstDb = new NodeSqliteDatabase(':memory:')
      const dstNode = await createPortableGraphNode(dstDb, {
        databaseLabel: ':golden:jsonl-dst:',
      })
      try {
        const imported = await runGoldenGraphQL<{
          importJsonl: {
            success: boolean
            stats: { tablesImported: number; nodesImported: number; relationsImported: number; embeddingsImported: number }
          }
        }>(
          dstNode,
          `mutation($dir: String!) {
            importJsonl(input: { inputDir: $dir, conflictResolution: OVERWRITE, validateSchema: true }) {
              success
              stats { tablesImported nodesImported relationsImported embeddingsImported }
            }
          }`,
          { dir: backupDir },
        )
        expect(imported.importJsonl.success).toBe(true)
        expect(imported.importJsonl.stats.nodesImported).toBe(21)
        expect(imported.importJsonl.stats.relationsImported).toBe(19)
        expect(imported.importJsonl.stats.embeddingsImported).toBe(8)

        const restoredIds = await collectGoldenIdMapFromExistingNode(dstNode, dataset)
        await verifyGoldenDatasetOnNode(dstNode, restoredIds, expected, {
          includeDocs: false,
        })
      } finally {
        await dstNode.dispose()
        dstDb.close()
      }
    } finally {
      await srcNode.dispose()
      srcDb.close()
      rmSync(backupDir, { recursive: true, force: true })
    }
  })
})
