import { createContainer, resetContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { CommonTokens } from '@/infrastructure/container/tokens/index.js'

async function main() {
  resetContainer()
  const container = await createContainer()
  const store = await container.resolve(CommonTokens.TABULAR_SYNC_CONFIG_STORE)
  const configs = store.listConfigs()

  console.log(JSON.stringify({ configs }, null, 2))
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
