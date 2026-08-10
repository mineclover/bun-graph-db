import type { Database } from 'bun:sqlite'

export type TabularSyncJobMode = 'sync' | 'clear'
export type TabularSyncJobStatus =
  | 'queued'
  | 'running'
  | 'retry_wait'
  | 'paused'
  | 'succeeded'
  | 'failed'

interface TabularSyncJobRow {
  id: number
  table_identifier: string
  mode: TabularSyncJobMode
  status: TabularSyncJobStatus
  attempts: number
  next_attempt_at: string | null
  lease_owner: string | null
  lease_expires_at: string | null
  last_error: string | null
  revision: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TabularSyncJobRecord {
  id: number
  tableIdentifier: string
  mode: TabularSyncJobMode
  status: TabularSyncJobStatus
  attempts: number
  nextAttemptAt: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  lastError: string | null
  revision: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

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

  /**
   * Creates or refreshes the one pending delivery for a table.  A revision is
   * incremented on every notification so a write that arrives while a worker
   * holds a lease is delivered by a subsequent run rather than being lost.
   */
  enqueueJob(input: { tableIdentifier: string; mode: TabularSyncJobMode; nextAttemptAt?: string }): TabularSyncJobRecord {
    const nextAttemptAt = input.nextAttemptAt || new Date().toISOString()
    this.db.run(
      `
        INSERT INTO tabular_sync_jobs (
          table_identifier, mode, status, attempts, next_attempt_at, revision, created_at, updated_at
        ) VALUES (?, ?, 'queued', 0, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(table_identifier) DO UPDATE SET
          mode = CASE
            WHEN tabular_sync_jobs.mode = 'clear' OR excluded.mode = 'clear' THEN 'clear'
            ELSE excluded.mode
          END,
          status = CASE
            WHEN tabular_sync_jobs.status = 'paused' THEN 'paused'
            WHEN tabular_sync_jobs.status = 'running' THEN 'running'
            ELSE 'queued'
          END,
          attempts = CASE
            WHEN tabular_sync_jobs.status IN ('succeeded', 'failed') THEN 0
            ELSE tabular_sync_jobs.attempts
          END,
          next_attempt_at = CASE
            WHEN tabular_sync_jobs.status IN ('paused', 'running') THEN tabular_sync_jobs.next_attempt_at
            ELSE excluded.next_attempt_at
          END,
          lease_owner = CASE WHEN tabular_sync_jobs.status = 'running' THEN tabular_sync_jobs.lease_owner ELSE NULL END,
          lease_expires_at = CASE WHEN tabular_sync_jobs.status = 'running' THEN tabular_sync_jobs.lease_expires_at ELSE NULL END,
          last_error = CASE
            WHEN tabular_sync_jobs.status IN ('succeeded', 'failed') THEN NULL
            ELSE tabular_sync_jobs.last_error
          END,
          revision = tabular_sync_jobs.revision + 1,
          completed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
      [input.tableIdentifier, input.mode, nextAttemptAt],
    )

    const job = this.getJobByTable(input.tableIdentifier)
    if (!job) {
      throw new Error(`Failed to enqueue tabular sync job for ${input.tableIdentifier}`)
    }
    return job
  }

  getJobById(id: number): TabularSyncJobRecord | null {
    const row = this.db
      .query<TabularSyncJobRow, [number]>(
        `SELECT * FROM tabular_sync_jobs WHERE id = ?`,
      )
      .get(id)
    return row ? this.toJobRecord(row) : null
  }

  getJobByTable(tableIdentifier: string): TabularSyncJobRecord | null {
    const row = this.db
      .query<TabularSyncJobRow, [string]>(
        `SELECT * FROM tabular_sync_jobs WHERE table_identifier = ?`,
      )
      .get(tableIdentifier)
    return row ? this.toJobRecord(row) : null
  }

  listJobs(filters: {
    tableIdentifier?: string | null
    status?: TabularSyncJobStatus | null
    limit?: number
  } = {}): TabularSyncJobRecord[] {
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
    params.push(filters.limit ?? 50)
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return this.db
      .query<TabularSyncJobRow, Array<string | number>>(
        `SELECT * FROM tabular_sync_jobs ${whereClause} ORDER BY updated_at DESC, id DESC LIMIT ?`,
      )
      .all(...params)
      .map((row) => this.toJobRecord(row))
  }

  /** Returns unfinished work to the queue when a service process starts. */
  recoverUnfinishedJobs(now = new Date().toISOString()): number {
    const result = this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = 'retry_wait', next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'running'
      `,
      [now],
    )
    return result.changes
  }

  /** Claims one due job under a time-bounded lease. This is atomic in SQLite. */
  claimNextDueJob(input: {
    workerId: string
    leaseDurationMs: number
    now?: Date
  }): TabularSyncJobRecord | null {
    const now = input.now || new Date()
    const nowIso = now.toISOString()
    const leaseExpiresAt = new Date(now.getTime() + input.leaseDurationMs).toISOString()
    const claim = this.db.transaction(() => {
      this.db.run(
        `
          UPDATE tabular_sync_jobs
          SET status = 'retry_wait', next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'running' AND lease_expires_at IS NOT NULL AND datetime(lease_expires_at) <= datetime(?)
        `,
        [nowIso, nowIso],
      )
      const candidate = this.db
        .query<{ id: number }, [string]>(
          `
            SELECT id FROM tabular_sync_jobs
            WHERE status IN ('queued', 'retry_wait')
              AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime(?))
            ORDER BY CASE status WHEN 'queued' THEN 0 ELSE 1 END, next_attempt_at ASC, id ASC
            LIMIT 1
          `,
        )
        .get(nowIso)
      if (!candidate) {
        return null
      }
      this.db.run(
        `
          UPDATE tabular_sync_jobs
          SET status = 'running', attempts = attempts + 1, lease_owner = ?, lease_expires_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.workerId, leaseExpiresAt, candidate.id],
      )
      return this.getJobById(candidate.id)
    })
    return claim()
  }

  completeJobSuccess(job: Pick<TabularSyncJobRecord, 'id' | 'revision' | 'leaseOwner'>): TabularSyncJobRecord | null {
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = CASE WHEN revision = ? THEN 'succeeded' ELSE 'queued' END,
            next_attempt_at = CASE WHEN revision = ? THEN NULL ELSE ? END,
            lease_owner = NULL, lease_expires_at = NULL, last_error = NULL,
            completed_at = CASE WHEN revision = ? THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'running' AND lease_owner = ?
      `,
      [job.revision, job.revision, new Date().toISOString(), job.revision, job.id, job.leaseOwner],
    )
    return this.getJobById(job.id)
  }

  completeJobFailure(input: {
    job: Pick<TabularSyncJobRecord, 'id' | 'revision' | 'leaseOwner' | 'attempts'>
    error: string
    maxAttempts: number
    retryDelayMs: number
  }): TabularSyncJobRecord | null {
    const shouldRetry = input.job.attempts < input.maxAttempts
    const nextAttemptAt = new Date(Date.now() + input.retryDelayMs).toISOString()
    const nextStatus: TabularSyncJobStatus = shouldRetry ? 'retry_wait' : 'failed'
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = CASE WHEN revision <> ? THEN 'queued' ELSE ? END,
            next_attempt_at = CASE
              WHEN revision <> ? THEN ?
              WHEN ? = 'retry_wait' THEN ?
              ELSE NULL
            END,
            lease_owner = NULL, lease_expires_at = NULL, last_error = ?,
            completed_at = CASE WHEN revision = ? AND ? = 'failed' THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'running' AND lease_owner = ?
      `,
      [
        input.job.revision,
        nextStatus,
        input.job.revision,
        new Date().toISOString(),
        nextStatus,
        nextAttemptAt,
        input.error,
        input.job.revision,
        nextStatus,
        input.job.id,
        input.job.leaseOwner,
      ],
    )
    return this.getJobById(input.job.id)
  }

  pauseJob(tableIdentifier: string): TabularSyncJobRecord | null {
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = 'paused', lease_owner = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE table_identifier = ? AND status <> 'succeeded'
      `,
      [tableIdentifier],
    )
    return this.getJobByTable(tableIdentifier)
  }

  resumeJob(tableIdentifier: string): TabularSyncJobRecord | null {
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = 'queued', attempts = 0, next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_error = NULL, completed_at = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE table_identifier = ? AND status IN ('paused', 'failed')
      `,
      [new Date().toISOString(), tableIdentifier],
    )
    return this.getJobByTable(tableIdentifier)
  }

  retryJob(tableIdentifier: string): TabularSyncJobRecord | null {
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = 'queued', attempts = 0, next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_error = NULL, completed_at = NULL, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE table_identifier = ? AND status IN ('paused', 'failed', 'retry_wait')
      `,
      [new Date().toISOString(), tableIdentifier],
    )
    return this.getJobByTable(tableIdentifier)
  }

  makeJobDue(tableIdentifier: string): TabularSyncJobRecord | null {
    this.db.run(
      `
        UPDATE tabular_sync_jobs
        SET status = 'queued', next_attempt_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE table_identifier = ? AND status IN ('queued', 'retry_wait')
      `,
      [new Date().toISOString(), tableIdentifier],
    )
    return this.getJobByTable(tableIdentifier)
  }

  getNextDueAt(): string | null {
    const row = this.db
      .query<{ next_attempt_at: string | null }, []>(
        `
          SELECT next_attempt_at FROM tabular_sync_jobs
          WHERE status IN ('queued', 'retry_wait')
          ORDER BY CASE WHEN next_attempt_at IS NULL THEN 0 ELSE 1 END, next_attempt_at ASC
          LIMIT 1
        `,
      )
      .get()
    return row?.next_attempt_at || null
  }

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

  private toJobRecord(row: TabularSyncJobRow): TabularSyncJobRecord {
    return {
      id: row.id,
      tableIdentifier: row.table_identifier,
      mode: row.mode,
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      leaseOwner: row.lease_owner,
      leaseExpiresAt: row.lease_expires_at,
      lastError: row.last_error,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    }
  }
}
