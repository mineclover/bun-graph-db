import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface ServiceAccountKeyFile {
  type?: string
  client_email?: string
  private_key?: string
  project_id?: string
}

export interface OAuthTokenBundle {
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  accessToken?: string
  refreshToken?: string
}

interface JwtConstructor {
  new (options: {
    email: string
    key: string
    scopes: string[]
  }): unknown
}

interface OAuth2ClientConstructor {
  new (
    clientId?: string,
    clientSecret?: string,
    redirectUri?: string,
  ): {
    setCredentials: (credentials: {
      access_token?: string
      refresh_token?: string
    }) => void
  }
}

interface GoogleNamespace {
  drive: (options: {
    version: 'v3'
    auth: unknown
  }) => {
    files: {
      create: (input: {
        requestBody: {
          name: string
          mimeType: string
        }
        fields: string
      }) => Promise<{
        data: {
          id?: string
          name?: string
          mimeType?: string
          webViewLink?: string
        }
      }>
    }
  }
}

function getGoogleModulePaths(workspacePath: string) {
  const packageNodeModules = resolve(
    workspacePath,
    'packages/table-adapter-gsheets/node_modules',
  )

  return {
    googleApis: join(packageNodeModules, 'googleapis', 'build', 'src', 'index.js'),
    googleAuth: join(
      packageNodeModules,
      'google-auth-library',
      'build',
      'src',
      'index.js',
    ),
  }
}

export async function loadPipeBuilderGoogleApis(workspacePath: string) {
  const paths = getGoogleModulePaths(workspacePath)

  if (!existsSync(paths.googleApis) || !existsSync(paths.googleAuth)) {
    throw new Error(
      `googleapis/google-auth-library not found under '${workspacePath}'. Ensure pipe-builder dependencies are installed.`,
    )
  }

  const googleApisModule = (await import(
    pathToFileURL(paths.googleApis).href
  )) as {
    google?: GoogleNamespace
  }
  const googleAuthModule = (await import(
    pathToFileURL(paths.googleAuth).href
  )) as {
    JWT?: JwtConstructor
    OAuth2Client?: OAuth2ClientConstructor
  }

  if (!googleApisModule.google || !googleAuthModule.JWT || !googleAuthModule.OAuth2Client) {
    throw new Error('Failed to load googleapis or google-auth-library from pipe-builder.')
  }

  return {
    google: googleApisModule.google,
    JWT: googleAuthModule.JWT,
    OAuth2Client: googleAuthModule.OAuth2Client,
  }
}

export async function loadServiceAccountKeyFile(
  filePath: string,
): Promise<Required<Pick<ServiceAccountKeyFile, 'client_email' | 'private_key'>>> {
  const raw = await Bun.file(filePath).text()
  const key = JSON.parse(raw) as ServiceAccountKeyFile

  if (!key.client_email || !key.private_key) {
    throw new Error(
      `Invalid service account key file '${filePath}'. Expected client_email and private_key.`,
    )
  }

  return {
    client_email: key.client_email,
    private_key: key.private_key,
  }
}

export async function loadOAuthTokenFile(
  filePath: string,
): Promise<
  Required<Pick<OAuthTokenBundle, 'clientId' | 'clientSecret' | 'redirectUri'>> &
    Pick<OAuthTokenBundle, 'accessToken' | 'refreshToken'>
> {
  const raw = await Bun.file(filePath).text()
  const token = JSON.parse(raw) as OAuthTokenBundle

  if (!token.clientId || !token.clientSecret || !token.redirectUri) {
    throw new Error(
      `Invalid OAuth token file '${filePath}'. Expected clientId, clientSecret, and redirectUri.`,
    )
  }

  return {
    clientId: token.clientId,
    clientSecret: token.clientSecret,
    redirectUri: token.redirectUri,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
  }
}
