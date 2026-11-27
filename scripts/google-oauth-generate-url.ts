import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function main() {
  const workspacePath =
    process.env.PIPE_BUILDER_WORKSPACE_PATH ||
    '/Users/junwoobang/workflow/pipe-builder'
  const clientFile = requireEnv('GOOGLE_OAUTH_CLIENT_FILE')
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:5678/rest/oauth2-credential/callback'

  const moduleUrl = pathToFileURL(
    resolve(workspacePath, 'packages/table-adapter-gsheets/dist/index.js'),
  ).href
  const module = (await import(moduleUrl)) as {
    GoogleAuthHelper?: new (config: {
      clientId: string
      clientSecret: string
      redirectUri: string
    }) => {
      generateAuthUrl(): string
    }
  }

  if (!module.GoogleAuthHelper) {
    throw new Error('GoogleAuthHelper not found in table-adapter-gsheets.')
  }

  const payload = JSON.parse(await readFile(clientFile, 'utf8')) as {
    web?: {
      client_id?: string
      client_secret?: string
    }
  }

  const clientId = payload.web?.client_id
  const clientSecret = payload.web?.client_secret
  if (!clientId || !clientSecret) {
    throw new Error('Invalid OAuth client file. Expected web.client_id and web.client_secret.')
  }

  const helper = new module.GoogleAuthHelper({
    clientId,
    clientSecret,
    redirectUri,
  })

  console.log(
    JSON.stringify(
      {
        redirectUri,
        authUrl: helper.generateAuthUrl(),
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
