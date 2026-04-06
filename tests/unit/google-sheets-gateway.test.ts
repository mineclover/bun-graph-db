import { describe, expect, test } from 'bun:test'
import { GoogleSheetsGateway } from '@/infrastructure/excel/gateways/GoogleSheetsGateway.js'

describe('GoogleSheetsGateway', () => {
  test('readRows should throw when spreadsheetId is missing', async () => {
    const gateway = new GoogleSheetsGateway({
      readSheet: async () => ({ values: [] }),
      replaceSheet: async () => undefined,
    })

    await expect(
      gateway.readRows({
        target: {
          id: 'google-main',
          kind: 'google-sheets',
          spreadsheetId: undefined as unknown as string,
          spreadsheetUrl: undefined as unknown as string,
          authMode: 'service-account',
          accessMode: 'google-drive-api',
          transport: 'google-tools-http',
          cliCommand: 'gwk',
          adapterKind: undefined as unknown as 'google-tools-submodule',
          googleToolsSubmodulePath: undefined as unknown as string,
          googleToolsBaseUrl: 'http://localhost:5678',
          pipeBuilderWorkspacePath: undefined as unknown as string,
          tableAdapterPackagePath: undefined as unknown as string,
          serviceAccountKeyFile: undefined as unknown as string,
          oauthTokenFile: undefined as unknown as string,
          displayName: 'google-main',
          enabled: true,
        },
        route: {
          tableIdentifier: 'users',
          targetId: 'google-main',
          enabled: true,
          sheetName: 'users',
          primaryKeyColumn: '__node_id',
          diffMode: 'summary',
        },
        sheetName: 'users',
      }),
    ).rejects.toThrow("missing spreadsheetId")
  })
})
