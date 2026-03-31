import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { GoogleSheetsTargetConfig } from '../TabularSyncConfig.js'
import {
  GoogleToolsSheetsAdapter,
  type GoogleToolsSheetsClientLike,
} from './GoogleToolsSheetsAdapter.js'

interface GoogleToolsClientConstructor {
  new (options?: {
    serviceAccountKeyFile?: string
  }): {
    sheets: GoogleToolsSheetsClientLike
  }
}

function assertGoogleToolsReady(submodulePath: string): void {
  const packageJsonPath = join(submodulePath, 'package.json')
  const nodeModulesPath = join(submodulePath, 'node_modules')

  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `google-tools submodule not found at '${submodulePath}'. Add or update the submodule first.`,
    )
  }

  if (!existsSync(nodeModulesPath)) {
    throw new Error(
      `google-tools dependencies are not installed at '${submodulePath}'. Run 'npm install' inside the submodule first.`,
    )
  }
}

export async function createGoogleToolsSheetsAdapter(
  target: GoogleSheetsTargetConfig,
): Promise<GoogleToolsSheetsAdapter> {
  const submodulePath = resolve(
    process.cwd(),
    target.googleToolsSubmodulePath || 'vendor/google-tools',
  )

  assertGoogleToolsReady(submodulePath)

  const clientModuleUrl = pathToFileURL(join(submodulePath, 'src', 'client.ts')).href
  const clientModule = (await import(clientModuleUrl)) as {
    GoogleToolsClient?: GoogleToolsClientConstructor
  }

  if (!clientModule.GoogleToolsClient) {
    throw new Error(
      `Failed to load GoogleToolsClient from '${clientModuleUrl}'.`,
    )
  }

  const client = new clientModule.GoogleToolsClient({
    serviceAccountKeyFile: target.serviceAccountKeyFile,
  })

  return new GoogleToolsSheetsAdapter(client.sheets)
}
