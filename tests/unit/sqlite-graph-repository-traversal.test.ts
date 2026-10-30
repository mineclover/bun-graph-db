import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { RelationDepth, RelationDirection } from '@/domain/value-objects/RelationQuery.js'

describe('SqliteGraphRepository traversal and pagination', () => {
  let db: Database
  let repository: SqliteGraphRepository
  let relationRepository: SqliteNodeRelationRepository

  beforeEach(() => {
    db = new Database(':memory:')
    createSchema(db)
    repository = new SqliteGraphRepository(db)
    relationRepository = new SqliteNodeRelationRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  test('paginates nodes before hydrating every attribute from joined rows', async () => {
    insertNode(db, 'node-1', '2026-01-03T00:00:00.000Z')
    insertNode(db, 'node-2', '2026-01-02T00:00:00.000Z')
    insertNode(db, 'node-3', '2026-01-01T00:00:00.000Z')

    for (let index = 0; index < 25; index += 1) {
      insertAttribute(db, 'node-1', `attribute-${index.toString().padStart(2, '0')}`, `value-${index}`)
    }
    insertAttribute(db, 'node-2', 'only-attribute', 'second-node-value')

    const firstPage = await repository.searchRelatedNodes('table-1', { limit: 2, offset: 0 })

    expect(firstPage.totalCount).toBe(3)
    expect(firstPage.nodes.map((entry) => entry.node.getId())).toEqual(['node-1', 'node-2'])
    expect(Object.keys(firstPage.nodes[0]?.attributes ?? {})).toHaveLength(25)
    expect(firstPage.nodes[0]?.attributes['attribute-24']).toBe('value-24')
    expect(firstPage.nodes[1]?.attributes).toEqual({ 'only-attribute': 'second-node-value' })
    expect(firstPage.hasNextPage).toBe(true)

    const secondPage = await repository.searchRelatedNodes('table-1', { limit: 1, offset: 1 })
    expect(secondPage.nodes.map((entry) => entry.node.getId())).toEqual(['node-2'])
    expect(secondPage.nodes[0]?.attributes).toEqual({ 'only-attribute': 'second-node-value' })
    expect(secondPage.hasPreviousPage).toBe(true)
  })

  test('keeps recursive paths simple by checking the complete visited path', async () => {
    for (const nodeId of ['a', 'b', 'c', 'd']) insertNode(db, nodeId)
    insertRelationType(db, 'depends-on')
    insertRelation(db, 'a-b', 'a', 'b')
    insertRelation(db, 'b-c', 'b', 'c')
    insertRelation(db, 'c-a-cycle', 'c', 'a')
    insertRelation(db, 'b-d', 'b', 'd')
    insertRelation(db, 'c-d', 'c', 'd')

    const paths = await repository.findPathsBetweenNodes('table-1', ['a'], ['d'], 8, ['depends-on'])

    expect(paths.map((path) => path.path)).toEqual([
      ['a', 'b', 'd'],
      ['a', 'b', 'c', 'd'],
    ])
    for (const path of paths) {
      expect(new Set(path.path).size).toBe(path.path.length)
    }
  })

  test('applies relation filters during both node selection and hydration', async () => {
    insertNode(db, 'source')
    insertNode(db, 'target')
    insertNode(db, 'unrelated')
    insertAttribute(db, 'source', 'status', 'active')
    insertRelationType(db, 'depends-on')
    insertRelation(db, 'source-target', 'source', 'target')

    const result = await repository.searchRelatedNodes('table-1', {
      limit: 5,
      offset: 0,
      relationFilters: [{
        direction: RelationDirection.OUTGOING,
        depth: RelationDepth.DIRECT,
        relationTypes: ['depends-on'],
      }],
    })

    expect(result.totalCount).toBe(1)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]?.node.getId()).toBe('source')
    expect(result.nodes[0]?.relationTypeId).toBe('depends-on')
    expect(result.nodes[0]?.attributes).toEqual({ status: 'active' })
  })

  test('bounds dependency expansion and never re-emits the start node through a cycle', async () => {
    insertNode(db, 'root')
    insertNode(db, 'cycle-a')
    insertNode(db, 'cycle-b')
    for (let index = 0; index < 150; index += 1) insertNode(db, `leaf-${index}`)
    insertRelationType(db, 'depends-on')
    insertRelation(db, 'root-cycle-a', 'root', 'cycle-a')
    insertRelation(db, 'cycle-a-cycle-b', 'cycle-a', 'cycle-b')
    insertRelation(db, 'cycle-b-root', 'cycle-b', 'root')
    for (let index = 0; index < 150; index += 1) {
      insertRelation(db, `root-leaf-${index}`, 'root', `leaf-${index}`)
    }

    const dependencies = await repository.getDependencyChain(
      'table-1',
      'root',
      RelationDirection.OUTGOING,
      ['depends-on'],
    )

    expect(dependencies).toHaveLength(100)
    expect(dependencies.some((dependency) => dependency.nodeId === 'root')).toBe(false)
    expect(dependencies.some((dependency) => dependency.nodeId === 'cycle-a')).toBe(true)
  })

  test('deduplicates convergent dependency frontiers before the path count can explode', async () => {
    insertNode(db, 'root')
    insertRelationType(db, 'depends-on')
    const layers = Array.from({ length: 4 }, (_, layerIndex) =>
      Array.from({ length: 12 }, (_, nodeIndex) => `layer-${layerIndex + 1}-${nodeIndex}`),
    )
    for (const layer of layers) {
      for (const nodeId of layer) insertNode(db, nodeId)
    }
    for (const target of layers[0] ?? []) insertRelation(db, `root-${target}`, 'root', target)
    for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
      for (const source of layers[layerIndex - 1] ?? []) {
        for (const target of layers[layerIndex] ?? []) {
          insertRelation(db, `${source}-${target}`, source, target)
        }
      }
    }

    const dependencies = await repository.getDependencyChain(
      'table-1',
      'root',
      RelationDirection.OUTGOING,
      ['depends-on'],
    )

    expect(dependencies).toHaveLength(48)
    expect(new Set(dependencies.map((dependency) => dependency.nodeId)).size).toBe(48)
    expect(dependencies.filter((dependency) => dependency.level === 4)).toHaveLength(12)
  })

  test('loads outgoing, incoming and bidirectional adjacency in one bounded SQL read', async () => {
    for (const nodeId of ['root', 'incoming', 'outgoing', 'self', 'other']) insertNode(db, nodeId)
    insertRelation(db, 'root-outgoing', 'root', 'outgoing')
    insertRelation(db, 'incoming-root', 'incoming', 'root')
    insertRelation(db, 'root-self', 'root', 'root')
    insertRelation(db, 'other-self', 'other', 'self')

    const outgoing = await relationRepository.findAdjacentByNodeIds(['root', 'incoming'], 'OUTGOING')
    expect(outgoing.get('root')?.map((relation) => relation.getId())).toEqual(['root-self', 'root-outgoing'])
    expect(outgoing.get('incoming')?.map((relation) => relation.getId())).toEqual(['incoming-root'])

    const incoming = await relationRepository.findAdjacentByNodeIds(['root', 'outgoing'], 'INCOMING')
    expect(incoming.get('root')?.map((relation) => relation.getId())).toEqual(['root-self', 'incoming-root'])
    expect(incoming.get('outgoing')?.map((relation) => relation.getId())).toEqual(['root-outgoing'])

    const both = await relationRepository.findAdjacentByNodeIds(['root', 'self'], 'BOTH')
    expect(both.get('root')?.map((relation) => relation.getId())).toEqual(['root-self', 'root-outgoing', 'incoming-root'])
    expect(both.get('self')?.map((relation) => relation.getId())).toEqual(['other-self'])
  })
})

function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      content TEXT NOT NULL,
      title TEXT,
      description TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE relation_types (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE
    );
    CREATE TABLE node_relations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      source_node_id TEXT,
      source_external_id TEXT NOT NULL,
      target_node_id TEXT,
      target_external_id TEXT NOT NULL,
      relation_type_id TEXT NOT NULL,
      properties TEXT,
      strength INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE attributes (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE
    );
    CREATE TABLE node_attributes (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      attribute_id TEXT NOT NULL,
      value TEXT
    );
  `)
}

function insertNode(db: Database, id: string, createdAt = '2026-01-01T00:00:00.000Z'): void {
  db.query(`
    INSERT INTO nodes (id, table_id, content, title, description, metadata, created_at, updated_at)
    VALUES (?, 'table-1', ?, ?, NULL, NULL, ?, ?)
  `).run(id, `content:${id}`, id, createdAt, createdAt)
}

function insertAttribute(db: Database, nodeId: string, identifier: string, value: string): void {
  const attributeId = `attribute:${identifier}`
  db.query('INSERT OR IGNORE INTO attributes (id, identifier) VALUES (?, ?)').run(attributeId, identifier)
  db.query(`
    INSERT INTO node_attributes (id, node_id, attribute_id, value)
    VALUES (?, ?, ?, ?)
  `).run(`node-attribute:${nodeId}:${identifier}`, nodeId, attributeId, JSON.stringify(value))
}

function insertRelationType(db: Database, identifier: string): void {
  db.query('INSERT INTO relation_types (id, identifier) VALUES (?, ?)').run(`relation-type:${identifier}`, identifier)
}

function insertRelation(db: Database, id: string, sourceNodeId: string, targetNodeId: string): void {
  const timestamp = '2026-01-01T00:00:00.000Z'
  db.query(`
    INSERT INTO node_relations (
      id, table_id, source_node_id, source_external_id, target_node_id, target_external_id,
      relation_type_id, properties, strength, created_at, updated_at
    ) VALUES (?, 'table-1', ?, 'internal', ?, 'internal', 'relation-type:depends-on', NULL, 1, ?, ?)
  `).run(id, sourceNodeId, targetNodeId, timestamp, timestamp)
}
