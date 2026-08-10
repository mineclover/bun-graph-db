import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { SqliteNodeSearchRepository } from '../../src/infrastructure/database/sqlite/SqliteNodeSearchRepository'

const databases: Database[] = []

afterEach(() => {
  databases.splice(0).forEach((database) => {
    database.close()
  })
})

describe('SqliteNodeSearchRepository full-text search', () => {
  test('uses the table-scoped FTS index for text filters', async () => {
    const db = new Database(':memory:')
    databases.push(db)
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
      CREATE TABLE node_attributes (node_id TEXT, attribute_id TEXT, value TEXT);
      CREATE TABLE attributes (id TEXT, identifier TEXT, attribute_type_id TEXT);
      CREATE TABLE attribute_types (id TEXT, json_type TEXT);
      CREATE VIRTUAL TABLE node_search_fts USING fts5(node_id UNINDEXED, table_id UNINDEXED, content);
      INSERT INTO nodes VALUES
        ('alpha-match', 'alpha', 'release candidate ships today', 'Release', NULL, NULL, '2026-08-10', '2026-08-10'),
        ('beta-match', 'beta', 'release candidate belongs elsewhere', 'Release', NULL, NULL, '2026-08-10', '2026-08-10'),
        ('alpha-miss', 'alpha', 'unrelated note', 'Note', NULL, NULL, '2026-08-10', '2026-08-10');
      INSERT INTO node_search_fts(rowid, node_id, table_id, content)
      SELECT rowid, id, table_id, content || ' ' || title FROM nodes;
    `)

    const repository = new SqliteNodeSearchRepository(db)
    const result = await repository.searchNodes(
      'alpha',
      {
        conditions: [
          {
            logicalOperator: 'and',
            filters: [{ field: '_text_search', operator: 'contains', value: 'release candidate', valueType: 'string' }],
          },
        ],
        limit: 10,
        offset: 0,
      },
      [],
    )

    expect(result.total).toBe(1)
    expect(result.data.map((item) => item.node.getId())).toEqual(['alpha-match'])
    expect(result.data[0]?.relevanceScore).toBeNumber()
  })
})
