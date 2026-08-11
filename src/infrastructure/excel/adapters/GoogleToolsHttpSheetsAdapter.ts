import type {
  GoogleSheetsCellValue,
  GoogleSheetsPatchCapableAdapter,
} from './GoogleSheetsAdapter.js'
import type { SheetRowDiff } from '../SheetSyncDiff.js'
import type { ExcelSheetSchema } from '../types/ExcelRowSchema.js'

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000
const MAX_REQUEST_TIMEOUT_MS = 120_000
const DEFAULT_MAX_RETRIES = 2
const MAX_RETRIES = 5
const DEFAULT_RETRY_BASE_DELAY_MS = 250
const DEFAULT_MAX_RETRY_DELAY_MS = 10_000
const MAX_RETRY_DELAY_MS = 60_000

type RetrySleep = (delayMs: number, signal?: AbortSignal) => Promise<void>

export interface GoogleToolsHttpSheetsAdapterOptions {
  baseUrl: string
  headers?: Record<string, string>
  /** Per-attempt timeout. Values are capped at two minutes. */
  requestTimeoutMs?: number
  /** Retries after the initial request for HTTP 429 and 503 only. */
  maxRetries?: number
  retryBaseDelayMs?: number
  /** Upper bound applied to Retry-After and exponential fallback delays. */
  maxRetryDelayMs?: number
  /** Optional adapter-lifetime cancellation signal. */
  signal?: AbortSignal
  /** Test seam for deterministic transport validation. */
  fetch?: typeof globalThis.fetch
  /** Test seam for deterministic backoff validation. */
  sleep?: RetrySleep
  /** Test seam for HTTP-date Retry-After parsing. */
  now?: () => number
}

export class GoogleToolsHttpSheetsAdapter implements GoogleSheetsPatchCapableAdapter {
  private readonly requestTimeoutMs: number
  private readonly maxRetries: number
  private readonly retryBaseDelayMs: number
  private readonly maxRetryDelayMs: number
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(private readonly options: GoogleToolsHttpSheetsAdapterOptions) {
    this.requestTimeoutMs = normalizeBoundedInteger(
      options.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS,
      1,
      MAX_REQUEST_TIMEOUT_MS,
    )
    this.maxRetries = normalizeBoundedInteger(
      options.maxRetries,
      DEFAULT_MAX_RETRIES,
      0,
      MAX_RETRIES,
    )
    this.retryBaseDelayMs = normalizeBoundedInteger(
      options.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
      0,
      MAX_RETRY_DELAY_MS,
    )
    this.maxRetryDelayMs = normalizeBoundedInteger(
      options.maxRetryDelayMs,
      DEFAULT_MAX_RETRY_DELAY_MS,
      0,
      MAX_RETRY_DELAY_MS,
    )
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  private async request(url: URL, init: RequestInit = {}): Promise<Response> {
    for (let retryCount = 0; ; retryCount++) {
      const response = await this.fetchAttempt(url, init)
      if (
        !isRetryableStatus(response.status) ||
        retryCount >= this.maxRetries
      ) {
        return response
      }

      const delayMs = this.retryDelayMs(response, retryCount)
      try {
        await response.body?.cancel()
      } catch {
        // The response status is authoritative; body cleanup is best effort.
      }
      await this.waitBeforeRetry(delayMs)
    }
  }

  private async fetchAttempt(url: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(
        new DOMException(
          `google-tools HTTP request timed out after ${this.requestTimeoutMs}ms`,
          'TimeoutError',
        ),
      )
    }, this.requestTimeoutMs)
    const upstreamSignals = [this.options.signal, init.signal].filter(
      (signal): signal is AbortSignal => Boolean(signal),
    )
    const abortListeners = upstreamSignals.map((signal) => {
      const listener = () => controller.abort(getAbortReason(signal))
      if (signal.aborted) {
        listener()
      } else {
        signal.addEventListener('abort', listener, { once: true })
      }
      return { listener, signal }
    })

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      })
      const body = response.body ? await response.arrayBuffer() : null
      return new Response(body, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      })
    } catch (error) {
      if (timedOut) {
        throw new DOMException(
          `google-tools HTTP request timed out after ${this.requestTimeoutMs}ms`,
          'TimeoutError',
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
      for (const { listener, signal } of abortListeners) {
        signal.removeEventListener('abort', listener)
      }
    }
  }

  private retryDelayMs(response: Response, retryCount: number): number {
    const retryAfterMs = parseRetryAfterMs(
      response.headers.get('retry-after'),
      this.options.now?.() ?? Date.now(),
    )
    const fallbackMs = this.retryBaseDelayMs * 2 ** retryCount
    return Math.min(retryAfterMs ?? fallbackMs, this.maxRetryDelayMs)
  }

  private async waitBeforeRetry(delayMs: number): Promise<void> {
    const signal = this.options.signal
    if (signal?.aborted) {
      throw getAbortReason(signal)
    }
    if (this.options.sleep) {
      await this.options.sleep(delayMs, signal)
      return
    }
    if (delayMs === 0) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', handleAbort)
        resolve()
      }, delayMs)
      const handleAbort = () => {
        clearTimeout(timeout)
        reject(signal ? getAbortReason(signal) : new DOMException('Aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', handleAbort, { once: true })
    })
  }

  private async getSpreadsheetInfo(spreadsheetId: string): Promise<{
    id?: string
    title?: string
    sheets?: Array<{ title?: string }>
  }> {
    const url = new URL(`/sheets/${encodeURIComponent(spreadsheetId)}`, this.options.baseUrl)
    const response = await this.request(url, {
      headers: this.options.headers,
    })

    if (!response.ok) {
      throw new Error(
        `google-tools HTTP getSpreadsheetInfo failed with status ${response.status}`,
      )
    }

    const payload = (await response.json()) as {
      data?: {
        id?: string
        title?: string
        sheets?: Array<{ title?: string }>
      }
    }

    return payload.data || {}
  }

  private async resolveSheetName(
    spreadsheetId: string,
    desiredSheetName: string,
  ): Promise<string> {
    const info = await this.getSpreadsheetInfo(spreadsheetId)
    const availableTitles = (info.sheets || [])
      .map((sheet) => sheet.title)
      .filter((title): title is string => Boolean(title))

    if (availableTitles.includes(desiredSheetName)) {
      return desiredSheetName
    }

    return availableTitles[0] || desiredSheetName
  }

  async readSheet(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<{ values: GoogleSheetsCellValue[][] }> {
    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const url = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/sheets/${encodeURIComponent(resolvedSheetName)}`,
      this.options.baseUrl,
    )

    const response = await this.request(url, {
      headers: this.options.headers,
    })

    if (!response.ok) {
      throw new Error(`google-tools HTTP readSheet failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      data?: {
        values?: GoogleSheetsCellValue[][]
      }
    }

    return {
      values: payload.data?.values || [],
    }
  }

  /**
   * google-tools exposes replacement as clear followed by write. Those calls
   * are not atomic: after a successful clear, any terminal write failure can
   * leave the sheet empty. The durable tabular worker compensates by retrying
   * the complete replacement from SQLite source-of-truth state.
   */
  async replaceSheet(
    spreadsheetId: string,
    sheetName: string,
    values: GoogleSheetsCellValue[][],
  ): Promise<void> {
    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const range = `${resolvedSheetName}!A1`
    const clearUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/values`,
      this.options.baseUrl,
    )
    clearUrl.searchParams.set('range', range)

    const clearResponse = await this.request(clearUrl, {
      method: 'DELETE',
      headers: this.options.headers,
    })

    if (!clearResponse.ok) {
      throw new Error(`google-tools HTTP clear failed with status ${clearResponse.status}`)
    }

    const writeUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/values`,
      this.options.baseUrl,
    )

    try {
      const writeResponse = await this.request(writeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.headers || {}),
        },
        body: JSON.stringify({
          range,
          values,
        }),
      })

      if (!writeResponse.ok) {
        throw new Error(
          `google-tools HTTP write failed with status ${writeResponse.status}`,
        )
      }
    } catch (error) {
      throw new Error(
        'google-tools HTTP non-atomic replacement was interrupted after clear; the sheet may remain empty until the durable full-sync retry succeeds',
        { cause: error },
      )
    }
  }

  async patchSheet(
    spreadsheetId: string,
    sheetName: string,
    schema: ExcelSheetSchema,
    previousRows: Array<Record<string, GoogleSheetsCellValue>>,
    nextRows: Array<Record<string, GoogleSheetsCellValue>>,
    rowDiffs: SheetRowDiff[],
  ): Promise<boolean> {
    if (rowDiffs.some((rowDiff) => rowDiff.kind === 'removed')) {
      return false
    }

    const resolvedSheetName = await this.resolveSheetName(spreadsheetId, sheetName)
    const orderedColumns = [...schema.columns].sort((a, b) => a.order - b.order)
    const previousIndexByKey = new Map(
      previousRows.map((row, index) => [String(row.__node_id ?? ''), index]),
    )
    const batchData: Array<{ range: string; values: GoogleSheetsCellValue[][] }> = []
    let addedRowOffset = 0

    for (const rowDiff of rowDiffs) {
      const nextRow = nextRows.find(
        (row) => String(row.__node_id ?? '') === rowDiff.key,
      )
      if (!nextRow) {
        continue
      }

      if (rowDiff.kind === 'changed') {
        const previousIndex = previousIndexByKey.get(rowDiff.key)
        if (previousIndex === undefined) {
          return false
        }
        const rowNumber = previousIndex + 2
        batchData.push({
          range: `'${resolvedSheetName}'!A${rowNumber}`,
          values: [
            orderedColumns.map((column) => nextRow[column.columnName] ?? null),
          ],
        })
        continue
      }

      if (rowDiff.kind === 'added') {
        const rowNumber = previousRows.length + addedRowOffset + 2
        addedRowOffset += 1
        batchData.push({
          range: `'${resolvedSheetName}'!A${rowNumber}`,
          values: [
            orderedColumns.map((column) => nextRow[column.columnName] ?? null),
          ],
        })
      }
    }

    if (batchData.length === 0) {
      return true
    }

    const batchUrl = new URL(
      `/sheets/${encodeURIComponent(spreadsheetId)}/batch`,
      this.options.baseUrl,
    )
    const response = await this.request(batchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.headers || {}),
      },
      body: JSON.stringify({
        data: batchData,
      }),
    })

    if (!response.ok) {
      throw new Error(`google-tools HTTP batch patch failed with status ${response.status}`)
    }

    return true
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503
}

function parseRetryAfterMs(value: string | null, nowMs: number): number | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000
  }

  const retryAtMs = Date.parse(trimmed)
  if (!Number.isFinite(retryAtMs)) {
    return null
  }
  return Math.max(0, retryAtMs - nowMs)
}

function normalizeBoundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value as number)))
}

function getAbortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Aborted', 'AbortError')
}
