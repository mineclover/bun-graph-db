import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, describe, expect, test } from 'vitest'
import {
  createDecisionLogArchitectureBlueprint,
  createKnowledgeArchitectureBlueprint,
  createProductSpecArchitectureBlueprint,
} from '@/application/blueprints/PresetBlueprints.js'
import type { InformationArchitectureBlueprint } from '@/application/services/InformationArchitectureService.js'
import {
  EmbeddingGemma2Provider,
  createDeterministicHashEmbeddingBackend,
} from '@/infrastructure/embeddings/EmbeddingGemma2Provider.js'
import type { SqliteBindPrimitive } from '@/infrastructure/database/sqlite/SqlitePort.js'
import type {
  SqlJsDatabaseLike,
  SqlJsStatementLike,
} from '@/infrastructure/database/sqlite/WebSqliteAdapter.js'
import {
  LATEST_MCP_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION_HEADER,
  MCP_SESSION_ID_HEADER,
} from '@/mcp/http-server/modern-protocol.js'
import { createEmbeddedWebGraphDb } from '@/presentation/web/EmbeddedWebGraphDb.js'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function toNodeSqlInput(val: unknown): SQLInputValue {
  if (val === undefined || val === null) return null
  if (typeof val === 'boolean') return val ? 1 : 0
  if (
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'bigint' ||
    ArrayBuffer.isView(val)
  ) {
    return val as SQLInputValue
  }
  return String(val)
}

function createPersistentSqlJsHarness(initialBytes?: Uint8Array): SqlJsDatabaseLike {
  const dir = mkdtempSync(join(tmpdir(), 'bun-graph-db-ia-'))
  tempDirs.push(dir)
  const dbPath = join(dir, 'live.sqlite')
  if (initialBytes) {
    writeFileSync(dbPath, initialBytes)
  }
  const raw = new DatabaseSync(dbPath)
  let lastModified = 0

  return {
    prepare(sql: string, initialParams?: readonly SqliteBindPrimitive[]): SqlJsStatementLike {
      const stmt = raw.prepare(sql)
      let bound: SQLInputValue[] = (initialParams ?? []).map(toNodeSqlInput)
      let rows: Record<string, unknown>[] | null = null
      let cursorIndex = -1

      const isRowQuery =
        /^\s*(?:select|pragma|with|explain)\b/i.test(sql) || /\breturning\b/i.test(sql)

      return {
        bind(values) {
          if (Array.isArray(values)) {
            bound = values.map(toNodeSqlInput)
          } else if (values && typeof values === 'object') {
            bound = Object.values(values).map(toNodeSqlInput)
          }
          rows = null
          cursorIndex = -1
          return true
        },
        step() {
          if (rows === null) {
            if (isRowQuery) {
              rows = stmt.all(...bound) as Record<string, unknown>[]
            } else {
              const info = stmt.run(...bound)
              lastModified = Number(info.changes)
              rows = []
            }
          }
          cursorIndex += 1
          return cursorIndex < rows.length
        },
        getAsObject() {
          return (rows?.[cursorIndex] ?? {}) as Record<string, unknown>
        },
        free() {
          return true
        },
      }
    },
    exec(sql: string) {
      raw.exec(sql)
    },
    getRowsModified() {
      return lastModified
    },
    export() {
      const snapshotPath = join(dir, `snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`)
      raw.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`)
      return new Uint8Array(readFileSync(snapshotPath))
    },
    close() {
      raw.close()
    },
  }
}

describe('Zero-Embedding Information Architecture, Blueprint Lifecycle, & MCP 2026-07-28 IA Tools', () => {
  test('persists iaKey across database export/reopen, computes dry-run diffs, upserts updates, and round-trips exportBlueprint', async () => {
    const db1 = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-persist-1:',
    })

    let snapshotBytes: Uint8Array | null = null
    try {
      const blueprint = createKnowledgeArchitectureBlueprint()
      const applied = await db1.ia.applyBlueprint(blueprint)
      expect(applied.embeddedNodeCount).toBe(0)
      expect(applied.relationsCreated).toBeGreaterThan(0)
      expect(applied.nodesUpdated).toBe(0)

      snapshotBytes = db1.exportDatabaseBytes()
      expect(snapshotBytes).not.toBeNull()
      expect((snapshotBytes ?? new Uint8Array()).byteLength).toBeGreaterThan(4096)
    } finally {
      await db1.dispose()
    }

    // Reopen into a completely fresh EmbeddedWebGraphDb instance with NO in-memory key cache
    const db2 = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(snapshotBytes ?? undefined),
      databaseLabel: ':ia-persist-2:',
      runMigrations: false,
    })

    try {
      const original = createKnowledgeArchitectureBlueprint()
      const cleanDiff = await db2.ia.diffBlueprint(original)
      expect(cleanDiff.upToDate).toBe(true)
      expect(cleanDiff.nodesToCreate).toEqual([])
      expect(cleanDiff.nodesToUpdate).toEqual([])
      expect(cleanDiff.relationsToCreate).toEqual([])

      // Modify a node title & attribute and add a brand-new child topic in the blueprint
      const updatedBlueprint: InformationArchitectureBlueprint = structuredClone(original)
      const topicsTable = updatedBlueprint.tables.find((t) => t.identifier === 'ia_topics')
      expect(topicsTable).toBeDefined()
      if (topicsTable?.nodes) {
        const gemmaNode = topicsTable.nodes.find((n) => n.key === 'topic_gemma')
        if (gemmaNode) {
          gemmaNode.title = 'EmbeddingGemma-2 MRL'
        }
        topicsTable.nodes.push({
          key: 'topic_fts_ia',
          title: 'Zero-Embedding FTS5 IA',
          content: 'Deterministic hierarchy and typed attribute search without vector models',
          parentKey: 'topic_ai',
          attributes: { slug: 'zero-embedding-ia', depth: 2 },
        })
      }

      const pendingDiff = await db2.ia.diffBlueprint(updatedBlueprint)
      expect(pendingDiff.upToDate).toBe(false)
      expect(pendingDiff.nodesToCreate.map((n) => n.key)).toEqual(['topic_fts_ia'])
      expect(pendingDiff.nodesToUpdate.map((n) => n.key)).toEqual(['topic_gemma'])
      expect(pendingDiff.relationsToCreate).toHaveLength(1)

      const reconciled = await db2.ia.applyBlueprint(updatedBlueprint, {
        updateExistingNodes: true,
      })
      expect(reconciled.nodesUpdated).toBe(1)
      expect(reconciled.relationsCreated).toBe(1)

      const postDiff = await db2.ia.diffBlueprint(updatedBlueprint)
      expect(postDiff.upToDate).toBe(true)

      const exported = await db2.ia.exportBlueprint({
        name: 'roundtrip-knowledge-v1',
        includeDocs: true,
      })
      expect(exported.tables.map((t) => t.identifier)).toEqual([
        'ia_concepts',
        'ia_documents',
        'ia_topics',
      ])

      // Apply exported blueprint into a brand-new DB3 without embeddings and verify zero diff
      const db3 = await createEmbeddedWebGraphDb({
        database: createPersistentSqlJsHarness(),
        databaseLabel: ':ia-persist-3:',
      })
      try {
        await db3.ia.applyBlueprint(exported)
        const roundtripDiff = await db3.ia.diffBlueprint(exported)
        expect(roundtripDiff.upToDate).toBe(true)
      } finally {
        await db3.dispose()
      }
    } finally {
      await db2.dispose()
    }
  })

  test('executes cross-table scopedByRelation queries, nested outlines, multi-hop queryPath, and assembleContextPack without embeddings', async () => {
    const webDb = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-query-engine:',
    })

    try {
      await webDb.ia.applyBlueprint(createKnowledgeArchitectureBlueprint())

      // Cross-table query on ia_documents scoped by ia_topics subtree under topic_ai
      const aiDocs = await webDb.ia.queryStructured({
        tableIdentifier: 'ia_documents',
        scopedByRelation: {
          rootNodeKey: 'topic_ai',
          hierarchyRelationType: 'parentOf',
          linkRelationType: 'belongsToTopic',
          linkDirection: 'OUTGOING',
        },
        filterQuery: 'status:published',
        facets: ['audience', 'topic_slug'],
        includeTopicBreadcrumbs: true,
      })

      expect(aiDocs.hits.map((h) => h.nodeKey).sort()).toEqual(['doc_agent_memory', 'doc_mrl_guide'])
      const mrlDocHit = aiDocs.hits.find((h) => h.nodeKey === 'doc_mrl_guide')
      expect(mrlDocHit?.topicBreadcrumbs?.map((c) => c.title)).toEqual([
        'Engineering Knowledge',
        'AI and Embeddings',
        'EmbeddingGemma-2',
      ])
      expect(aiDocs.facets.audience).toEqual([
        { value: 'architect', count: 1 },
        { value: 'developer', count: 1 },
      ])

      // Hierarchical outline with linked document counts and Markdown TOC
      const outline = await webDb.ia.getOutline({
        tableIdentifier: 'ia_topics',
        relationType: 'parentOf',
        countLinkedRelationTypes: ['belongsToTopic'],
      })
      expect(outline.totalNodes).toBe(4)
      expect(outline.maxDepthReached).toBe(2)
      expect(outline.roots[0]?.key).toBe('topic_root')
      expect(outline.roots[0]?.subtreeNodeCount).toBe(4)
      expect(outline.markdown).toContain('- Engineering Knowledge (`topic_root`)')
      expect(outline.markdown).toContain('belongsToTopic:1')

      // Multi-hop queryPath: topic_ai -> (parentOf* 0..4) -> belongsToTopic (published docs) -> explainsConcept
      const conceptsPath = await webDb.ia.queryPath({
        startNodeKeys: ['topic_ai'],
        hops: [
          {
            relationTypes: ['parentOf'],
            direction: 'OUTGOING',
            minDepth: 0,
            maxDepth: 4,
          },
          {
            relationTypes: ['belongsToTopic'],
            direction: 'OUTGOING',
            targetTableIdentifier: 'ia_documents',
            filterQuery: 'priority:>92',
          },
          {
            relationTypes: ['explainsConcept'],
            direction: 'OUTGOING',
            targetTableIdentifier: 'ia_concepts',
          },
        ],
      })
      expect(conceptsPath.startCount).toBe(1)
      expect(conceptsPath.hopCounts).toEqual([2, 1, 1])
      expect(conceptsPath.matches).toHaveLength(1)
      expect(conceptsPath.matches[0]?.node.key).toBe('concept_mrl')
      expect(conceptsPath.matches[0]?.steps.map((s) => s.key)).toEqual([
        'topic_ai',
        'topic_gemma',
        'doc_mrl_guide',
        'concept_mrl',
      ])

      // Zero-embedding structured Context Pack with outline + FTS5 + EAV + 1-hop expansion
      const pack = await webDb.ia.assembleContextPack({
        tableIdentifier: 'ia_documents',
        textQuery: 'cosine memory',
        filterQuery: 'domain:ai',
        scopedByRelation: {
          rootNodeKey: 'topic_ai',
          hierarchyRelationType: 'parentOf',
          linkRelationType: 'belongsToTopic',
          linkDirection: 'OUTGOING',
        },
        facets: ['audience', 'status'],
        outlineTableIdentifier: 'ia_topics',
        expandRelationTypes: ['explainsConcept'],
        expandDirection: 'OUTGOING',
        maxChars: 6000,
      })
      expect(pack.truncated).toBe(false)
      expect(pack.items.some((i) => i.key === 'doc_agent_memory' && i.matchedVia === 'query')).toBe(
        true,
      )
      expect(
        pack.items.some((i) => i.key === 'concept_hybrid_search' && i.matchedVia === 'neighbor'),
      ).toBe(true)
      expect(pack.markdown).toContain('## Outline (ia_topics)')
      expect(pack.markdown).toContain('## Items (ia_documents)')
      expect(pack.totalChars).toBeLessThanOrEqual(6000)
    } finally {
      await webDb.dispose()
    }
  })

  test('audits product-spec and decision-log presets and flags unlinked requirements and orphan hierarchy nodes', async () => {
    const webDb = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-audit:',
    })

    try {
      await webDb.ia.applyBlueprint(createProductSpecArchitectureBlueprint())
      await webDb.ia.applyBlueprint(createDecisionLogArchitectureBlueprint())

      const cleanAudit = await webDb.ia.auditArchitecture({
        expectedLinks: [
          {
            tableIdentifier: 'spec_requirements',
            relationType: 'belongsToDomain',
            direction: 'INCOMING',
          },
          {
            tableIdentifier: 'adr_decisions',
            relationType: 'belongsToArea',
            direction: 'INCOMING',
          },
        ],
      })
      expect(cleanAudit.healthy).toBe(true)
      expect(cleanAudit.errorCount).toBe(0)
      expect(cleanAudit.warningCount).toBe(0)
      expect(cleanAudit.totalTables).toBe(6)

      // Inject an unlinked requirement and an orphan domain node in an updated blueprint
      const brokenSpec = createProductSpecArchitectureBlueprint()
      const domainTable = brokenSpec.tables.find((t) => t.identifier === 'spec_domains')
      const reqTable = brokenSpec.tables.find((t) => t.identifier === 'spec_requirements')
      domainTable?.nodes?.push({
        key: 'domain_orphan',
        title: 'Detached Domain',
        content: 'Domain node intentionally left without parentOf link',
        attributes: { slug: 'orphan', owner_team: 'none' },
      })
      reqTable?.nodes?.push({
        key: 'req_unlinked',
        title: 'Unlinked Requirement',
        content: 'Requirement intentionally created without belongsToDomain relation',
        attributes: { status: 'draft', priority: 50, owner: 'none', release: 'v1.4' },
      })

      await webDb.ia.applyBlueprint(brokenSpec)
      const failingAudit = await webDb.ia.auditArchitecture({
        tableIdentifiers: ['spec_domains', 'spec_requirements'],
        expectedLinks: [
          {
            tableIdentifier: 'spec_requirements',
            relationType: 'belongsToDomain',
            direction: 'INCOMING',
          },
        ],
      })
      expect(failingAudit.healthy).toBe(false)
      expect(failingAudit.errorCount).toBeGreaterThanOrEqual(1)
      expect(failingAudit.warningCount).toBeGreaterThanOrEqual(1)
      expect(failingAudit.issues.some((i) => i.code === 'MISSING_EXPECTED_LINK')).toBe(true)
      expect(failingAudit.issues.some((i) => i.code === 'ORPHAN_HIERARCHY_NODE')).toBe(true)
    } finally {
      await webDb.dispose()
    }
  })

  test('supports zero-embedding AiMemoryService (tags, FTS5, getTopicOutline) and all 6 ia-* MCP 2026-07-28 tools', async () => {
    const webDb = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-zero-emb-mcp:',
    })

    try {
      // Zero-embedding AI Memory workflow
      const m1 = await webDb.aiMemory.remember({
        content: 'PostgreSQL logical replication requires replica identity full for schema updates.',
        kind: 'semantic',
        namespace: 'ops',
        topicPath: ['infra', 'database'],
        tags: ['database', 'migration'],
        importance: 0.9,
      })
      const m2 = await webDb.aiMemory.remember({
        content: 'SQLite FTS5 porter tokenizer enables fast client-side full-text retrieval without vectors.',
        kind: 'semantic',
        namespace: 'ops',
        topicPath: ['infra', 'search'],
        tags: ['sqlite', 'fts5', 'zero-embedding'],
        importance: 0.85,
      })
      expect(m1.embedded).toBe(false)
      expect(m2.embedded).toBe(false)

      const recalled = await webDb.aiMemory.recall({
        query: 'SQLite FTS5 full-text retrieval',
        namespace: 'ops',
        tags: ['fts5', 'zero-embedding'],
        tagMatchMode: 'all',
        reinforce: false,
      })
      expect(recalled.hits).toHaveLength(1)
      expect(recalled.hits[0]?.memory.id).toBe(m2.memory.id)
      expect(recalled.hits[0]?.score.combined).toBeGreaterThan(0.5)

      const topicOutline = await webDb.aiMemory.getTopicOutline()
      expect(topicOutline.roots[0]?.title).toBe('infra')
      expect(topicOutline.roots[0]?.children.map((c) => c.title).sort()).toEqual([
        'database',
        'search',
      ])

      // Verify all 6 IA MCP 2026-07-28 tools end-to-end over stateless HTTP
      const modernHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        [MCP_PROTOCOL_VERSION_HEADER]: LATEST_MCP_PROTOCOL_VERSION,
        [MCP_SESSION_ID_HEADER]: 'ia-stateless-session',
      }
      const modernMeta = {
        protocolVersion: LATEST_MCP_PROTOCOL_VERSION,
        clientInfo: { name: 'ia-zero-emb-client', version: '1.0.0' },
      }

      const callMcp = async (id: string, name: string, args: Record<string, unknown>) => {
        const response = await webDb.fetch(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { ...modernHeaders, 'Mcp-Name': name },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id,
              method: 'tools/call',
              params: {
                _meta: modernMeta,
                name,
                arguments: args,
              },
            }),
          }),
        )
        expect(response.status).toBe(200)
        return (await response.json()) as {
          result: { isError: boolean; structuredContent?: Record<string, unknown> }
        }
      }

      const applyRes = await callMcp('ia-1', 'ia-apply-blueprint', {
        preset: 'product-spec',
        embedNodes: false,
      })
      expect(applyRes.result.isError).toBe(false)
      expect(applyRes.result.structuredContent?.name).toBe('product-spec-architecture-v1')

      const structuredRes = await callMcp('ia-2', 'ia-query-structured', {
        tableIdentifier: 'spec_requirements',
        scopedByRelation: {
          rootNodeKey: 'domain_ia',
          linkRelationType: 'belongsToDomain',
          linkDirection: 'OUTGOING',
        },
        facets: ['status'],
      })
      expect(structuredRes.result.isError).toBe(false)
      expect((structuredRes.result.structuredContent?.hits as unknown[] | undefined) ?? []).toHaveLength(2)

      const outlineRes = await callMcp('ia-3', 'ia-get-outline', {
        tableIdentifier: 'spec_domains',
        countLinkedRelationTypes: ['belongsToDomain'],
      })
      expect(outlineRes.result.isError).toBe(false)
      expect(outlineRes.result.structuredContent?.totalNodes).toBe(3)

      const pathRes = await callMcp('ia-4', 'ia-query-path', {
        startNodeKeys: ['req_multi_hop'],
        hops: [
          {
            relationTypes: ['implementedBy'],
            direction: 'OUTGOING',
            targetTableIdentifier: 'spec_components',
          },
        ],
      })
      expect(pathRes.result.isError).toBe(false)
      const pathMatches = pathRes.result.structuredContent?.matches as Array<{
        node: { key: string }
      }>
      expect(pathMatches.map((m) => m.node.key)).toEqual(['comp_ia_service'])

      const contextRes = await callMcp('ia-5', 'ia-assemble-context', {
        tableIdentifier: 'spec_requirements',
        filterQuery: 'status:approved',
        outlineTableIdentifier: 'spec_domains',
        expandRelationTypes: ['implementedBy'],
        maxChars: 5000,
      })
      expect(contextRes.result.isError).toBe(false)
      expect(String(contextRes.result.structuredContent?.markdown ?? '')).toContain(
        'Zero-Node Embedded Execution',
      )

      const auditRes = await callMcp('ia-6', 'ia-audit', {
        tableIdentifiers: ['spec_domains', 'spec_requirements', 'spec_components'],
        expectedLinks: [
          {
            tableIdentifier: 'spec_requirements',
            relationType: 'belongsToDomain',
            direction: 'INCOMING',
          },
        ],
      })
      expect(auditRes.result.isError).toBe(false)
      expect(auditRes.result.structuredContent?.healthy).toBe(true)

      // MCP column inspection + dynamic configuration + autoFacets query
      const colsRes = await callMcp('ia-7', 'ia-get-columns', {
        tableIdentifier: 'spec_requirements',
      })
      expect(colsRes.result.isError).toBe(false)
      expect(colsRes.result.structuredContent?.facetableColumns).toEqual([
        'status',
        'owner',
        'release',
      ])

      const cfgRes = await callMcp('ia-8', 'ia-configure-column', {
        tableIdentifier: 'spec_requirements',
        attributeIdentifier: 'owner',
        options: {
          role: 'owner',
          facetable: true,
          hidden: true,
          displayOrder: 9,
        },
      })
      expect(cfgRes.result.isError).toBe(false)

      const autoFacetRes = await callMcp('ia-9', 'ia-query-structured', {
        tableIdentifier: 'spec_requirements',
        autoFacets: true,
      })
      expect(autoFacetRes.result.isError).toBe(false)
      const autoFacetsObj = autoFacetRes.result.structuredContent?.facets as
        | Record<string, unknown>
        | undefined
      expect(Object.keys(autoFacetsObj ?? {}).sort()).toEqual(['owner', 'release', 'status'])
    } finally {
      await webDb.dispose()
    }
  })

  test('models ColumnConfig options (defaults, enumValues, auto-facets, displayOrder/hidden, and opt-in column embeddings)', async () => {
    const provider = new EmbeddingGemma2Provider({
      dimension: 256,
      dtype: 'q4',
      backend: createDeterministicHashEmbeddingBackend(768),
    })

    const bp: InformationArchitectureBlueprint = {
      name: 'column-config-optin-embedding-v1',
      tables: [
        {
          identifier: 'cfg_catalog',
          description: 'Structured catalog table WITHOUT embedding column option',
          attributes: [
            {
              identifier: 'status',
              typeIdentifier: 'string',
              isRequired: true,
              options: {
                role: 'status',
                facetable: true,
                enumValues: ['draft', 'published'],
                defaultValue: 'draft',
                displayOrder: 2,
              },
            },
            {
              identifier: 'code',
              typeIdentifier: 'string',
              isRequired: true,
              options: {
                role: 'slug',
                searchable: true,
                displayOrder: 1,
              },
            },
            {
              identifier: 'internal_note',
              typeIdentifier: 'string',
              isRequired: false,
              options: {
                role: 'custom',
                hidden: true,
                displayOrder: 3,
              },
            },
          ],
          nodes: [
            {
              key: 'cat_1',
              title: 'Catalog Entry One',
              content: 'Structured catalog entry defaulting status to draft',
              attributes: {
                code: 'CAT-001',
                internal_note: 'secret-internal-token',
              },
            },
          ],
        },
        {
          identifier: 'cfg_articles',
          description: 'Article table WITH opt-in column embedding option',
          attributes: [
            {
              identifier: 'summary',
              typeIdentifier: 'string',
              isRequired: true,
              options: {
                role: 'embedding',
                searchable: true,
                embedding: {
                  enabled: true,
                  sourceColumns: ['summary'],
                  dimension: 256,
                },
              },
            },
          ],
          nodes: [
            {
              key: 'art_1',
              title: 'Selective Embedding Article',
              content: 'Only tables declaring embedding column option are vectorized.',
              attributes: {
                summary: 'Column-level opt-in vectorization summary',
              },
            },
          ],
        },
      ],
    }

    const webDbWithEmb = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-col-opt-emb:',
      embeddingProvider: provider,
    })

    try {
      const applied = await webDbWithEmb.ia.applyBlueprint(bp)
      // Table A (cfg_catalog, 1 node) skipped; Table B (cfg_articles, 1 node) embedded
      expect(applied.embeddedNodeCount).toBe(1)

      const catProfile = await webDbWithEmb.ia.getTableColumns('cfg_catalog')
      expect(catProfile.columns.map((c) => c.identifier)).toEqual([
        'code',
        'status',
        'internal_note',
      ])
      expect(catProfile.hiddenColumns).toEqual(['internal_note'])
      expect(catProfile.facetableColumns).toEqual(['status'])
      expect(catProfile.defaultValues).toEqual({ status: 'draft' })
      expect(catProfile.embeddingColumns).toEqual([])

      // Default status='draft' was injected and auto-faceted via facets: 'auto'
      const catQuery = await webDbWithEmb.ia.queryStructured({
        tableIdentifier: 'cfg_catalog',
        facets: 'auto',
      })
      expect(catQuery.hits[0]?.node.attributes?.status).toBe('draft')
      expect(catQuery.facets.status).toEqual([{ value: 'draft', count: 1 }])

      // Hidden column omitted from context pack markdown, displayOrder honored (code before status)
      const pack = await webDbWithEmb.ia.assembleContextPack({
        tableIdentifier: 'cfg_catalog',
        facets: 'auto',
      })
      expect(pack.markdown).toContain('code=CAT-001, status=draft')
      expect(pack.markdown).not.toContain('internal_note')
      expect(pack.markdown).not.toContain('secret-internal-token')

      // Invalid enum value rejected on blueprint node write
      await expect(
        webDbWithEmb.ia.applyBlueprint({
          name: 'bad-enum-test',
          tables: [
            {
              identifier: 'cfg_catalog',
              attributes: [],
              nodes: [
                {
                  key: 'cat_bad',
                  content: 'Invalid status value node',
                  attributes: { code: 'BAD-1', status: 'invalid_state' },
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow(/Invalid value 'invalid_state' for column 'status'/)

      // Export preserves column options across round-trip
      const exported = await webDbWithEmb.ia.exportBlueprint({
        tableIdentifiers: ['cfg_catalog', 'cfg_articles'],
      })
      const expCat = exported.tables.find((t) => t.identifier === 'cfg_catalog')
      const statusAttr = expCat?.attributes?.find((a) => a.identifier === 'status')
      expect(statusAttr?.options).toEqual({
        role: 'status',
        facetable: true,
        enumValues: ['draft', 'published'],
        defaultValue: 'draft',
        displayOrder: 2,
      })

      // EmbedNodesUseCase.embedTableByColumnConfig skips cfg_catalog and embeds cfg_articles
      const catalogTableId = applied.tables.cfg_catalog
      const articlesTableId = applied.tables.cfg_articles
      if (!catalogTableId || !articlesTableId || !webDbWithEmb.embedNodes) {
        throw new Error('Expected table IDs and embedNodes use case')
      }
      const skipRes = await webDbWithEmb.embedNodes.embedTableByColumnConfig(catalogTableId)
      expect(skipRes.embeddedCount).toBe(0)
      expect(skipRes.skippedReason).toBe('No column has embedding.enabled=true')

      const embRes = await webDbWithEmb.embedNodes.embedTableByColumnConfig(articlesTableId)
      expect(embRes.embeddedCount).toBe(1)
      expect(embRes.enabledColumns).toEqual(['summary'])
    } finally {
      await webDbWithEmb.dispose()
    }

    // Without embeddingProvider, embedding-enabled columns remain clean and audit stays healthy (info hint)
    const webDbNoEmb = await createEmbeddedWebGraphDb({
      database: createPersistentSqlJsHarness(),
      databaseLabel: ':ia-col-opt-no-emb:',
    })
    try {
      const appliedNoEmb = await webDbNoEmb.ia.applyBlueprint(bp)
      expect(appliedNoEmb.embeddedNodeCount).toBe(0)

      const audit = await webDbNoEmb.ia.auditArchitecture()
      expect(audit.healthy).toBe(true)
      expect(
        audit.issues.some(
          (i) => i.severity === 'info' && i.code === 'EMBEDDING_PROVIDER_UNCONFIGURED',
        ),
      ).toBe(true)
    } finally {
      await webDbNoEmb.dispose()
    }
  })
})
