import type { DIContainer } from '../DIContainer.js'
import { UseCaseTokens, RepositoryTokens, CommonTokens } from '../tokens/index.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import { ExecuteQueryTemplate } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'

/**
 * Use case module - registers all application use cases
 */
export function registerUseCaseModule(container: DIContainer): void {
  // Table use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_TABLE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateTableUseCase(repository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.DELETE_TABLE_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const relationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new DeleteTableUseCase(tableRepository, nodeRepository, attributeRepository, relationRepository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.NODE_RELATION_REPOSITORY, CommonTokens.LOGGER]
  )

  // Attribute use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateAttributeTypeUseCase(repository, logger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    async (c) => {
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const attributeTypeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateAttributeUseCase(attributeRepository, attributeTypeRepository, tableRepository, logger)
    },
    [RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY, CommonTokens.LOGGER]
  )

  // Node use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_NODE_USE_CASE,
    async (c) => {
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const nodeAttributeRepository = await c.resolve(RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY)
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateNodeUseCase(nodeRepository, nodeAttributeRepository, tableRepository, attributeRepository, logger)
    },
    [RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_NODES_USE_CASE,
    async (c) => {
      const nodeSearchRepository = await c.resolve(RepositoryTokens.NODE_SEARCH_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SearchNodesUseCase(nodeSearchRepository, logger)
    },
    [RepositoryTokens.NODE_SEARCH_REPOSITORY, CommonTokens.LOGGER]
  )

  // Relation use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_USE_CASE,
    async (c) => {
      const nodeRelationRepository = await c.resolve(RepositoryTokens.NODE_RELATION_REPOSITORY)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const relationTypeRepository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateRelationUseCase(nodeRelationRepository, nodeRepository, relationTypeRepository, logger)
    },
    [RepositoryTokens.NODE_RELATION_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, RepositoryTokens.RELATION_TYPE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
    async (c) => {
      const repository = await c.resolve(RepositoryTokens.RELATION_TYPE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new CreateRelationTypeUseCase(repository, logger)
    },
    [RepositoryTokens.RELATION_TYPE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE,
    async (c) => {
      const graphRepository = await c.resolve(RepositoryTokens.GRAPH_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SearchRelatedNodesUseCase(graphRepository, logger)
    },
    [RepositoryTokens.GRAPH_REPOSITORY, CommonTokens.LOGGER]
  )



  // Import/Export use cases
  container.registerSingleton(
    UseCaseTokens.SCHEMA_EXPORT_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SchemaExportUseCase(tableRepository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, CommonTokens.LOGGER]
  )

  container.registerSingleton(
    UseCaseTokens.SCHEMA_IMPORT_USE_CASE,
    async (c) => {
      const tableRepository = await c.resolve(RepositoryTokens.TABLE_REPOSITORY)
      const attributeRepository = await c.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
      const nodeRepository = await c.resolve(RepositoryTokens.NODE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new SchemaImportUseCase(tableRepository, attributeRepository, nodeRepository, logger)
    },
    [RepositoryTokens.TABLE_REPOSITORY, RepositoryTokens.ATTRIBUTE_REPOSITORY, RepositoryTokens.NODE_REPOSITORY, CommonTokens.LOGGER]
  )

  // Query template use cases
  container.registerSingleton(
    UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE,
    async (c) => {
      const queryTemplateRepository = await c.resolve(RepositoryTokens.QUERY_TEMPLATE_REPOSITORY)
      const logger = await c.resolve(CommonTokens.LOGGER)
      return new ExecuteQueryTemplate(queryTemplateRepository, logger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY, CommonTokens.LOGGER]
  )
}