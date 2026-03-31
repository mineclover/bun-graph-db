import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { GoogleSheetsTargetConfig } from '../TabularSyncConfig.js'
import {
  loadOAuthTokenFile,
  loadServiceAccountKeyFile,
} from './PipeBuilderGoogleApisLoader.js'
import { PipeBuilderGoogleSheetsAdapter } from './PipeBuilderGoogleSheetsAdapter.js'

interface PipeBuilderGoogleSheetsConstructor {
  new (
    auth:
      | {
          clientEmail: string
          privateKey: string
        }
      | {
          clientId: string
          clientSecret: string
          redirectUri: string
          accessToken?: string
          refreshToken?: string
        },
  ): {
    read: (
      spreadsheetId: string,
      options?: { sheetName?: string },
    ) => Promise<{
      rows: Array<{
        cells: Array<{ value: unknown }>
      }>
    }>
    save: (
      table: {
        rows: Array<{
          cells: Array<{ value: unknown; isHeader?: boolean }>
        }>
      },
      options?: { sourceId?: string; sheetName?: string },
    ) => Promise<void>
  }
}

function assertPipeBuilderReady(
  adapterDistPath: string,
): void {
  if (!existsSync(adapterDistPath)) {
    throw new Error(
      `table-adapter-gsheets dist not found at '${adapterDistPath}'. Build the pipe-builder package first.`,
    )
  }
}

async function resolvePipeBuilderAuth(
  target: GoogleSheetsTargetConfig,
): Promise<
  | {
      clientEmail: string
      privateKey: string
    }
  | {
      clientId: string
      clientSecret: string
      redirectUri: string
      accessToken?: string
      refreshToken?: string
    }
> {
  if (target.authMode === 'oauth') {
    if (!target.oauthTokenFile || !existsSync(target.oauthTokenFile)) {
      throw new Error(
        `oauthTokenFile is required for OAuth mode and must exist. Received '${target.oauthTokenFile || ''}'.`,
      )
    }

    const token = await loadOAuthTokenFile(target.oauthTokenFile)
    return {
      clientId: token.clientId,
      clientSecret: token.clientSecret,
      redirectUri: token.redirectUri,
      // Omit cached access token and let google-auth-library refresh from refresh_token.
      accessToken: undefined,
      refreshToken: token.refreshToken,
    }
  }

  if (!target.serviceAccountKeyFile || !existsSync(target.serviceAccountKeyFile)) {
    throw new Error(
      `serviceAccountKeyFile is required for service-account mode and must exist. Received '${target.serviceAccountKeyFile || ''}'.`,
    )
  }

  const key = await loadServiceAccountKeyFile(target.serviceAccountKeyFile)
  return {
    clientEmail: key.client_email,
    privateKey: key.private_key,
  }
}

export async function createPipeBuilderGoogleSheetsAdapter(
  target: GoogleSheetsTargetConfig,
): Promise<PipeBuilderGoogleSheetsAdapter> {
  const workspacePath = resolve(
    process.cwd(),
    target.pipeBuilderWorkspacePath || '/Users/junwoobang/workflow/pipe-builder',
  )
  const packagePath = resolve(
    workspacePath,
    target.tableAdapterPackagePath || 'packages/table-adapter-gsheets',
  )
  const adapterDistPath = join(packagePath, 'dist', 'index.js')

  assertPipeBuilderReady(adapterDistPath)

  const moduleUrl = pathToFileURL(adapterDistPath).href
  const module = (await import(moduleUrl)) as {
    GoogleSheetsAdapter?: PipeBuilderGoogleSheetsConstructor
  }

  if (!module.GoogleSheetsAdapter) {
    throw new Error(
      `Failed to load GoogleSheetsAdapter from '${moduleUrl}'.`,
    )
  }

  const auth = await resolvePipeBuilderAuth(target)
  const adapter = new module.GoogleSheetsAdapter(auth)

  return new PipeBuilderGoogleSheetsAdapter(adapter)
}
