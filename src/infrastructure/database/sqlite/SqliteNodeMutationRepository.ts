import type { Database, SQLQueryBindings } from 'bun:sqlite'
import type { NodeId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import type {
  INodeMutationRepository,
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

const NODE_COLUMNS = 'id, table_id, content, title, description, metadata, created_at, updated_at'

export class SqliteNodeMutationRepository implements INodeMutationRepository {
  constructor(private readonly db: Database) {}

  async create(node: Node, attributes: readonly NodeAttributeMutation[]): Promise<Node> {
    try {
      return this.db.transaction(() => {
        const data = node.toDatabase()
        const row = this.db
          .query<NodeRow, [string, string, string | null, string | null, string | null, string, string]>(`
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
          row = this.db.query<NodeRow, [string]>(`SELECT ${NODE_COLUMNS} FROM nodes WHERE id = ?`).get(id)
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
