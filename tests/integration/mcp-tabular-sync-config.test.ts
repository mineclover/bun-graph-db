import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { getExpectedRootMcpToolCount, getExpectedRootMcpToolNames } from '../fixtures/mcp-tool-registry'
import { createIntegrationConfig, McpHelper, withAutoServer } from '../fixtures/unified-test-environment'

describe('MCP Tabular Sync Config Management', () => {
  test('tools/list should include tabular sync MCP tools', async () => {
    await withAutoServer(
      createIntegrationConfig('mcp-tabular-sync-config-tools'),
      async (env) => {
        const baseUrl = env.server?.url?.replace('/graphql', '')
        expect(baseUrl).toBeDefined()
        const mcpHelper = new McpHelper(baseUrl!)

        const [listResult, expectedToolCount, expectedToolNames] = await Promise.all([
          mcpHelper.listTools(),
          getExpectedRootMcpToolCount(),
          getExpectedRootMcpToolNames(),
        ])

        expect(listResult.result).toBeDefined()
        expect(Array.isArray(listResult.result.tools)).toBe(true)
        expect(listResult.result.tools.length).toBe(expectedToolCount)

        const listedToolNames = listResult.result.tools.map((tool: { name: string }) => tool.name)

        expect(listedToolNames).toContain('list-tabular-sync-configs')
        expect(listedToolNames).toContain('get-tabular-sync-config')
        expect(listedToolNames).toContain('save-tabular-sync-config')
        expect(listedToolNames).toContain('activate-tabular-sync-config')

        expect(listedToolNames.sort()).toEqual(expectedToolNames.sort())
      },
    )
  })

  test('tabular sync config MCP tools should save, list, get, and activate configs', async () => {
    await withAutoServer(
      createIntegrationConfig('mcp-tabular-sync-config-call'),
      async (env) => {
        const baseUrl = env.server?.url?.replace('/graphql', '')
        expect(baseUrl).toBeDefined()
        const mcpHelper = new McpHelper(baseUrl!)

        const alphaConfig = {
          defaultTargetId: 'excel-primary',
          targets: [
            {
              id: 'excel-primary',
              kind: 'excel-file',
              workbookPath: join(tmpdir(), 'bun-graph-db-mcp-tabular-alpha.xlsx'),
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
          defaultTargetId: 'excel-beta',
          targets: [
            {
              id: 'excel-beta',
              kind: 'excel-file',
              workbookPath: join(tmpdir(), 'bun-graph-db-mcp-tabular-beta.xlsx'),
            },
          ],
          routes: [
            {
              tableIdentifier: 'projects',
              targetId: 'excel-beta',
              sheetName: 'projects',
            },
          ],
        }

        const saveAlpha = await mcpHelper.callTool('save-tabular-sync-config', {
          configKey: 'alpha',
          config: alphaConfig,
          active: true,
        })

        expect(saveAlpha.success).toBe(true)
        expect(saveAlpha.data.configKey).toBe('alpha')
        expect(saveAlpha.data.isActive).toBe(true)

        const saveBeta = await mcpHelper.callTool('save-tabular-sync-config', {
          configKey: 'beta',
          config: betaConfig,
          active: false,
        })

        expect(saveBeta.success).toBe(true)
        expect(saveBeta.data.configKey).toBe('beta')
        expect(saveBeta.data.isActive).toBe(false)

        const listConfigs = await mcpHelper.callTool('list-tabular-sync-configs', {})
        expect(listConfigs.success).toBe(true)
        expect(Array.isArray(listConfigs.data)).toBe(true)
        expect(listConfigs.data.map((config: { configKey: string }) => config.configKey)).toEqual(
          expect.arrayContaining(['alpha', 'beta']),
        )

        const activeBefore = await mcpHelper.callTool('get-tabular-sync-config', {})
        expect(activeBefore.success).toBe(true)
        expect(activeBefore.data.configKey).toBe('alpha')

        const betaConfigRecord = await mcpHelper.callTool('get-tabular-sync-config', {
          configKey: 'beta',
        })
        expect(betaConfigRecord.success).toBe(true)
        expect(betaConfigRecord.data.configKey).toBe('beta')

        const activateBeta = await mcpHelper.callTool('activate-tabular-sync-config', {
          configKey: 'beta',
        })
        expect(activateBeta.success).toBe(true)
        expect(activateBeta.data.configKey).toBe('beta')
        expect(activateBeta.data.isActive).toBe(true)

        const activeAfter = await mcpHelper.callTool('get-tabular-sync-config', {})
        expect(activeAfter.success).toBe(true)
        expect(activeAfter.data.configKey).toBe('beta')
      },
    )
  })

  test('tabular sync status MCP tools should expose failure metrics for a failed resync', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'mcp-tabular-sync-status-'))
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
            spreadsheetId: 'status-test-sheet',
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
        createIntegrationConfig('mcp-tabular-sync-status'),
        async (env) => {
          const baseUrl = env.server?.url?.replace('/graphql', '')
          expect(baseUrl).toBeDefined()
          const mcpHelper = new McpHelper(baseUrl!)

          const createTableResult = await mcpHelper.callTool('createTable', {
            identifier: 'users',
            description: 'Users table for sync status metrics',
          })
          expect(createTableResult.success).toBe(true)

          const initialStatus = await mcpHelper.callTool('get-tabular-sync-status', {})
          expect(initialStatus.success).toBe(true)
          expect(initialStatus.data.enabled).toBe(true)
          expect(initialStatus.data.totalExecutions).toBe(1)
          expect(initialStatus.data.totalFailed).toBe(1)
          expect(initialStatus.data.recentFailures.length).toBe(1)
          expect(initialStatus.data.persistedEvents.length).toBe(1)
          expect(initialStatus.data.persistedEvents[0]?.status).toBe('failure')

          const resyncResult = await mcpHelper.callTool('resync-tabular-sync-table', {
            tableIdentifier: 'users',
          })
          expect(resyncResult.success).toBe(false)

          const statusAfterFailure = await mcpHelper.callTool('get-tabular-sync-status', {})
          expect(statusAfterFailure.success).toBe(true)
          expect(statusAfterFailure.data.enabled).toBe(true)
          expect(statusAfterFailure.data.pendingCount).toBe(1)
          expect(statusAfterFailure.data.totalExecutions).toBe(2)
          expect(statusAfterFailure.data.totalFailed).toBe(2)
          expect(statusAfterFailure.data.recentFailures.length).toBe(2)
          expect(statusAfterFailure.data.persistedEvents.length).toBe(2)
          expect(statusAfterFailure.data.recentFailures[0]?.tableIdentifier).toBe('users')
          expect(statusAfterFailure.data.tables[0]?.tableIdentifier).toBe('users')
          expect(statusAfterFailure.data.tables[0]?.failures).toBe(2)

          const summaryStatus = await mcpHelper.callTool('get-tabular-sync-summary', {
            tableIdentifier: 'users',
            mode: 'sync',
          })
          expect(summaryStatus.success).toBe(true)
          expect(summaryStatus.data.length).toBe(1)
          expect(summaryStatus.data[0]?.tableIdentifier).toBe('users')
          expect(summaryStatus.data[0]?.mode).toBe('sync')
          expect(summaryStatus.data[0]?.eventCount).toBe(2)
          expect(summaryStatus.data[0]?.successCount).toBe(0)
          expect(summaryStatus.data[0]?.failureCount).toBe(2)
          expect(summaryStatus.data[0]?.successRate).toBe(0)
          expect(typeof summaryStatus.data[0]?.latestErrorMessage).toBe('string')

          const filteredStatus = await mcpHelper.callTool('get-tabular-sync-status', {
            tableIdentifier: 'users',
            status: 'failure',
            mode: 'sync',
            limit: 1,
            createdAfter: '2000-01-01T00:00:00.000Z',
          })
          expect(filteredStatus.success).toBe(true)
          expect(filteredStatus.data.persistedEvents.length).toBe(1)
          expect(filteredStatus.data.persistedEvents[0]?.tableIdentifier).toBe('users')
          expect(filteredStatus.data.persistedEvents[0]?.status).toBe('failure')
          expect(filteredStatus.data.persistedEvents[0]?.mode).toBe('sync')

          const futureFilteredStatus = await mcpHelper.callTool('get-tabular-sync-status', {
            createdAfter: '2999-01-01T00:00:00.000Z',
          })
          expect(futureFilteredStatus.success).toBe(true)
          expect(futureFilteredStatus.data.persistedEvents.length).toBe(0)

          const presetFilteredStatus = await mcpHelper.callTool('get-tabular-sync-status', {
            windowPreset: '1h',
            mode: 'sync',
          })
          expect(presetFilteredStatus.success).toBe(true)
          expect(presetFilteredStatus.data.persistedEvents.length).toBe(2)

          const clearFilteredStatus = await mcpHelper.callTool('get-tabular-sync-status', {
            mode: 'clear',
          })
          expect(clearFilteredStatus.success).toBe(true)
          expect(clearFilteredStatus.data.persistedEvents.length).toBe(0)

          const clearSummaryStatus = await mcpHelper.callTool('get-tabular-sync-summary', {
            mode: 'clear',
          })
          expect(clearSummaryStatus.success).toBe(true)
          expect(clearSummaryStatus.data.length).toBe(0)

          const presetSummaryStatus = await mcpHelper.callTool('get-tabular-sync-summary', {
            windowPreset: '24h',
            mode: 'sync',
          })
          expect(presetSummaryStatus.success).toBe(true)
          expect(presetSummaryStatus.data.length).toBe(1)
          expect(presetSummaryStatus.data[0]?.eventCount).toBe(2)
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
