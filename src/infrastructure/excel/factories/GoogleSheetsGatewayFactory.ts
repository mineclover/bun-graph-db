import type { GoogleSheetsAdapterLike } from '../adapters/GoogleSheetsAdapter.js'
import { createGoogleToolsSheetsAdapter } from '../adapters/GoogleToolsClientLoader.js'
import { GoogleToolsHttpSheetsAdapter } from '../adapters/GoogleToolsHttpSheetsAdapter.js'
import { createPipeBuilderGoogleSheetsAdapter } from '../adapters/PipeBuilderGoogleSheetsLoader.js'
import type { GoogleSheetsTargetConfig } from '../TabularSyncConfig.js'
import type { ResolvedSyncTargetSelection } from '../TabularSyncTargetRegistry.js'
import {
  GoogleSheetsGateway,
  type GoogleSheetsAdapterResolver,
} from '../gateways/GoogleSheetsGateway.js'

function isGoogleSheetsTargetConfig(
  selection: ResolvedSyncTargetSelection,
): selection is ResolvedSyncTargetSelection & {
  target: Required<GoogleSheetsTargetConfig>
} {
  return selection.target.kind === 'google-sheets'
}

export function createGoogleSheetsAdapterResolver(): GoogleSheetsAdapterResolver {
  const cache = new Map<string, Promise<GoogleSheetsAdapterLike>>()

  return async (selection) => {
    if (!isGoogleSheetsTargetConfig(selection)) {
      return null
    }

    const target = selection.target
    const cached = cache.get(target.id)
    if (cached) {
      return await cached
    }

    const adapterPromise = (async () => {
      switch (target.transport) {
        case 'pipe-builder-table-adapter':
          return await createPipeBuilderGoogleSheetsAdapter(target)
        case 'google-tools-submodule':
          return await createGoogleToolsSheetsAdapter(target)
        default:
          return new GoogleToolsHttpSheetsAdapter({
            baseUrl: target.googleToolsBaseUrl,
          })
      }
    })()

    cache.set(target.id, adapterPromise)
    return await adapterPromise
  }
}

export function createGoogleSheetsGateway(): GoogleSheetsGateway {
  return new GoogleSheetsGateway(createGoogleSheetsAdapterResolver())
}
