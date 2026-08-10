import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TabularSyncEventStore } from '@/infrastructure/excel/TabularSyncEventStore.js'

function createStore(): { db: Database; store: TabularSyncEventStore } {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE tabular_sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_identifier TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      lease_owner TEXT,
      lease_expires_at TEXT,
      last_error TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
    CREATE TABLE tabular_sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_identifier TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  return { db, store: new TabularSyncEventStore(db) }
}

describe('TabularSyncEventStore durable jobs', () => {
  const databases: Database[] = []

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.close()
    }
  })

  test('retains a notification received while a leased job is running', () => {
    const { db, store } = createStore()
    databases.push(db)

    const initial = store.enqueueJob({ tableIdentifier: 'users', mode: 'sync' })
    const firstClaim = store.claimNextDueJob({ workerId: 'worker-a', leaseDurationMs: 60_000 })
    if (!firstClaim) {
      throw new Error('Expected the queued job to be claimed')
    }
    expect(firstClaim?.id).toBe(initial.id)
    expect(firstClaim?.status).toBe('running')
    expect(firstClaim?.attempts).toBe(1)

    const afterClearNotification = store.enqueueJob({ tableIdentifier: 'users', mode: 'clear' })
    expect(afterClearNotification.status).toBe('running')
    expect(afterClearNotification.mode).toBe('clear')
    expect(afterClearNotification.revision).toBeGreaterThan(firstClaim?.revision || 0)

    const queuedFollowUp = store.completeJobSuccess(firstClaim)
    expect(queuedFollowUp?.status).toBe('queued')
    expect(queuedFollowUp?.mode).toBe('clear')

    const followUpClaim = store.claimNextDueJob({ workerId: 'worker-a', leaseDurationMs: 60_000 })
    if (!followUpClaim) {
      throw new Error('Expected the follow-up job to be claimed')
    }
    expect(followUpClaim?.mode).toBe('clear')
    expect(store.completeJobSuccess(followUpClaim)?.status).toBe('succeeded')
  })

  test('recovers unfinished leases and supports paused terminal-job retry', () => {
    const { db, store } = createStore()
    databases.push(db)

    store.enqueueJob({ tableIdentifier: 'users', mode: 'sync' })
    const claimed = store.claimNextDueJob({ workerId: 'worker-a', leaseDurationMs: 60_000 })
    expect(claimed?.status).toBe('running')
    expect(store.recoverUnfinishedJobs()).toBe(1)
    expect(store.getJobByTable('users')?.status).toBe('retry_wait')

    store.makeJobDue('users')
    const retryClaim = store.claimNextDueJob({ workerId: 'worker-b', leaseDurationMs: 60_000 })
    if (!retryClaim) {
      throw new Error('Expected recovered job to be claimed')
    }
    const failed = store.completeJobFailure({
      job: retryClaim,
      error: 'destination unavailable',
      maxAttempts: retryClaim.attempts,
      retryDelayMs: 1_000,
    })
    expect(failed?.status).toBe('failed')
    expect(failed?.lastError).toBe('destination unavailable')

    expect(store.pauseJob('users')?.status).toBe('paused')
    expect(store.retryJob('users')?.status).toBe('queued')
    expect(store.getJobByTable('users')?.attempts).toBe(0)
  })
})
