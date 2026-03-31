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
  const configKey = requireEnv('TABULAR_SYNC_CONFIG_KEY')
  resetContainer()
  const container = await createContainer()
  const store = await container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE)
  store.activateConfig(configKey)

  console.log(
    JSON.stringify(
      {
        configKey,
        activated: true,
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
