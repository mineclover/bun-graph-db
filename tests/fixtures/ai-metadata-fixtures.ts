type SqliteDb = {
  query: <T = any, P extends any[] = any[]>(sql: string) => {
    get: (...params: P) => T
    all: (...params: P) => T[]
  }
  run: (sql: string, params?: any[]) => { lastInsertRowid: number | bigint }
}

function nowSql(): string {
  return "datetime('now')"
}

export function insertTable(
  db: SqliteDb,
  input: { identifier: string; description?: string | null },
): { id: string; identifier: string } {
  const result = db.run(
    `INSERT INTO tables (identifier, description, created_at, updated_at) VALUES (?, ?, ${nowSql()}, ${nowSql()})`,
    [input.identifier, input.description || null],
  )

  const insertedId = String(result.lastInsertRowid)
  try {
    db.run(`UPDATE tables SET name = ? WHERE id = ?`, [input.identifier, insertedId])
  } catch {
    // Optional compatibility column
  }

  return {
    id: insertedId,
    identifier: input.identifier,
  }
}

function resolveAttributeTypeId(db: SqliteDb, attributeTypeIdentifier: string): string {
  let row = db
    .query<{ id: number }, [string]>('SELECT id FROM attribute_types WHERE identifier = ? LIMIT 1')
    .get(attributeTypeIdentifier)

  if (!row) {
    const typeMappings: Record<string, { jsonType: string; format: string | null }> = {
      select: { jsonType: 'string', format: null },
      multiselect: { jsonType: 'array', format: null },
      textarea: { jsonType: 'string', format: null },
      file: { jsonType: 'string', format: 'uri' },
      location: { jsonType: 'string', format: null },
    }

    const mapping = typeMappings[attributeTypeIdentifier] || { jsonType: 'string', format: null }
    const insertResult = db.run(
      `INSERT INTO attribute_types (identifier, json_type, format, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${nowSql()}, ${nowSql()})`,
      [
        attributeTypeIdentifier,
        mapping.jsonType,
        mapping.format,
        `${attributeTypeIdentifier} compatibility type`,
      ],
    )
    row = { id: Number(insertResult.lastInsertRowid) }
  }

  if (!row) {
    throw new Error(`Attribute type '${attributeTypeIdentifier}' not found`)
  }

  return String(row.id)
}

export function insertAttribute(
  db: SqliteDb,
  input: {
    tableId: string
    identifier: string
    name: string
    attributeTypeIdentifier: string
    required?: boolean
    searchable?: boolean
    description?: string | null
  },
): { id: string; identifier: string } {
  const attributeTypeId = resolveAttributeTypeId(db, input.attributeTypeIdentifier)
  const metadata =
    input.searchable !== undefined ? JSON.stringify({ searchable: input.searchable }) : null

  const result = db.run(
    `INSERT INTO attributes (
      table_id, identifier, name, attribute_type_id, description, is_required, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ${nowSql()}, ${nowSql()})`,
    [
      input.tableId,
      input.identifier,
      input.name,
      attributeTypeId,
      input.description || null,
      input.required ? 1 : 0,
      metadata,
    ],
  )

  const insertedId = String(result.lastInsertRowid)
  try {
    db.run(`UPDATE attributes SET required = ?, searchable = ? WHERE id = ?`, [
      input.required ? 1 : 0,
      input.searchable ? 1 : 0,
      insertedId,
    ])
  } catch {
    // Optional compatibility columns
  }

  return {
    id: insertedId,
    identifier: input.identifier,
  }
}

export function insertTemplate(
  db: SqliteDb,
  input: {
    identifier: string
    name: string
    description?: string | null
    query: string
    tableId?: string
    tableIdentifier?: string
    tags?: string[]
  },
): { id: string; identifier: string } {
  const applicableTables =
    input.tableId || input.tableIdentifier
      ? JSON.stringify([input.tableId, input.tableIdentifier].filter(Boolean))
      : null
  const tags = input.tags ? JSON.stringify(input.tags) : JSON.stringify([])
  const operationType = input.query.trim().toLowerCase().startsWith('mutation') ? 'mutation' : 'query'

  const result = db.run(
    `INSERT INTO templates (
      identifier, name, description, query_text, operation_type, applicable_tables, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ${nowSql()}, ${nowSql()})`,
    [
      input.identifier,
      input.name,
      input.description || null,
      input.query,
      operationType,
      applicableTables,
      tags,
    ],
  )

  const insertedId = String(result.lastInsertRowid)
  try {
    db.run(`UPDATE templates SET query = ?, table_id = ? WHERE id = ?`, [
      input.query,
      input.tableId || null,
      insertedId,
    ])
  } catch {
    // Optional compatibility columns
  }

  return {
    id: insertedId,
    identifier: input.identifier,
  }
}

export function insertNode(
  db: SqliteDb,
  input: { tableId: string; title: string; content: string },
): { id: string } {
  const result = db.run(
    `INSERT INTO nodes (table_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ${nowSql()}, ${nowSql()})`,
    [input.tableId, input.title, input.content],
  )

  return { id: String(result.lastInsertRowid) }
}

export function insertNodeAttributes(
  db: SqliteDb,
  input: { nodeId: string; tableId: string; values: Record<string, string> },
): void {
  const attributeRows = db
    .query<{ id: number; identifier: string }, [string]>(
      'SELECT id, identifier FROM attributes WHERE table_id = ?',
    )
    .all(input.tableId)
  const attributeIdByIdentifier = new Map(attributeRows.map((row) => [row.identifier, String(row.id)]))

  for (const [identifier, value] of Object.entries(input.values)) {
    const attributeId = attributeIdByIdentifier.get(identifier)
    if (!attributeId) {
      throw new Error(`Attribute '${identifier}' not found for table ${input.tableId}`)
    }

    db.run(
      `INSERT INTO node_attributes (node_id, attribute_id, value, created_at, updated_at)
       VALUES (?, ?, ?, ${nowSql()}, ${nowSql()})`,
      [input.nodeId, attributeId, value],
    )
  }
}
