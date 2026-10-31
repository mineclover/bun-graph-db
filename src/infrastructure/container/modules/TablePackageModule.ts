import type { ILogger } from '@/application/ports/ILogger.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, RepositoryTokens, TablePackageTokens } from '../tokens/index.js'

/**
 * Table Package module - registers table export/import services lazily on demand
 */
export function registerTablePackageModule(container: DIContainer): void {
  // Table Package Service
  container.registerSingleton(
    TablePackageTokens.TABLE_PACKAGE_SERVICE,
    async (c) => {
      const { TablePackageService } = await import('@/domain/services/TablePackageService.js')
      const tableRepo = (await c.resolve(RepositoryTokens.TABLE_REPOSITORY)) as ITableRepository
      const attributeRepo = (await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)) as IAttributeRepository
      const attributeTypeRepo = (await c.resolve(
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )) as IAttributeTypeRepository
      const nodeRepo = (await c.resolve(RepositoryTokens.NODE_REPOSITORY)) as INodeRepository
      const nodeAttributeRepo = (await c.resolve(
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )) as INodeAttributeRepository
      const nodeRelationRepo = (await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)) as INodeRelationRepository
      const relationTypeRepo = (await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)) as IRelationTypeRepository
      const queryTemplateRepo = (await c.resolve(
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )) as IQueryTemplateRepository
      const logger = (await c.resolve(CommonTokens.LOGGER)) as ILogger

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
