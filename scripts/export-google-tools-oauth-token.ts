import { Database } from 'bun:sqlite'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function main() {
  const dbPath =
    process.env.GOOGLE_TOOLS_DB_PATH ||
    '/Users/junwoobang/workflow/pipe-builder/packages/google-tools/data/google-tools.db'
  const clientFile = requireEnv('GOOGLE_OAUTH_CLIENT_FILE')
  const outputFile =
    process.env.GOOGLE_OAUTH_TOKEN_FILE ||
    '/Users/junwoobang/workflow/bun-graph-db/google-oauth-token.json'
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:5678/rest/oauth2-credential/callback'

  const db = new Database(dbPath, { readonly: true })
  const token = db
    .query(
      'SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1',
    )
    .get() as { access_token?: string; refresh_token?: string } | null
  db.close()

  if (!token?.access_token) {
    throw new Error(`No OAuth token found in '${dbPath}'.`)
  }

  const payload = JSON.parse(await Bun.file(clientFile).text()) as {
    web?: {
      client_id?: string
      client_secret?: string
    }
  }

  const clientId = payload.web?.client_id
  const clientSecret = payload.web?.client_secret
  if (!clientId || !clientSecret) {
    throw new Error(
      `Invalid OAuth client file '${clientFile}'. Expected web.client_id and web.client_secret.`,
    )
  }

  const tokenBundle = {
    clientId,
    clientSecret,
    redirectUri,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || undefined,
  }

  await Bun.write(outputFile, JSON.stringify(tokenBundle, null, 2))
  console.log(
    JSON.stringify(
      {
        outputFile,
        hasRefreshToken: Boolean(token.refresh_token),
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
