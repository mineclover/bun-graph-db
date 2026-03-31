import { loadPipeBuilderGoogleApis, loadServiceAccountKeyFile } from '@/infrastructure/excel/index.js'

function requireEnvOneOf(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  throw new Error(`Missing required environment variable. Provide one of: ${names.join(', ')}`)
}

async function main() {
  const workspacePath =
    process.env.PIPE_BUILDER_WORKSPACE_PATH ||
    '/Users/junwoobang/workflow/pipe-builder'
  const serviceAccountKeyFile = requireEnvOneOf([
    'GOOGLE_CREDENTIALS_FILE',
    'GOOGLE_SERVICE_ACCOUNT_KEY_FILE',
  ])

  const { google, JWT } = await loadPipeBuilderGoogleApis(workspacePath)
  const key = await loadServiceAccountKeyFile(serviceAccountKeyFile)

  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  })

  const drive = google.drive({
    version: 'v3',
    auth,
  })

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: 50,
    fields: 'files(id,name,webViewLink,owners(displayName,emailAddress))',
    orderBy: 'modifiedTime desc',
  })

  console.log(
    JSON.stringify(
      {
        serviceAccount: key.client_email,
        spreadsheets: response.data.files || [],
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
})
