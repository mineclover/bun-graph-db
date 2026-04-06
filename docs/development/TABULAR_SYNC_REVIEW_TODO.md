# Tabular Sync Review TODO

Last updated: 2026-04-07

## Purpose

This document captures follow-up work after the tabular sync structure review.

The goal is to distinguish:

- what has already been hardened
- what still needs product/architecture decisions
- what should remain intentionally deferred

## Already Addressed

- active config is reloaded by the hook without requiring process restart
- route resolution now fails closed when `route.targetId` is invalid
- Google Sheets connection tests fail when adapter or `spreadsheetId` is missing
- Excel targets cannot be activated as live sync configs while Excel write support is still missing
- top-level sync totals are derived from persisted event history instead of process-only counters
- unit/integration coverage exists for:
  - config validation
  - hook reload behavior
  - fail-closed route resolution
  - MCP/HTTP admin behavior

## Open Follow-ups

### 1. Transport Policy Cleanup

Current status:

- `google-tools-http` is the recommended default
- `pipe-builder-table-adapter` still exists as an advanced path
- `google-tools-submodule` still exists as a legacy compatibility path

Follow-up:

- decide whether `google-tools-submodule` should be formally removed
- decide whether `pipe-builder-table-adapter` should stay exposed in UI or move fully into advanced/manual config only
- update docs and quick-setup wording consistently once the transport policy is finalized

### 2. Excel Writer Implementation

Current status:

- Excel targets are preview-only
- activation of Excel live sync is intentionally blocked
- `ExcelFileGateway.writeSheet()` remains unimplemented

Follow-up:

- choose actual `.xlsx` writer dependency
- implement workbook read/write semantics
- define atomic write and backup behavior for local files
- add realistic smoke/integration coverage for Excel file output

### 3. Connection Management UX

Current status:

- quick setup exists
- mapping preview exists
- draft config connection test exists

Follow-up:

- add `Load Active Config` into quick setup fields
- make transport guidance context-sensitive
- surface stronger validation hints before save/activate
- separate “recommended path” from “advanced path” more clearly

### 4. Persisted Metrics Model

Current status:

- events are persisted
- summaries are aggregated
- headline counts derive from persisted event history

Follow-up:

- decide whether queue/pending state also needs persistence
- decide whether derived metrics should move into a dedicated persisted aggregate table for large histories
- add retention/cleanup policy for `tabular_sync_events`

### 5. Observability and Recovery

Current status:

- recent failures are visible
- summary and raw event filtering work
- manual resync exists

Follow-up:

- add retry policy/backoff decisions
- add pause/disable target behavior
- add export/download for events/summary if needed
- consider external alert hooks for repeated failures

## Deferred On Purpose

- Excel as source-of-truth for reads
- bidirectional sync from workbook back into SQLite
- real-time reverse import from user-edited Excel files
- fully replacing SQLite with Excel/Sheets storage

## Recommendation

Near-term priority should be:

1. finalize transport policy
2. keep Google Sheets as the primary supported live target
3. implement Excel writer separately as a focused delivery track
4. avoid presenting Excel as fully supported until write path and tests are complete
