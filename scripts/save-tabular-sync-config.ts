import { createContainer, resetContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens } from '@/infrastructure/container/tokens/index.js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function main() {
  const configFile = requireEnv('TABULAR_SYNC_CONFIG_INPUT_FILE')
  const configKey = process.env.TABULAR_SYNC_CONFIG_KEY || 'default'
  const active = process.env.TABULAR_SYNC_CONFIG_ACTIVE !== 'false'

  const config = JSON.parse(await Bun.file(configFile).text())

  resetContainer()
  const container = await createContainer()
  const store = await container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE)
  await store.saveConfig(configKey, config, { active })

  console.log(
    JSON.stringify(
      {
        configKey,
        active,
        sourceFile: configFile,
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
