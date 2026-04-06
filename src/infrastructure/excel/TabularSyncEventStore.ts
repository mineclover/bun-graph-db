import type { Database } from 'bun:sqlite'

interface TabularSyncEventRow {
  id: number
  table_identifier: string
  mode: string
  status: string
  error_message: string | null
  created_at: string
}

export interface TabularSyncEventRecord {
  id: number
  tableIdentifier: string
  mode: string
  status: string
  errorMessage: string | null
  createdAt: string
}

interface TabularSyncEventSummaryRow {
  table_identifier: string
  mode: string
  success_count: number
  failure_count: number
  event_count: number
  last_created_at: string
  latest_error_message: string | null
}

export interface TabularSyncEventSummaryRecord {
  tableIdentifier: string
  mode: string
  eventCount: number
  successCount: number
  failureCount: number
  successRate: number
  lastCreatedAt: string
  latestErrorMessage: string | null
}

interface TabularSyncAggregateRow {
  total_events: number
  total_success: number
  total_failure: number
  last_success_at: string | null
  last_failure_at: string | null
}

export interface TabularSyncAggregateMetrics {
  totalEvents: number
  totalSuccess: number
  totalFailure: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
}

export class TabularSyncEventStore {
  constructor(private readonly db: Database) {}

  recordEvent(input: {
    tableIdentifier: string
    mode: string
    status: string
    errorMessage?: string | null
  }): void {
    this.db.run(
      `
        INSERT INTO tabular_sync_events (table_identifier, mode, status, error_message, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [input.tableIdentifier, input.mode, input.status, input.errorMessage || null],
    )
  }

  listRecent(filters: {
    limit?: number
    tableIdentifier?: string | null
    status?: string | null
    mode?: string | null
    createdAfter?: string | null
    createdBefore?: string | null
  } = {}): TabularSyncEventRecord[] {
    const limit = filters.limit ?? 20
    const conditions: string[] = []
    const params: Array<string | number> = []

    if (filters.tableIdentifier) {
      conditions.push('table_identifier = ?')
      params.push(filters.tableIdentifier)
    }

    if (filters.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }

    if (filters.mode) {
      conditions.push('mode = ?')
      params.push(filters.mode)
    }

    if (filters.createdAfter) {
      conditions.push("datetime(created_at) >= datetime(?)")
      params.push(filters.createdAfter)
    }

    if (filters.createdBefore) {
      conditions.push("datetime(created_at) <= datetime(?)")
      params.push(filters.createdBefore)
    }

    params.push(limit)

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db
      .query<TabularSyncEventRow, Array<string | number>>(
        `
          SELECT id, table_identifier, mode, status, error_message, created_at
          FROM tabular_sync_events
          ${whereClause}
          ORDER BY id DESC
          LIMIT ?
        `,
      )
      .all(...params)

    return rows.map((row) => ({
      id: row.id,
      tableIdentifier: row.table_identifier,
      mode: row.mode,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }))
  }

  summarize(filters: {
    tableIdentifier?: string | null
    status?: string | null
    mode?: string | null
    createdAfter?: string | null
    createdBefore?: string | null
    limit?: number
  } = {}): TabularSyncEventSummaryRecord[] {
    const limit = filters.limit ?? 100
    const conditions: string[] = []
    const params: Array<string | number> = []

    if (filters.tableIdentifier) {
      conditions.push('table_identifier = ?')
      params.push(filters.tableIdentifier)
    }

    if (filters.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }

    if (filters.mode) {
      conditions.push('mode = ?')
      params.push(filters.mode)
    }

    if (filters.createdAfter) {
      conditions.push("datetime(created_at) >= datetime(?)")
      params.push(filters.createdAfter)
    }

    if (filters.createdBefore) {
      conditions.push("datetime(created_at) <= datetime(?)")
      params.push(filters.createdBefore)
    }

    params.push(limit)

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db
      .query<TabularSyncEventSummaryRow, Array<string | number>>(
        `
          SELECT
            table_identifier,
            mode,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
            SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failure_count,
            COUNT(*) AS event_count,
            MAX(created_at) AS last_created_at,
            (
              SELECT error_message
              FROM tabular_sync_events recent
              WHERE recent.table_identifier = tabular_sync_events.table_identifier
                AND recent.mode = tabular_sync_events.mode
                AND recent.error_message IS NOT NULL
              ORDER BY recent.id DESC
              LIMIT 1
            ) AS latest_error_message
          FROM tabular_sync_events
          ${whereClause}
          GROUP BY table_identifier, mode
          ORDER BY last_created_at DESC, table_identifier ASC, mode ASC
          LIMIT ?
        `,
      )
      .all(...params)

    return rows.map((row) => ({
      tableIdentifier: row.table_identifier,
      mode: row.mode,
      eventCount: row.event_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      successRate: row.event_count === 0 ? 0 : row.success_count / row.event_count,
      lastCreatedAt: row.last_created_at,
      latestErrorMessage: row.latest_error_message,
    }))
  }

  getAggregateMetrics(): TabularSyncAggregateMetrics {
    const row =
      this.db
        .query<TabularSyncAggregateRow, []>(
          `
            SELECT
              COUNT(*) AS total_events,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS total_success,
              SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS total_failure,
              MAX(CASE WHEN status = 'success' THEN created_at END) AS last_success_at,
              MAX(CASE WHEN status = 'failure' THEN created_at END) AS last_failure_at
            FROM tabular_sync_events
          `,
        )
        .get() || {
        total_events: 0,
        total_success: 0,
        total_failure: 0,
        last_success_at: null,
        last_failure_at: null,
      }

    return {
      totalEvents: row.total_events || 0,
      totalSuccess: row.total_success || 0,
      totalFailure: row.total_failure || 0,
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at,
    }
  }
}
