import { TablePackageService } from '@/domain/services/TablePackageService.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, RepositoryTokens, TablePackageTokens } from '../tokens/index.js'

/**
 * Table Package module - registers table export/import services
 */
export function registerTablePackageModule(container: DIContainer): void {
  // Table Package Service
  container.registerSingleton(
    TablePackageTokens.TABLE_PACKAGE_SERVICE,
    async (c) => {
      const tableRepo = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as any
      const attributeRepo = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as any
      const attributeTypeRepo = (await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)) as any
      const nodeRepo = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as any
      const nodeAttributeRepo = (await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)) as any
      const nodeRelationRepo = (await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)) as any
      const relationTypeRepo = (await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)) as any
      const queryTemplateRepo = (await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY)) as any
      const logger = (await c.resolve(CommonTokens.LOGGER)) as any

      return new TablePackageService(
        tableRepo,
        attributeRepo,
        attributeTypeRepo,
        nodeRepo,
        nodeAttributeRepo,
        nodeRelationRepo,
        relationTypeRepo,
        queryTemplateRepo,
        logger,
        c,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      CommonTokens.LOGGER,
    ],
  )
}
