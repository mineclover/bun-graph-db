import type { InformationArchitectureBlueprint } from '@/application/services/InformationArchitectureService.js'

/**
 * Reusable 3-table Information Architecture blueprint combining a strict TREE topic taxonomy
 * (`ia_topics`), typed/faceted documents (`ia_documents`), and a concept prerequisite DAG (`ia_concepts`).
 */
export function createKnowledgeArchitectureBlueprint(): InformationArchitectureBlueprint {
  return {
    name: 'knowledge-architecture-v1',
    version: '1.0.0',
    description:
      'Tree topic taxonomy + typed document catalog + DAG concept dependency graph for structured IA search.',
    relationTypes: [
      { identifier: 'parentOf', description: 'Hierarchical parent-child edge', category: 'hierarchy' },
      { identifier: 'belongsToTopic', description: 'Assigns a document to an IA topic node', category: 'semantic' },
      { identifier: 'explainsConcept', description: 'Links a document to a concept node', category: 'semantic' },
      { identifier: 'dependsOn', description: 'Prerequisite dependency between concepts', category: 'structural' },
    ],
    tables: [
      {
        identifier: 'ia_topics',
        description: 'Strict tree taxonomy for Information Architecture navigation and subtree scoping',
        hierarchy: { mode: 'TREE', relationType: 'parentOf' },
        attributes: [
          {
            identifier: 'slug',
            name: 'Slug',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'slug', searchable: true, filterable: true, displayOrder: 1 },
          },
          {
            identifier: 'depth',
            name: 'Depth',
            typeIdentifier: 'integer',
            isRequired: true,
            options: { role: 'metric', sortable: true, filterable: true, displayOrder: 2 },
          },
        ],
        nodes: [
          {
            key: 'topic_root',
            title: 'Engineering Knowledge',
            content: 'Root Engineering Knowledge Taxonomy',
            attributes: { slug: 'engineering', depth: 0 },
          },
          {
            key: 'topic_ai',
            title: 'AI and Embeddings',
            content: 'AI Models, Vector Search, and Agent Memory',
            parentKey: 'topic_root',
            attributes: { slug: 'ai-embeddings', depth: 1 },
          },
          {
            key: 'topic_web',
            title: 'Web and Edge Runtimes',
            content: 'Browser WASM SQLite and Cloudflare Edge Workers',
            parentKey: 'topic_root',
            attributes: { slug: 'web-edge', depth: 1 },
          },
          {
            key: 'topic_gemma',
            title: 'EmbeddingGemma-2',
            content: 'Google EmbeddingGemma-2 Multimodal and Matryoshka Retrieval',
            parentKey: 'topic_ai',
            attributes: { slug: 'embeddinggemma-2', depth: 2 },
          },
        ],
      },
      {
        identifier: 'ia_documents',
        description: 'Typed documents indexed by domain, audience, status, priority, and topic links',
        attributes: [
          {
            identifier: 'domain',
            name: 'Domain',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'category', facetable: true, filterable: true, displayOrder: 1 },
          },
          {
            identifier: 'audience',
            name: 'Audience',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'category', facetable: true, filterable: true, displayOrder: 2 },
          },
          {
            identifier: 'status',
            name: 'Status',
            typeIdentifier: 'string',
            isRequired: true,
            options: {
              role: 'status',
              facetable: true,
              filterable: true,
              enumValues: ['draft', 'published', 'archived'],
              defaultValue: 'draft',
              displayOrder: 3,
            },
          },
          {
            identifier: 'priority',
            name: 'Priority',
            typeIdentifier: 'integer',
            isRequired: true,
            options: { role: 'priority', sortable: true, filterable: true, displayOrder: 4 },
          },
          {
            identifier: 'topic_slug',
            name: 'Topic Slug',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'slug', searchable: true, filterable: true, displayOrder: 5 },
          },
        ],
        docs: [
          {
            category: 'spec',
            content: 'IA Documents follow schema-gated faceting over domain, audience, status, and topic_slug.',
            version: 1,
          },
        ],
        nodes: [
          {
            key: 'doc_mrl_guide',
            title: 'EmbeddingGemma-2 MRL Retrieval Guide',
            content:
              'Use task: search result | query: ... and Matryoshka truncation (768, 512, 256, 128) with L2 renormalization for fast vector recall.',
            attributes: {
              domain: 'ai',
              audience: 'developer',
              status: 'published',
              priority: 95,
              topic_slug: 'embeddinggemma-2',
            },
          },
          {
            key: 'doc_agent_memory',
            title: '5-Signal Agent Memory Architecture',
            content:
              'Combine FTS5 lexical match, EmbeddingGemma-2 vector cosine similarity, graph topic proximity, temporal half-life decay, and importance salience.',
            attributes: {
              domain: 'ai',
              audience: 'architect',
              status: 'published',
              priority: 90,
              topic_slug: 'ai-embeddings',
            },
          },
          {
            key: 'doc_web_wasm',
            title: 'Browser Embedded Web SQLite Guide',
            content:
              'Run PortableBootstrap directly inside the browser over sql.js or sqlite-wasm OPFS without any Node.js runtime dependency.',
            attributes: {
              domain: 'web',
              audience: 'developer',
              status: 'published',
              priority: 85,
              topic_slug: 'web-edge',
            },
          },
        ],
      },
      {
        identifier: 'ia_concepts',
        description: 'Multi-parent DAG of foundational engineering concepts',
        hierarchy: { mode: 'DAG', relationType: 'dependsOn' },
        attributes: [
          { identifier: 'category', name: 'Category', typeIdentifier: 'string', isRequired: true },
        ],
        nodes: [
          {
            key: 'concept_sqlite',
            title: 'Portable SQLite Port',
            content: 'Synchronous ISqliteDatabase abstraction shared by Node, Cloudflare DO, and Web WASM.',
            attributes: { category: 'storage' },
          },
          {
            key: 'concept_mrl',
            title: 'Matryoshka Representations',
            content: 'Prefix truncation from 768D to 256D or 128D with unit L2 normalization.',
            attributes: { category: 'embeddings' },
          },
          {
            key: 'concept_hybrid_search',
            title: '4-Signal Hybrid Search',
            content: 'RRF fusion over FTS5, typed attribute pushdown, Float32 slab cosine, and N-hop graph distance.',
            parentKeys: ['concept_sqlite', 'concept_mrl'],
            attributes: { category: 'retrieval' },
          },
        ],
      },
    ],
    relations: [
      { sourceKey: 'topic_gemma', targetKey: 'doc_mrl_guide', relationType: 'belongsToTopic', strength: 4, confidence: 4 },
      { sourceKey: 'topic_ai', targetKey: 'doc_agent_memory', relationType: 'belongsToTopic', strength: 4, confidence: 4 },
      { sourceKey: 'topic_web', targetKey: 'doc_web_wasm', relationType: 'belongsToTopic', strength: 4, confidence: 4 },
      { sourceKey: 'doc_mrl_guide', targetKey: 'concept_mrl', relationType: 'explainsConcept', strength: 4, confidence: 4 },
      { sourceKey: 'doc_agent_memory', targetKey: 'concept_hybrid_search', relationType: 'explainsConcept', strength: 4, confidence: 4 },
    ],
  }
}

export type PresetBlueprintName = 'knowledge' | 'product-spec' | 'decision-log'

/**
 * Product specification and component traceability blueprint (100% structured without embeddings).
 */
export function createProductSpecArchitectureBlueprint(): InformationArchitectureBlueprint {
  return {
    name: 'product-spec-architecture-v1',
    version: '1.0.0',
    description:
      'Product domain tree + faceted requirement specifications + component dependency DAG.',
    relationTypes: [
      { identifier: 'parentOf', description: 'Hierarchical domain parent-child edge', category: 'hierarchy' },
      { identifier: 'belongsToDomain', description: 'Links a domain node to a requirement spec', category: 'semantic' },
      { identifier: 'implementedBy', description: 'Links a requirement to an implementing component', category: 'structural' },
      { identifier: 'verifiedBy', description: 'Links a component to a verification gate or suite', category: 'structural' },
      { identifier: 'dependsOn', description: 'Component prerequisite dependency', category: 'structural' },
    ],
    tables: [
      {
        identifier: 'spec_domains',
        description: 'Product capability domains arranged as a strict TREE',
        hierarchy: { mode: 'TREE', relationType: 'parentOf' },
        attributes: [
          {
            identifier: 'slug',
            name: 'Slug',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'slug', searchable: true, filterable: true, displayOrder: 1 },
          },
          {
            identifier: 'owner_team',
            name: 'Owner Team',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'owner', facetable: true, filterable: true, displayOrder: 2 },
          },
        ],
        nodes: [
          {
            key: 'domain_platform',
            title: 'Core Platform',
            content: 'Root Platform Architecture Domain',
            attributes: { slug: 'platform', owner_team: 'core' },
          },
          {
            key: 'domain_runtime',
            title: 'Portable Storage and Runtime',
            content: 'Embedded SQLite adapters for Node, Browser WASM, and Edge',
            parentKey: 'domain_platform',
            attributes: { slug: 'runtime', owner_team: 'runtime' },
          },
          {
            key: 'domain_ia',
            title: 'Information Architecture and Query',
            content: 'Structured hierarchy, EAV pushdown, and multi-hop graph queries',
            parentKey: 'domain_platform',
            attributes: { slug: 'ia-query', owner_team: 'knowledge' },
          },
        ],
      },
      {
        identifier: 'spec_requirements',
        description: 'Schema-gated product requirements with status, priority, owner, and release facets',
        attributes: [
          {
            identifier: 'status',
            name: 'Status',
            typeIdentifier: 'string',
            isRequired: true,
            options: {
              role: 'status',
              facetable: true,
              filterable: true,
              enumValues: ['draft', 'approved', 'deprecated'],
              defaultValue: 'draft',
              displayOrder: 1,
            },
          },
          {
            identifier: 'priority',
            name: 'Priority',
            typeIdentifier: 'integer',
            isRequired: true,
            options: { role: 'priority', sortable: true, filterable: true, displayOrder: 2 },
          },
          {
            identifier: 'owner',
            name: 'Owner',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'owner', facetable: true, filterable: true, displayOrder: 3 },
          },
          {
            identifier: 'release',
            name: 'Release',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'category', facetable: true, filterable: true, displayOrder: 4 },
          },
        ],
        nodes: [
          {
            key: 'req_zero_node',
            title: 'Zero-Node Embedded Execution',
            content: 'Run SQLite graph storage and EAV filtering in browsers without Node builtins',
            attributes: { status: 'approved', priority: 95, owner: 'runtime-lead', release: 'v1.2' },
          },
          {
            key: 'req_multi_hop',
            title: 'Declarative Multi-Hop Path Query',
            content: 'Traverse typed relation hops with provenance without vector embeddings',
            attributes: { status: 'approved', priority: 92, owner: 'ia-lead', release: 'v1.2' },
          },
          {
            key: 'req_audit_gate',
            title: 'Architecture Integrity Audit Gate',
            content: 'Detect orphan nodes, unlinked specs, and hierarchy or schema violations',
            attributes: { status: 'draft', priority: 80, owner: 'ia-lead', release: 'v1.3' },
          },
        ],
      },
      {
        identifier: 'spec_components',
        description: 'System implementation components connected by dependsOn DAG',
        hierarchy: { mode: 'DAG', relationType: 'dependsOn' },
        attributes: [
          {
            identifier: 'layer',
            name: 'Layer',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'category', facetable: true, filterable: true, displayOrder: 1 },
          },
          {
            identifier: 'stability',
            name: 'Stability',
            typeIdentifier: 'string',
            isRequired: true,
            options: {
              role: 'status',
              facetable: true,
              filterable: true,
              enumValues: ['experimental', 'beta', 'stable'],
              defaultValue: 'experimental',
              displayOrder: 2,
            },
          },
        ],
        nodes: [
          {
            key: 'comp_sqlite_port',
            title: 'ISqliteDatabase Port',
            content: 'Unified synchronous SQLite driver port with savepoint transactions',
            attributes: { layer: 'infrastructure', stability: 'stable' },
          },
          {
            key: 'comp_web_adapter',
            title: 'WebSqliteDatabase Adapter',
            content: 'Browser WASM SQLite wrapper over sql.js and sqlite-wasm OO1',
            parentKeys: ['comp_sqlite_port'],
            attributes: { layer: 'infrastructure', stability: 'stable' },
          },
          {
            key: 'comp_ia_service',
            title: 'InformationArchitectureService',
            content: 'Declarative blueprints, outlines, path queries, context assembly, and audits',
            parentKeys: ['comp_sqlite_port', 'comp_web_adapter'],
            attributes: { layer: 'application', stability: 'beta' },
          },
        ],
      },
    ],
    relations: [
      { sourceKey: 'domain_runtime', targetKey: 'req_zero_node', relationType: 'belongsToDomain', strength: 4, confidence: 4 },
      { sourceKey: 'domain_ia', targetKey: 'req_multi_hop', relationType: 'belongsToDomain', strength: 4, confidence: 4 },
      { sourceKey: 'domain_ia', targetKey: 'req_audit_gate', relationType: 'belongsToDomain', strength: 4, confidence: 4 },
      { sourceKey: 'req_zero_node', targetKey: 'comp_web_adapter', relationType: 'implementedBy', strength: 4, confidence: 4 },
      { sourceKey: 'req_multi_hop', targetKey: 'comp_ia_service', relationType: 'implementedBy', strength: 4, confidence: 4 },
      { sourceKey: 'req_audit_gate', targetKey: 'comp_ia_service', relationType: 'implementedBy', strength: 3, confidence: 4 },
    ],
  }
}

/**
 * Architecture Decision Record (ADR) governance blueprint for zero-embedding engineering logs.
 */
export function createDecisionLogArchitectureBlueprint(): InformationArchitectureBlueprint {
  return {
    name: 'decision-log-architecture-v1',
    version: '1.0.0',
    description:
      'ADR topic areas + typed decision catalog + supporting/contradicting evidence graph.',
    relationTypes: [
      { identifier: 'parentOf', description: 'Decision area hierarchy', category: 'hierarchy' },
      { identifier: 'belongsToArea', description: 'Links a decision area to an ADR record', category: 'semantic' },
      { identifier: 'supersedes', description: 'Marks a newer ADR as superseding an older ADR', category: 'structural' },
      { identifier: 'supports', description: 'Links evidence supporting an ADR', category: 'semantic' },
      { identifier: 'contradicts', description: 'Links evidence challenging an ADR', category: 'semantic' },
    ],
    tables: [
      {
        identifier: 'adr_areas',
        description: 'Engineering decision domains structured as a TREE',
        hierarchy: { mode: 'TREE', relationType: 'parentOf' },
        attributes: [
          { identifier: 'code', name: 'Area Code', typeIdentifier: 'string', isRequired: true },
        ],
        nodes: [
          {
            key: 'area_root',
            title: 'Engineering Governance',
            content: 'Root Architecture Decision Governance Area',
            attributes: { code: 'ENG' },
          },
          {
            key: 'area_storage',
            title: 'Storage and Retrieval Decisions',
            content: 'SQLite FTS5, EAV indexing, and zero-embedding retrieval decisions',
            parentKey: 'area_root',
            attributes: { code: 'STR' },
          },
        ],
      },
      {
        identifier: 'adr_decisions',
        description: 'Architecture Decision Records faceted by status, impact, and date',
        attributes: [
          {
            identifier: 'status',
            name: 'Status',
            typeIdentifier: 'string',
            isRequired: true,
            options: {
              role: 'status',
              facetable: true,
              filterable: true,
              enumValues: ['proposed', 'accepted', 'superseded', 'deprecated'],
              defaultValue: 'proposed',
              displayOrder: 1,
            },
          },
          {
            identifier: 'impact',
            name: 'Impact',
            typeIdentifier: 'string',
            isRequired: true,
            options: {
              role: 'priority',
              facetable: true,
              filterable: true,
              enumValues: ['low', 'medium', 'high'],
              defaultValue: 'medium',
              displayOrder: 2,
            },
          },
          {
            identifier: 'decided_at',
            name: 'Decided At',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'date', sortable: true, filterable: true, displayOrder: 3 },
          },
        ],
        nodes: [
          {
            key: 'adr_001',
            title: 'ADR-001 Manual Graph Edges Over Ad-Hoc JSON',
            content: 'Store all structural links in node_relations for SQL indexing and BFS traversal',
            attributes: { status: 'accepted', impact: 'high', decided_at: '2026-11-20' },
          },
          {
            key: 'adr_002',
            title: 'ADR-002 Zero-Embedding-First Retrieval Default',
            content: 'Ensure FTS5, typed EAV pushdown, and multi-hop graph queries deliver full IA without mandatory vectors',
            attributes: { status: 'accepted', impact: 'high', decided_at: '2026-11-27' },
          },
        ],
      },
      {
        identifier: 'adr_evidence',
        description: 'Benchmarks and verification artifacts attached to ADRs',
        attributes: [
          {
            identifier: 'source_type',
            name: 'Source Type',
            typeIdentifier: 'string',
            isRequired: true,
            options: { role: 'category', facetable: true, filterable: true, displayOrder: 1 },
          },
          {
            identifier: 'verified',
            name: 'Verified',
            typeIdentifier: 'boolean',
            isRequired: true,
            options: { role: 'status', facetable: true, filterable: true, displayOrder: 2 },
          },
        ],
        nodes: [
          {
            key: 'ev_bench_fts',
            title: 'Hotpath Search Benchmark Evidence',
            content: 'FTS5 plus EAV index pushdown achieves sub-millisecond median latency on embedded SQLite',
            attributes: { source_type: 'benchmark', verified: true },
          },
        ],
      },
    ],
    relations: [
      { sourceKey: 'area_storage', targetKey: 'adr_001', relationType: 'belongsToArea', strength: 4, confidence: 4 },
      { sourceKey: 'area_storage', targetKey: 'adr_002', relationType: 'belongsToArea', strength: 4, confidence: 4 },
      { sourceKey: 'ev_bench_fts', targetKey: 'adr_002', relationType: 'supports', strength: 4, confidence: 4 },
    ],
  }
}

export function getPresetBlueprint(name: PresetBlueprintName): InformationArchitectureBlueprint {
  switch (name) {
    case 'knowledge':
      return createKnowledgeArchitectureBlueprint()
    case 'product-spec':
      return createProductSpecArchitectureBlueprint()
    case 'decision-log':
      return createDecisionLogArchitectureBlueprint()
  }
}
