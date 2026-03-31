import type { TabularSyncConfig } from '../TabularSyncConfig.js'
import { resolveGoogleSpreadsheetId } from '../GoogleSpreadsheetIdResolver.js'

export interface GoogleSheetsPipeBuilderConfigInput {
  spreadsheetId?: string
  spreadsheetUrl?: string
  serviceAccountKeyFile?: string
  oauthTokenFile?: string
  authMode?: 'service-account' | 'oauth'
  transport?: 'pipe-builder-table-adapter' | 'google-tools-http' | 'google-tools-submodule'
  googleToolsBaseUrl?: string
  tableIdentifier?: string
  sheetName?: string
  pipeBuilderWorkspacePath?: string
}

export function createGoogleSheetsPipeBuilderConfig(
  input: GoogleSheetsPipeBuilderConfigInput,
): TabularSyncConfig {
  const tableIdentifier = input.tableIdentifier || 'users'
  const spreadsheetId = resolveGoogleSpreadsheetId(input)
  const authMode = input.authMode || 'service-account'
  const transport = input.transport || 'pipe-builder-table-adapter'

  if (!spreadsheetId) {
    throw new Error('spreadsheetId or spreadsheetUrl is required')
  }

  return {
    defaultTargetId: 'google-sheets-primary',
    targets: [
      {
        id: 'google-sheets-primary',
        kind: 'google-sheets',
        displayName: 'Primary Google Sheet',
        transport,
        authMode,
        spreadsheetId,
        spreadsheetUrl: input.spreadsheetUrl,
        serviceAccountKeyFile: input.serviceAccountKeyFile,
        oauthTokenFile: input.oauthTokenFile,
        googleToolsBaseUrl: input.googleToolsBaseUrl,
        pipeBuilderWorkspacePath:
          input.pipeBuilderWorkspacePath ||
          '/Users/junwoobang/workflow/pipe-builder',
      },
    ],
    routes: [
      {
        tableIdentifier,
        targetId: 'google-sheets-primary',
        sheetName: input.sheetName || tableIdentifier,
        diffMode: 'summary',
      },
    ],
  }
}
