import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  createIntegrationConfig,
  withAutoServer,
} from '../fixtures/unified-test-environment'

interface GraphqlResponse<TData> {
  data?: TData
  errors?: Array<{ message: string }>
}

async function graphqlRequest<TData>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphqlResponse<TData>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  return (await response.json()) as GraphqlResponse<TData>
}

describe('Tabular Sync Config Management', () => {
  test('GraphQL config management should save, list, get, and activate configs', async () => {
    await withAutoServer(
      createIntegrationConfig('tabular-sync-config-graphql'),
      async (env) => {
        const graphqlUrl = env.server?.url
        expect(graphqlUrl).toBeDefined()

        const alphaConfig = {
          defaultTargetId: 'excel-primary',
          targets: [
            {
              id: 'excel-primary',
              kind: 'excel-file',
              workbookPath: '/tmp/bun-graph-db-tabular-sync-alpha.xlsx',
            },
          ],
          routes: [
            {
              tableIdentifier: 'users',
              targetId: 'excel-primary',
              sheetName: 'users',
            },
          ],
        }

        const betaConfig = {
          defaultTargetId: 'google-sheets-beta',
          targets: [
            {
              id: 'google-sheets-beta',
              kind: 'google-sheets',
              transport: 'google-tools-http',
              spreadsheetId: 'spreadsheet-beta',
              googleToolsBaseUrl: 'http://127.0.0.1:9',
            },
          ],
          routes: [
            {
              tableIdentifier: 'projects',
              targetId: 'google-sheets-beta',
              sheetName: 'projects',
            },
          ],
        }

        const saveAlpha = await graphqlRequest<{
          saveTabularSyncConfig: { success: boolean; config: { configKey: string; isActive: boolean } }
        }>(
          graphqlUrl!,
          `
            mutation SaveAlpha($input: SaveTabularSyncConfigInput!) {
              saveTabularSyncConfig(input: $input) {
                success
                config {
                  configKey
                  isActive
                }
              }
            }
          `,
          {
            input: {
              configKey: 'alpha',
              config: alphaConfig,
              active: true,
            },
          },
        )

        expect(saveAlpha.errors).toBeUndefined()
        expect(saveAlpha.data?.saveTabularSyncConfig.success).toBe(true)
        expect(saveAlpha.data?.saveTabularSyncConfig.config.configKey).toBe('alpha')

        const saveBeta = await graphqlRequest<{
          saveTabularSyncConfig: { success: boolean; config: { configKey: string; isActive: boolean } }
        }>(
          graphqlUrl!,
          `
            mutation SaveBeta($input: SaveTabularSyncConfigInput!) {
              saveTabularSyncConfig(input: $input) {
                success
                config {
                  configKey
                  isActive
                }
              }
            }
          `,
          {
            input: {
              configKey: 'beta',
              config: betaConfig,
              active: false,
            },
          },
        )

        expect(saveBeta.errors).toBeUndefined()
        expect(saveBeta.data?.saveTabularSyncConfig.success).toBe(true)

        const listResult = await graphqlRequest<{
          tabularSyncConfigs: Array<{ configKey: string; isActive: boolean }>
        }>(
          graphqlUrl!,
          `
            query ListConfigs {
              tabularSyncConfigs {
                configKey
                isActive
              }
            }
          `,
        )

        expect(listResult.errors).toBeUndefined()
        expect(listResult.data?.tabularSyncConfigs.length).toBe(2)
        expect(listResult.data?.tabularSyncConfigs[0]?.configKey).toBe('alpha')

        const activeBefore = await graphqlRequest<{
          tabularSyncConfig: { configKey: string; isActive: boolean; config: Record<string, unknown> }
        }>(
          graphqlUrl!,
          `
            query GetActive {
              tabularSyncConfig {
                configKey
                isActive
                config
              }
            }
          `,
        )

        expect(activeBefore.errors).toBeUndefined()
        expect(activeBefore.data?.tabularSyncConfig.configKey).toBe('alpha')

        const activateBeta = await graphqlRequest<{
          activateTabularSyncConfig: { success: boolean; config: { configKey: string; isActive: boolean } }
        }>(
          graphqlUrl!,
          `
            mutation ActivateBeta($configKey: String!) {
              activateTabularSyncConfig(configKey: $configKey) {
                success
                config {
                  configKey
                  isActive
                }
              }
            }
          `,
          {
            configKey: 'beta',
          },
        )

        expect(activateBeta.errors).toBeUndefined()
        expect(activateBeta.data?.activateTabularSyncConfig.success).toBe(false)

        const activeAfter = await graphqlRequest<{
          tabularSyncConfig: { configKey: string; isActive: boolean; config: Record<string, unknown> }
        }>(
          graphqlUrl!,
          `
            query GetActiveAfter {
              tabularSyncConfig {
                configKey
                isActive
                config
              }
            }
          `,
        )

        expect(activeAfter.errors).toBeUndefined()
        expect(activeAfter.data?.tabularSyncConfig.configKey).toBe('alpha')
      },
    )
  })

  test('HTTP config management routes should serve admin UI and JSON APIs', async () => {
    await withAutoServer(
      createIntegrationConfig('tabular-sync-config-http'),
      async (env) => {
        const baseUrl = env.server?.url?.replace('/graphql', '')
        expect(baseUrl).toBeDefined()

        const saveResponse = await fetch(`${baseUrl}/api/tabular-sync-configs`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            configKey: 'http-alpha',
            active: true,
            config: {
              defaultTargetId: 'local-excel',
              targets: [
                {
                  id: 'local-excel',
                  kind: 'excel-file',
                  workbookPath: '/tmp/bun-graph-db-tabular-sync-http-alpha.xlsx',
                },
              ],
              routes: [
                {
                  tableIdentifier: 'users',
                  targetId: 'local-excel',
                  sheetName: 'users',
                },
              ],
            },
          }),
        })

        const savePayload = await saveResponse.json()
        expect(saveResponse.status).toBe(200)
        expect(savePayload.success).toBe(true)

        const adminPage = await fetch(`${baseUrl}/tabular-sync`)
        const adminHtml = await adminPage.text()
        expect(adminPage.status).toBe(200)
        expect(adminHtml).toContain('Tabular Sync Config Admin')
        expect(adminHtml).toContain('Persisted Summary')
        expect(adminHtml).toContain('Recent Events')
        expect(adminHtml).toContain('auto refresh (5s)')
        expect(adminHtml).toContain('Mapping Preview')
        expect(adminHtml).toContain('Connection Test')
        expect(adminHtml).toContain('Test Draft Config')
        expect(adminHtml).toContain('Quick Setup')
        expect(adminHtml).toContain('Build Google Draft')
        expect(adminHtml).toContain('Build Excel Draft')
        expect(adminHtml).toContain('Google Sheets Recommended')
        expect(adminHtml).toContain('Excel Preview Only')
        expect(adminHtml).toContain('resolved id:')

        const listResponse = await fetch(`${baseUrl}/api/tabular-sync-configs`)
        const listPayload = await listResponse.json()
        expect(listResponse.status).toBe(200)
        expect(Array.isArray(listPayload.configs)).toBe(true)
        expect(listPayload.configs[0]?.configKey).toBe('http-alpha')

        const previewResponse = await fetch(`${baseUrl}/api/tabular-sync-preview`)
        const previewPayload = await previewResponse.json()
        expect(previewResponse.status).toBe(200)
        expect(previewPayload.success).toBe(true)
        expect(previewPayload.preview.length).toBe(1)
        expect(previewPayload.preview[0]?.tableIdentifier).toBe('users')
        expect(previewPayload.preview[0]?.sheetName).toBe('users')

        const activeResponse = await fetch(`${baseUrl}/api/tabular-sync-configs/active`)
        const activePayload = await activeResponse.json()
        expect(activeResponse.status).toBe(200)
        expect(activePayload.config.configKey).toBe('http-alpha')

        const activateResponse = await fetch(
          `${baseUrl}/api/tabular-sync-configs/http-alpha/activate`,
          { method: 'POST' },
        )
        const activatePayload = await activateResponse.json()
        expect(activateResponse.status).toBe(200)
        expect(activatePayload.success).toBe(true)
        expect(activatePayload.config.configKey).toBe('http-alpha')

        const testResponse = await fetch(`${baseUrl}/api/tabular-sync-test`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            config: {
              defaultTargetId: 'local-excel',
              targets: [
                {
                  id: 'local-excel',
                  kind: 'excel-file',
                  workbookPath: '/tmp/demo.xlsx',
                },
              ],
              routes: [
                {
                  tableIdentifier: 'users',
                  targetId: 'local-excel',
                  sheetName: 'users',
                },
              ],
            },
          }),
        })
        const testPayload = await testResponse.json()
        expect(testResponse.status).toBe(200)
        expect(testPayload.success).toBe(true)
        expect(testPayload.results.length).toBe(1)
        expect(testPayload.results[0]?.tableIdentifier).toBe('users')
      },
    )
  })

  test('HTTP status routes should expose sync metrics and allow manual retry', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'tabular-sync-http-status-'))
    const configPath = join(tempDir, 'tabular-sync.json')
    const originalConfigPath = process.env.TABULAR_SYNC_CONFIG_FILE

    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'failing-google-sheets',
        targets: [
          {
            id: 'failing-google-sheets',
            kind: 'google-sheets',
            transport: 'google-tools-http',
            spreadsheetId: 'http-status-sheet',
            googleToolsBaseUrl: 'http://127.0.0.1:9',
          },
        ],
        routes: [
          {
            tableIdentifier: 'users',
            targetId: 'failing-google-sheets',
            sheetName: 'users',
          },
        ],
        syncDebounceMs: 0,
      }),
    )

    process.env.TABULAR_SYNC_CONFIG_FILE = configPath

    try {
      await withAutoServer(
        createIntegrationConfig('tabular-sync-status-http'),
        async (env) => {
          const baseUrl = env.server?.url?.replace('/graphql', '')
          expect(baseUrl).toBeDefined()

          const createTableResponse = await fetch(`${baseUrl}/api/tables`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              identifier: 'users',
              description: 'Users table for HTTP sync status test',
            }),
          })
          const createTablePayload = await createTableResponse.json()
          expect(createTableResponse.status).toBe(200)
          expect(createTablePayload.success).toBe(true)

          const statusResponse = await fetch(`${baseUrl}/api/tabular-sync-status`)
          const statusPayload = await statusResponse.json()
          expect(statusResponse.status).toBe(200)
          expect(statusPayload.success).toBe(true)
          expect(statusPayload.status.enabled).toBe(true)
          expect(statusPayload.status.totalFailed).toBe(0)
          expect(Array.isArray(statusPayload.status.persistedEvents)).toBe(true)
          expect(statusPayload.status.persistedEvents.length).toBe(0)

          const resyncResponse = await fetch(`${baseUrl}/api/tabular-sync-status/resync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tableIdentifier: 'users' }),
          })
          const resyncPayload = await resyncResponse.json()
          expect(resyncResponse.status).toBe(200)
          expect(resyncPayload.success).toBe(false)

          const statusAfterResponse = await fetch(`${baseUrl}/api/tabular-sync-status`)
          const statusAfterPayload = await statusAfterResponse.json()
          expect(statusAfterResponse.status).toBe(200)
          expect(statusAfterPayload.status.totalExecutions).toBe(1)
          expect(statusAfterPayload.status.totalFailed).toBe(1)
          expect(statusAfterPayload.status.recentFailures.length).toBe(1)
          expect(statusAfterPayload.status.persistedEvents.length).toBe(1)
          expect(statusAfterPayload.status.persistedEvents[0]?.status).toBe('failure')
          expect(statusAfterPayload.status.tables[0]?.tableIdentifier).toBe('users')
          expect(statusAfterPayload.status.tables[0]?.failures).toBe(1)

          const summaryResponse = await fetch(
            `${baseUrl}/api/tabular-sync-summary?tableIdentifier=users&mode=sync`,
          )
          const summaryPayload = await summaryResponse.json()
          expect(summaryResponse.status).toBe(200)
          expect(summaryPayload.success).toBe(true)
          expect(summaryPayload.summary.length).toBe(1)
          expect(summaryPayload.summary[0]?.tableIdentifier).toBe('users')
          expect(summaryPayload.summary[0]?.mode).toBe('sync')
          expect(summaryPayload.summary[0]?.eventCount).toBe(1)
          expect(summaryPayload.summary[0]?.successCount).toBe(0)
          expect(summaryPayload.summary[0]?.failureCount).toBe(1)
          expect(summaryPayload.summary[0]?.successRate).toBe(0)
          expect(typeof summaryPayload.summary[0]?.latestErrorMessage).toBe('string')

          const filteredStatusResponse = await fetch(
            `${baseUrl}/api/tabular-sync-status?tableIdentifier=users&status=failure&mode=sync&limit=1&createdAfter=2000-01-01T00:00:00.000Z`,
          )
          const filteredStatusPayload = await filteredStatusResponse.json()
          expect(filteredStatusResponse.status).toBe(200)
          expect(filteredStatusPayload.status.persistedEvents.length).toBe(1)
          expect(filteredStatusPayload.status.persistedEvents[0]?.tableIdentifier).toBe('users')
          expect(filteredStatusPayload.status.persistedEvents[0]?.status).toBe('failure')
          expect(filteredStatusPayload.status.persistedEvents[0]?.mode).toBe('sync')

          const futureFilteredStatusResponse = await fetch(
            `${baseUrl}/api/tabular-sync-status?createdAfter=2999-01-01T00:00:00.000Z`,
          )
          const futureFilteredStatusPayload = await futureFilteredStatusResponse.json()
          expect(futureFilteredStatusResponse.status).toBe(200)
          expect(futureFilteredStatusPayload.status.persistedEvents.length).toBe(0)

          const presetStatusResponse = await fetch(
            `${baseUrl}/api/tabular-sync-status?windowPreset=1h&mode=sync`,
          )
          const presetStatusPayload = await presetStatusResponse.json()
          expect(presetStatusResponse.status).toBe(200)
          expect(presetStatusPayload.status.persistedEvents.length).toBe(1)

          const clearFilteredStatusResponse = await fetch(
            `${baseUrl}/api/tabular-sync-status?mode=clear`,
          )
          const clearFilteredStatusPayload = await clearFilteredStatusResponse.json()
          expect(clearFilteredStatusResponse.status).toBe(200)
          expect(clearFilteredStatusPayload.status.persistedEvents.length).toBe(0)

          const clearSummaryResponse = await fetch(`${baseUrl}/api/tabular-sync-summary?mode=clear`)
          const clearSummaryPayload = await clearSummaryResponse.json()
          expect(clearSummaryResponse.status).toBe(200)
          expect(clearSummaryPayload.summary.length).toBe(0)

          const presetSummaryResponse = await fetch(
            `${baseUrl}/api/tabular-sync-summary?windowPreset=24h&mode=sync`,
          )
          const presetSummaryPayload = await presetSummaryResponse.json()
          expect(presetSummaryResponse.status).toBe(200)
          expect(presetSummaryPayload.summary.length).toBe(1)
          expect(presetSummaryPayload.summary[0]?.eventCount).toBe(1)
        },
      )
    } finally {
      if (originalConfigPath === undefined) {
        delete process.env.TABULAR_SYNC_CONFIG_FILE
      } else {
        process.env.TABULAR_SYNC_CONFIG_FILE = originalConfigPath
      }
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
