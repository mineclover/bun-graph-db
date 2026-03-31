import {
  loadOAuthTokenFile,
  loadPipeBuilderGoogleApis,
  loadServiceAccountKeyFile,
} from './PipeBuilderGoogleApisLoader.js'

export interface CreateGoogleSpreadsheetInput {
  workspacePath: string
  authMode?: 'service-account' | 'oauth'
  serviceAccountKeyFile?: string
  oauthTokenFile?: string
  title: string
}

export interface CreatedGoogleSpreadsheet {
  spreadsheetId: string
  name?: string
  webViewLink?: string
}

export async function createGoogleSpreadsheet(
  input: CreateGoogleSpreadsheetInput,
): Promise<CreatedGoogleSpreadsheet> {
  const { google, JWT, OAuth2Client } = await loadPipeBuilderGoogleApis(input.workspacePath)
  const authMode = input.authMode || 'service-account'
  let auth: unknown

  if (authMode === 'oauth') {
    if (!input.oauthTokenFile) {
      throw new Error('oauthTokenFile is required for OAuth spreadsheet creation.')
    }

    const token = await loadOAuthTokenFile(input.oauthTokenFile)
    const oauthClient = new OAuth2Client(
      token.clientId,
      token.clientSecret,
      token.redirectUri,
    )
    oauthClient.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
    })
    auth = oauthClient
  } else {
    if (!input.serviceAccountKeyFile) {
      throw new Error('serviceAccountKeyFile is required for service-account spreadsheet creation.')
    }

    const key = await loadServiceAccountKeyFile(input.serviceAccountKeyFile)
    auth = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    })
  }

  const drive = google.drive({
    version: 'v3',
    auth,
  })

  const response = await drive.files.create({
    requestBody: {
      name: input.title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    fields: 'id,name,mimeType,webViewLink',
  })

  if (!response.data.id) {
    throw new Error('Failed to create Google Spreadsheet: missing spreadsheet id.')
  }

  return {
    spreadsheetId: response.data.id,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
  }
}
