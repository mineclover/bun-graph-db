import { createContainer, resetContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens } from '@/infrastructure/container/tokens/index.js'

async function main() {
  const configKey = process.env.TABULAR_SYNC_CONFIG_KEY
  resetContainer()
  const container = await createContainer()
  const store = await container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE)

  const config = configKey
    ? store.getConfigByKey(configKey)
    : store.getActiveConfig()

  console.log(
    JSON.stringify(
      {
        configKey: configKey || 'active',
        config,
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
