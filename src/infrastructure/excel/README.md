# Tabular Sync Module

This module provides the skeleton for syncing table-shaped data from SQLite-backed domain objects into configurable tabular destinations.

## Current scope

- destination config
- table-to-target routing
- sheet naming
- schema projection
- row projection
- diff calculation
- sync planning/orchestration skeleton

## Planned destinations

- local Excel file
- Google Sheets

## Current status

Gateway implementations are still placeholders. The next implementation phase should add a real writer layer behind:

- `ExcelFileGateway`
- `GoogleSheetsGateway`

## google-tools integration note

The workspace may include `vendor/google-tools` as a submodule.

Current relevant references:

- `vendor/google-tools/src/services/sheets.service.ts`
- `vendor/google-tools/src/api/sheets.api.ts`
- `vendor/google-tools/src/client.ts`

The intended integration paths are:

1. `pipe-builder-table-adapter` mode
   - use `pipe-builder/packages/table-adapter-gsheets`
   - load the built adapter directly
   - pass that adapter into `GoogleSheetsGateway`

2. HTTP mode
   - run `google-tools` as a separate server
   - use `GoogleToolsHttpSheetsAdapter`
   - pass that adapter into `GoogleSheetsGateway`

3. submodule-client mode
   - create or inject a `GoogleToolsClient`
   - wrap `client.sheets` with `GoogleToolsSheetsAdapter`
   - pass that adapter into `GoogleSheetsGateway`

For submodule-based loading, use `createGoogleToolsSheetsAdapter()` from:

- `src/infrastructure/excel/adapters/GoogleToolsClientLoader.ts`

Current assumptions for submodule mode:

- `vendor/google-tools` exists as a submodule
- `vendor/google-tools/node_modules` is installed
- authentication is provided either by:
  - `serviceAccountKeyFile`, or
  - the native `google-tools` env configuration

Recommended default:

- use `pipe-builder-table-adapter` first when `~/workflow/pipe-builder` is available
- use `google-tools` over HTTP as the next fallback
- keep submodule-client mode as a low-priority compatibility path

## Factory entrypoints

Preferred creation path:

- `createGoogleSheetsGateway()`
- `createTabularDestinationGateways()`

These factories resolve Google Sheets adapters lazily per target:

- `pipe-builder-table-adapter`
- `google-tools-http`
- `google-tools-submodule`

## Sample config and smoke

Useful entrypoints:

- `createGoogleSheetsPipeBuilderConfig()`
- `scripts/save-tabular-sync-config.ts`
- `scripts/list-tabular-sync-configs.ts`
- `scripts/get-tabular-sync-config.ts`
- `scripts/activate-tabular-sync-config.ts`
- `scripts/smoke-google-sheets-tabular-sync.ts`
- `scripts/list-google-sheets-service-account.ts`
- `scripts/google-oauth-generate-url.ts`
- `scripts/google-oauth-exchange-code.ts`
- `scripts/test-bun-graph-db-google-sheets-interaction.ts`
- `scripts/test-graphql-tabular-sync-hook.ts`
- `resolveGoogleSpreadsheetId()`
- `createGoogleSpreadsheet()`

Smoke script env vars:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SPREADSHEET_URL`
- `GOOGLE_CREDENTIALS_FILE` or `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`
- `GOOGLE_OAUTH_TOKEN_FILE`
- `TABULAR_TARGET_TRANSPORT`
- `GOOGLE_TOOLS_BASE_URL`

Optional:

- `GOOGLE_SHEETS_SHEET_NAME`
- `TABULAR_TABLE_IDENTIFIER`
- `PIPE_BUILDER_WORKSPACE_PATH`

`TABULAR_TARGET_TRANSPORT` defaults to `pipe-builder-table-adapter`.

For direct consumption of an already-authenticated `google-tools` server:

```bash
TABULAR_TARGET_TRANSPORT=google-tools-http \
GOOGLE_TOOLS_BASE_URL=http://localhost:5678 \
GOOGLE_SHEETS_SPREADSHEET_ID=... \
bun run scripts/smoke-google-sheets-tabular-sync.ts
```

If `GOOGLE_SHEETS_SPREADSHEET_ID` is omitted, the smoke script will try to create a new spreadsheet automatically using the provided service account key.

If spreadsheet creation fails with Drive quota errors, use an existing spreadsheet instead:

1. create a spreadsheet in a regular Google account
2. share it with the service account email from the credentials file
3. run the smoke script with `GOOGLE_SHEETS_SPREADSHEET_ID`

To check which spreadsheets are already accessible to the service account:

```bash
GOOGLE_CREDENTIALS_FILE=/abs/path/service-account.json \
bun run scripts/list-google-sheets-service-account.ts
```

Note:

- `google-tools` README uses `GOOGLE_CREDENTIALS_FILE`
- our internal config field name is still `serviceAccountKeyFile`

OAuth flow helpers:

1. generate login URL
```bash
GOOGLE_OAUTH_CLIENT_FILE=/abs/path/client_secret.json \
GOOGLE_REDIRECT_URI=http://localhost:5678/rest/oauth2-credential/callback \
bun run scripts/google-oauth-generate-url.ts
```

2. exchange code into token bundle
```bash
GOOGLE_OAUTH_CLIENT_FILE=/abs/path/client_secret.json \
GOOGLE_REDIRECT_URI=http://localhost:5678/rest/oauth2-credential/callback \
GOOGLE_OAUTH_CODE=... \
GOOGLE_OAUTH_TOKEN_FILE=/abs/path/google-oauth-token.json \
bun run scripts/google-oauth-exchange-code.ts
```

3. run smoke with OAuth
```bash
GOOGLE_OAUTH_TOKEN_FILE=/abs/path/google-oauth-token.json \
GOOGLE_SHEETS_SPREADSHEET_ID=... \
bun run scripts/smoke-google-sheets-tabular-sync.ts
```

End-to-end interaction checks:

```bash
GOOGLE_OAUTH_TOKEN_FILE=/abs/path/google-oauth-token.json \
bun run scripts/test-bun-graph-db-google-sheets-interaction.ts
```

```bash
GOOGLE_OAUTH_TOKEN_FILE=/abs/path/google-oauth-token.json \
bun run scripts/test-graphql-tabular-sync-hook.ts
```

DB-backed config helpers:

```bash
TABULAR_SYNC_CONFIG_INPUT_FILE=/abs/path/tabular-sync.json \
TABULAR_SYNC_CONFIG_KEY=primary \
TABULAR_SYNC_CONFIG_ACTIVE=true \
bun run scripts/save-tabular-sync-config.ts
```

```bash
bun run scripts/list-tabular-sync-configs.ts
```

```bash
TABULAR_SYNC_CONFIG_KEY=primary \
bun run scripts/get-tabular-sync-config.ts
```

```bash
TABULAR_SYNC_CONFIG_KEY=primary \
bun run scripts/activate-tabular-sync-config.ts
```

HTTP admin endpoints:

- `GET /tabular-sync`
- `GET /api/tabular-sync-configs`
- `GET /api/tabular-sync-configs/active`
- `GET /api/tabular-sync-configs/:configKey`
- `POST /api/tabular-sync-configs`
- `POST /api/tabular-sync-configs/:configKey/activate`
- `GET /api/tabular-sync-status`
- `GET /api/tabular-sync-summary`
- `POST /api/tabular-sync-status/resync`

`/api/tabular-sync-status` and `/api/tabular-sync-summary` support `limit`, `tableIdentifier`, `status`, `mode`, `windowPreset`, `createdAfter`, and `createdBefore` query parameters for persisted event filtering. `windowPreset` supports `1h`, `24h`, and `7d`.

MCP admin tools:

- `list-tabular-sync-configs`
- `get-tabular-sync-config`
- `save-tabular-sync-config`
- `activate-tabular-sync-config`
- `get-tabular-sync-status`
- `get-tabular-sync-summary`
- `resync-tabular-sync-table`

`get-tabular-sync-status` returns queue state, per-table counters, recent failures, and persisted sync events stored in SQLite. `get-tabular-sync-summary` returns aggregated counts grouped by table and mode, including success/failure counts, success rate, and latest error message. Both accept `limit`, `tableIdentifier`, `status`, `mode`, `windowPreset`, `createdAfter`, and `createdBefore` filters. `windowPreset` supports `1h`, `24h`, and `7d`. `resync-tabular-sync-table` forces an immediate sync attempt for one table identifier and returns updated status.
