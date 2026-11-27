import { afterEach, describe, expect, test } from 'vitest'
import { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import { Node } from '../../src/domain/entities/Node'
import { SqliteNodeMutationRepository } from '../../src/infrastructure/database/sqlite/SqliteNodeMutationRepository'

const databases: Database[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe('SqliteNodeMutationRepository', () => {
  test('creates a node and all attributes in one transaction', async () => {
    const { database, repository } = createRepository()

    const created = await repository.create(
      Node.create('1', 'first', 'First node'),
      [
        { attributeId: '10', value: 'open' },
        { attributeId: '11', value: '3' },
      ],
    )

    expect(created.getId()).toBe('1')
    expect(database.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM nodes').get()?.count).toBe(1)
    expect(
      database
        .query<{ attribute_id: number; value: string }, []>(
          'SELECT attribute_id, value FROM node_attributes ORDER BY attribute_id',
        )
        .all(),
    ).toEqual([
      { attribute_id: 10, value: 'open' },
      { attribute_id: 11, value: '3' },
    ])
  })

  test('rolls back the node when any attribute insert fails', async () => {
    const { database, repository } = createRepository()

    await expect(repository.create(
      Node.create('1', 'will-roll-back'),
      [{ attributeId: '999', value: 'missing foreign key' }],
    )).rejects.toThrow('Failed to atomically create node')

    expect(database.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM nodes').get()?.count).toBe(0)
  })

  test('upserts attributes and rolls back field changes on failure', async () => {
    const { database, repository } = createRepository()
    const created = await repository.create(
      Node.create('1', 'before'),
      [{ attributeId: '10', value: 'open' }],
    )

    const updated = await repository.update(created.getId(), { content: 'after' }, [
      { attributeId: '10', value: 'done' },
      { attributeId: '11', value: '5' },
    ])
    expect(updated.getContent()).toBe('after')
    expect(database.query<{ value: string }, [string]>(
      'SELECT value FROM node_attributes WHERE node_id = ? AND attribute_id = 10',
    ).get(created.getId())?.value).toBe('done')

    await expect(repository.update(created.getId(), { content: 'must-not-stick' }, [
      { attributeId: '999', value: 'invalid' },
    ])).rejects.toThrow('Failed to atomically update node')
    expect(database.query<{ content: string }, [string]>('SELECT content FROM nodes WHERE id = ?').get(
      created.getId(),
    )?.content).toBe('after')
  })
})

function createRepository() {
  const database = new Database(':memory:')
  databases.push(database)
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE tables (id INTEGER PRIMARY KEY, identifier TEXT NOT NULL UNIQUE);
    CREATE TABLE nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      content TEXT NOT NULL,
      title TEXT,
      description TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(table_id, content)
    );
    CREATE TABLE attributes (
      id INTEGER PRIMARY KEY,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      identifier TEXT NOT NULL,
      UNIQUE(table_id, identifier)
    );
    CREATE TABLE node_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(node_id, attribute_id)
    );
    INSERT INTO tables (id, identifier) VALUES (1, 'tasks');
    INSERT INTO attributes (id, table_id, identifier) VALUES (10, 1, 'status'), (11, 1, 'effort');
  `)

  return { database, repository: new SqliteNodeMutationRepository(database) }
}
