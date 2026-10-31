import type { Database, SQLQueryBindings } from 'bun:sqlite'
import type { NodeId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type {
  INodeMutationRepository,
  NodeAttributeBatchWrite,
  NodeAttributeMutation,
  NodeFieldMutation,
} from '@/domain/repositories/INodeMutationRepository.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'
import { stringifySafeJson } from '@/shared/utils/safeJson.js'

interface NodeRow {
  id: number
  table_id: number
  content: string
  title: string | null
  description: string | null
  metadata: string | null
  created_at: string
  updated_at: string
}

interface NodeAttributeRow {
  id: number
  node_id: number
  attribute_id: number
  value: string
  created_at: string
  updated_at: string
}

const NODE_COLUMNS = 'id, table_id, content, title, description, metadata, created_at, updated_at'

export class SqliteNodeMutationRepository implements INodeMutationRepository {
  constructor(private readonly db: Database) {}

  async create(node: Node, attributes: readonly NodeAttributeMutation[]): Promise<Node> {
    try {
      return this.db.transaction(() => {
        const data = node.toDatabase()
        const row = this.db
          .query<
            NodeRow,
            [string, string, string | null, string | null, string | null, string, string]
          >(`
            INSERT INTO nodes (table_id, content, title, description, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING ${NODE_COLUMNS}
          `)
          .get(
            data.table_id,
            data.content,
            data.title,
            data.description,
            data.metadata,
            data.created_at,
            data.updated_at,
          )

        if (!row) throw new DatabaseException('Node insert did not return a row')
        this.upsertAttributes(String(row.id), attributes)
        return this.toEntity(row)
      })()
    } catch (error) {
      if (error instanceof DatabaseException) throw error
      throw new DatabaseException(`Failed to atomically create node: ${error}`)
    }
  }

  async createMany(
    entries: ReadonlyArray<{ node: Node; attributes: readonly NodeAttributeMutation[] }>,
  ): Promise<Node[]> {
    if (entries.length === 0) return []
    try {
      const insertNodeStmt = this.db.query<
        NodeRow,
        [string, string, string | null, string | null, string | null, string, string]
      >(`
        INSERT INTO nodes (table_id, content, title, description, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING ${NODE_COLUMNS}
      `)
      const upsertAttrStmt = this.db.prepare(`
        INSERT INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(node_id, attribute_id) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)

      return this.db.transaction((): Node[] => {
        const created: Node[] = []
        const timestamp = new Date().toISOString()
        for (const entry of entries) {
          const data = entry.node.toDatabase()
          const row = insertNodeStmt.get(
            data.table_id,
            data.content,
            data.title,
            data.description,
            data.metadata,
            data.created_at,
            data.updated_at,
          )
          if (!row) throw new DatabaseException('Node insert did not return a row')
          const nodeId = String(row.id)
          for (const attribute of entry.attributes) {
            upsertAttrStmt.run(nodeId, attribute.attributeId, attribute.value, timestamp, timestamp)
          }
          created.push(this.toEntity(row))
        }
        return created
      })()
    } catch (error) {
      if (error instanceof DatabaseException) throw error
      throw new DatabaseException(`Failed to atomically create batch of nodes: ${error}`)
    }
  }

  async update(
    id: NodeId,
    fields: NodeFieldMutation,
    attributes: readonly NodeAttributeMutation[],
  ): Promise<Node> {
    try {
      return this.db.transaction(() => {
        const assignments: string[] = []
        const bindings: SQLQueryBindings[] = []

        if (fields.content !== undefined) {
          assignments.push('content = ?')
          bindings.push(fields.content)
        }
        if (fields.title !== undefined) {
          assignments.push('title = ?')
          bindings.push(fields.title)
        }
        if (fields.description !== undefined) {
          assignments.push('description = ?')
          bindings.push(fields.description)
        }
        if (fields.metadata !== undefined) {
          assignments.push('metadata = ?')
          bindings.push(stringifySafeJson(fields.metadata))
        }

        let row: NodeRow | null
        if (assignments.length > 0) {
          assignments.push('updated_at = ?')
          bindings.push(new Date().toISOString(), id)
          row = this.db
            .query<NodeRow, SQLQueryBindings[]>(`
              UPDATE nodes
              SET ${assignments.join(', ')}
              WHERE id = ?
              RETURNING ${NODE_COLUMNS}
            `)
            .get(...bindings)
        } else {
          row = this.db
            .query<NodeRow, [string]>(`SELECT ${NODE_COLUMNS} FROM nodes WHERE id = ?`)
            .get(id)
        }

        if (!row) throw new DatabaseException(`Node with id ${id} not found`)
        this.upsertAttributes(id, attributes)
        return this.toEntity(row)
      })()
    } catch (error) {
      if (error instanceof DatabaseException) throw error
      throw new DatabaseException(`Failed to atomically update node: ${error}`)
    }
  }

  async upsertAttributesBatch(
    entries: readonly NodeAttributeBatchWrite[],
  ): Promise<NodeAttribute[]> {
    if (entries.length === 0) return []
    try {
      const statement = this.db.query<
        NodeAttributeRow,
        [string, string, string, string, string]
      >(`
        INSERT INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(node_id, attribute_id) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
        RETURNING id, node_id, attribute_id, value, created_at, updated_at
      `)
      const timestamp = new Date().toISOString()

      return this.db.transaction((): NodeAttribute[] => {
        const persisted: NodeAttribute[] = []
        for (const entry of entries) {
          const row = statement.get(
            entry.nodeId,
            entry.attributeId,
            entry.value,
            timestamp,
            timestamp,
          )
          if (!row) {
            throw new DatabaseException(
              `Attribute upsert did not return a row for node ${entry.nodeId}`,
            )
          }
          persisted.push(
            NodeAttribute.fromDatabase(
              String(row.id),
              String(row.node_id),
              String(row.attribute_id),
              row.value,
              new Date(row.created_at),
              new Date(row.updated_at),
            ),
          )
        }
        return persisted
      })()
    } catch (error) {
      if (error instanceof DatabaseException) throw error
      throw new DatabaseException(`Failed to batch upsert node attributes: ${error}`)
    }
  }

  private upsertAttributes(nodeId: string, attributes: readonly NodeAttributeMutation[]): void {
    if (attributes.length === 0) return

    const statement = this.db.prepare(`
      INSERT INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(node_id, attribute_id) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    const timestamp = new Date().toISOString()
    for (const attribute of attributes) {
      statement.run(nodeId, attribute.attributeId, attribute.value, timestamp, timestamp)
    }
  }

  private toEntity(row: NodeRow): Node {
    return Node.fromDatabase(
      String(row.id),
      String(row.table_id),
      row.content,
      row.title,
      row.description,
      row.metadata,
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }
}
