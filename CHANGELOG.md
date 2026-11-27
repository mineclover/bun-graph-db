# Changelog

All notable changes to bun-graph-db are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-27

### Added
- **Product Packaging, `.d.ts` Declarations & Deploy Templates**: Added MIT `LICENSE`, multi-entrypoint `tsup.config.ts` (`./core`, `./embedded`, `./mcp-stdio`, `./cli`, `.`) with bundled workspace OpenAPI contract, TS 7 `.d.ts` emission (`scripts/emit-dts.ts`, 322+ declarations & 5 facades), release artifact verifier (`scripts/check-release-artifacts.ts`), `Dockerfile`, and Cloudflare Worker/Durable Object template (`deploy/cloudflare/{wrangler.jsonc,worker.ts}`)
- **Zero-Dependency Headless Core (`bun-graph-db/core`) & IndexedDB Persistence**: Added `createHeadlessGraphDb` (`src/core/HeadlessGraphDb.ts`, `src/core-sdk.ts`) with zero `node:*` and zero external npm imports, plus browser-native `IndexedDbSnapshotStorage` (`ISnapshotStoragePort`)
- **Stdio MCP Server, Unified CLI & 3 Starters**: Added line-delimited JSON-RPC 2.0 `startMcpStdioServer` (`src/mcp/stdio/McpStdioServer.ts`), `graph-memory` / `bun-graph-db` CLI (`src/cli/index.ts` supporting `init`, `inspect`, `mcp`, `serve`, `backup`, `restore`), and runnable starters under `examples/` (`web-embedded-ia-memory`, `mcp-ai-memory`, `cloudflare-do-worker`)
- **Day-2 Security Ops, Prometheus Metrics & Built-in Web Studio**: Added `SecurityAuditLog`, dynamic token `registerToken`/`revokeToken`/`listPrincipals` & `expiresAt` enforcement in `AccessControl`, `MetricsRegistry` (`GET /metrics` Prometheus & JSON, `GET /api/audit-log`), and zero-dependency Web Studio UI (`GET /studio`)
- **Modular Service Decomposition**: Split `InformationArchitectureService.ts` into modular `src/application/services/ia/{IaSharedHelpers,IaBlueprintManager,IaQueryEngine,IaArchitectureAuditor}.ts` collaborators, extracted `McpRootToolHandlers.ts` from `McpHttpServer.ts`, and extracted `TableMcpToolCatalog.ts` from `TableMcpServer.ts`

## [Unreleased]

### Added
- **Column Configuration Options & Opt-In Column Embeddings**: Added `ColumnConfig` (`src/domain/value-objects/ColumnConfig.ts`) persisted in attribute `metadata.columnConfig` with `role`, `searchable`, `facetable`, `filterable`, `sortable`, `enumValues`, `defaultValue`, `displayOrder`, `hidden`, and opt-in `embedding` (`{ enabled, sourceColumns, includeTitle, includeContent, task, dimension }`); added `getTableColumns` / `configureColumn`, `facets: 'auto'`, `defaultValue` injection, `enumValues` write/audit enforcement, `embedTableByColumnConfig` + column-policy selective embedding in `applyBlueprint`, and MCP tools `ia-get-columns` & `ia-configure-column`
- **Zero-Embedding-First Information Architecture (IA)**: Upgraded `InformationArchitectureService` with persistent `iaKey` hydration across DB reopens, `diffBlueprint` dry-run, `applyBlueprint({ updateExistingNodes: true })`, `exportBlueprint` round-trip, cross-table `scopedByRelation` + `includeTopicBreadcrumbs` structured queries, nested `getOutline` (with Markdown TOC and linked counts), multi-hop `queryPath`, budgeted `assembleContextPack`, `auditArchitecture` (hierarchy/conformance/orphan/expected-link checks), built-in `product-spec` / `decision-log` presets (`PresetBlueprints.ts`), AI Memory tag filtering & `getTopicOutline`, and 8 `ia-*` MCP `2026-07-28` tools (`ia-apply-blueprint`, `ia-query-structured`, `ia-get-outline`, `ia-query-path`, `ia-assemble-context`, `ia-audit`, `ia-get-columns`, `ia-configure-column`)
- **Web/Browser Embedded SDK & Zero-Node Crypto**: Added `portableHash.ts` (FIPS 180-4 SHA-256 & constant-time comparison without `node:crypto`), `WebSqliteAdapter` (`sql.js` & `@sqlite.org/sqlite-wasm` OO1 drivers + `WebKeyValueSnapshotStorage`), `createEmbeddedWebGraphDb`, and `src/embedded.ts` build entrypoint (`./embedded` export with zero static `node:*` imports)
- **`google/embeddinggemma-2` First-Class Provider**: Added `IEmbeddingProvider`, `EmbeddingGemma2Provider` (official 8-task prefixes, Matryoshka 768/512/256/128 L2 renormalization, `fp16` guard, Transformers.js WebGPU/HTTP OpenAI & Ollama backends), `EmbedNodesUseCase`, and automatic `retrieval_query` vectorization in `HybridSearchNodesUseCase`
- **Information Architecture (IA) & AI Agent Memory**: Added declarative `InformationArchitectureService` + `createKnowledgeArchitectureBlueprint()`, 5-signal `AiMemoryService` (`remember`, temporal-decay `recall`, `consolidate`, `forget`, `pruneExpired`, `getContextWindow`, `getTimeline`, `getStats`), and `memory-remember` / `memory-recall` / `memory-consolidate` / `memory-context-window` MCP tools
- **Portable Runtime & Cloudflare DO SQLite Phase 1**: Added `PortableBootstrap`, `DoSqliteAdapter`, `CloudflareSingleNodeWorker`, and embedded schema assets (`src/generated/embedded-assets.ts`) supporting Node 26 `node:sqlite` and Cloudflare Durable Objects SQLite constraints
- **First-Class Hierarchy & Graph Analytics**: Implemented Tree/DAG hierarchy queries (`getAncestors`, `getDescendants`, `getSubtree`, `getHierarchyRoots`, `getHierarchyLeaves`, `getLowestCommonAncestor`, `validateHierarchy`), cycle-guarded `moveHierarchyNode`, Tarjan SCC (`stronglyConnectedComponents`), Power-Iteration `pageRank`, and bidirectional level-order BFS / weighted Dijkstra (`findOptimalPath`)
- **Persistent Vector Embeddings & 4-Signal Hybrid Search**: Added `node_embeddings` Float32 storage, `ExactVectorIndex`, and `hybridSearchNodes` fusing FTS5, attribute filters (`value_num`), cosine similarity, and N-hop graph proximity
- **Modern MCP Protocol (`2026-07-28` + `2025-11-25` LTS)**: Upgraded root `/mcp` and table `/sub/:tableId/mcp` servers with protocol negotiation, `ToolAnnotations`, JSON Schema 2020-12 `outputSchema`, and `structuredContent`
- **SchemaGate & OpenAPI 3.2 Projection**: Added `NodeAttributeSchemaGate`, `TableSchemaProjectionService`, and deterministic `oa-sdk` OpenAPI 3.2 projection verification (`pnpm run projection:check`)
- **Core Golden Test Dataset**: Added versioned canonical fixture dataset (`tests/fixtures/golden/`) and cross-runtime verification suite (`pnpm run test:golden`, `docs/development/GOLDEN_DATASET.md`) covering 10 core feature domains across Node 26, Cloudflare DO SQLite mock, and JSONL round-trip

### Changed
- **Runtime & Tooling Migration**: Migrated from Bun/Jest to **Node.js 26 LTS (`node:sqlite`)**, **pnpm 12**, **Vitest 5** (4-lane deterministic execution across 132 test files), **Biome**, and **tsup**
- **HTTP/REST Alignment**: Wired missing routes in `BunApiRouter` (`/api/tables/:tableId/docs`, `/api/nodes/:nodeId/relations`, `/api/relations/search`, `/api/templates/:templateIdentifier/export`, `/api/templates/import`, `/api/attributes/tables/:tableId`, `PUT/DELETE /api/attributes/:attributeId`), enforced strict `/api/nodes/:nodeId` matching, and aligned `ApiEndpointMapping`, `RestApiClient`, `AccessControl`, `DatabaseConfig` (`node-sqlite`), and `PortConfiguration` (`4141`)
- **Documentation Governance**: Enforced canonical doc validation (`scripts/check-docs.ts`) per `docs/development/DOCUMENTATION_POLICY.md` and removed legacy `claudedocs/`, `reports/`, `scripts/archive/`, `ApiRoutes.ts`, `utils/executeTemplate.ts`, and stray binary artifacts

### Fixed
- Fixed SQL string backslash over-escaping in `scripts/database/schema.sql` (`date` `validation_schema` regex pattern `^\\d{4}-\\d{2}-\\d{2}$`) and regenerated `src/generated/embedded-assets.ts`
- Fixed `GraphApiController.getTableDocs` and `GraphDbApiController.exportTemplate` parameter extraction to accept `req.params` path parameters alongside `req.query` / `req.body`
