import { CreateAttributeTypeUseCase } from '@/application/use-cases/attribute-types/CreateAttributeType.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import { ActivateDocUseCase } from '@/application/use-cases/docs/ActivateDoc.js'
import { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import { DeleteDocUseCase } from '@/application/use-cases/docs/DeleteDoc.js'
import { UpdateDocUseCase } from '@/application/use-cases/docs/UpdateDoc.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import { TableNodesExportUseCase } from '@/application/use-cases/export/TableNodesExportUseCase.js'
import { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import { SystemMonitoringUseCase } from '@/application/use-cases/monitoring/SystemMonitoringUseCase.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'
import { ExecuteTemplateWithSubscriptionUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithSubscriptionUseCase.js'
import { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import { SystemInitializationUseCase } from '@/application/use-cases/system/SystemInitializationUseCase.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import type { DIContainer, ServiceToken } from '../DIContainer.js'
import { GraphQLTokens, RepositoryTokens, UseCaseTokens } from '../tokens/index.js'

const simpleLogger: ILogger = {
  info: (message, meta) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta || ''),
}

async function resolveAs<T>(container: DIContainer, token: ServiceToken): Promise<T> {
  return container.resolve(token as ServiceToken<T>)
}

/**
 * Use case module - registers all application use cases
 */
export function registerUseCaseModule(container: DIContainer): void {
  // Table use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_TABLE_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof CreateTableUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const queryTemplateRepository = await resolveAs<ConstructorParameters<typeof CreateTableUseCase>[1]>(
        c,
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof CreateTableUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      return new CreateTableUseCase(tableRepository, queryTemplateRepository, attributeRepository, simpleLogger)
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.DELETE_TABLE_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof DeleteTableUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof DeleteTableUseCase>[1]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof DeleteTableUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const relationRepository = await resolveAs<ConstructorParameters<typeof DeleteTableUseCase>[3]>(
        c,
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )
      return new DeleteTableUseCase(
        tableRepository,
        nodeRepository,
        attributeRepository,
        relationRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.GET_TABLE_DOCS_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[1]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const attributeTypeRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[3]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const nodeAttributeRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[4]>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const queryTemplateRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[5]>(
        c,
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )
      const relationTypeRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[6]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      const docRepository = await resolveAs<ConstructorParameters<typeof GetTableDocsUseCase>[7]>(
        c,
        RepositoryTokens.DOC_REPOSITORY,
      )
      return new GetTableDocsUseCase(
        tableRepository,
        attributeRepository,
        attributeTypeRepository,
        nodeRepository,
        nodeAttributeRepository,
        queryTemplateRepository,
        relationTypeRepository,
        docRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.DOC_REPOSITORY,
    ],
  )

  // Attribute use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_TYPE_USE_CASE,
    async (c) => {
      const repository = await resolveAs<ConstructorParameters<typeof CreateAttributeTypeUseCase>[0]>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      return new CreateAttributeTypeUseCase(repository, simpleLogger)
    },
    [RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    async (c) => {
      const attributeRepository = await resolveAs<ConstructorParameters<typeof CreateAttributeUseCase>[0]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const attributeTypeRepository = await resolveAs<ConstructorParameters<typeof CreateAttributeUseCase>[1]>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof CreateAttributeUseCase>[2]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const queryTemplateRepository = await resolveAs<ConstructorParameters<typeof CreateAttributeUseCase>[3]>(
        c,
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )
      return new CreateAttributeUseCase(
        attributeRepository,
        attributeTypeRepository,
        tableRepository,
        queryTemplateRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
    ],
  )

  // Node use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_NODE_USE_CASE,
    async (c) => {
      const nodeRepository = await resolveAs<ConstructorParameters<typeof CreateNodeUseCase>[0]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const nodeAttributeRepository = await resolveAs<ConstructorParameters<typeof CreateNodeUseCase>[1]>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof CreateNodeUseCase>[2]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof CreateNodeUseCase>[3]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      return new CreateNodeUseCase(
        nodeRepository,
        nodeAttributeRepository,
        tableRepository,
        attributeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_NODES_USE_CASE,
    async (c) => {
      const nodeRepository = await resolveAs<ConstructorParameters<typeof SearchNodesUseCase>[0]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const nodeSearchRepository = await resolveAs<ConstructorParameters<typeof SearchNodesUseCase>[1]>(
        c,
        RepositoryTokens.NODE_SEARCH_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof SearchNodesUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof SearchNodesUseCase>[3]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      return new SearchNodesUseCase(
        nodeRepository,
        nodeSearchRepository,
        attributeRepository,
        tableRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_SEARCH_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  // Relation use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_USE_CASE,
    async (c) => {
      const nodeRelationRepository = await resolveAs<ConstructorParameters<typeof CreateRelationUseCase>[0]>(
        c,
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )
      const relationTypeRepository = await resolveAs<ConstructorParameters<typeof CreateRelationUseCase>[1]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof CreateRelationUseCase>[2]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof CreateRelationUseCase>[3]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      return new CreateRelationUseCase(
        nodeRelationRepository,
        relationTypeRepository,
        nodeRepository,
        tableRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
    async (c) => {
      const repository = await resolveAs<ConstructorParameters<typeof CreateRelationTypeUseCase>[0]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      return new CreateRelationTypeUseCase(repository, simpleLogger)
    },
    [RepositoryTokens.RELATION_TYPE_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE,
    async (c) => {
      const nodeRepository = await resolveAs<ConstructorParameters<typeof SearchRelatedNodesUseCase>[0]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const relationRepository = await resolveAs<ConstructorParameters<typeof SearchRelatedNodesUseCase>[1]>(
        c,
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )
      const graphRepository = await resolveAs<ConstructorParameters<typeof SearchRelatedNodesUseCase>[2]>(
        c,
        RepositoryTokens.GRAPH_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof SearchRelatedNodesUseCase>[3]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      return new SearchRelatedNodesUseCase(
        nodeRepository,
        relationRepository,
        graphRepository,
        tableRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.GRAPH_REPOSITORY,
      RepositoryTokens.TABLE_REPOSITORY,
    ],
  )

  // Import/Export use cases
  container.registerSingleton(
    UseCaseTokens.SCHEMA_EXPORT_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const attributeTypeRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[1]>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[3]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const relationRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[4]>(
        c,
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )
      const relationTypeRepository = await resolveAs<ConstructorParameters<typeof SchemaExportUseCase>[5]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      return new SchemaExportUseCase(
        tableRepository,
        attributeTypeRepository,
        attributeRepository,
        nodeRepository,
        relationRepository,
        relationTypeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.SCHEMA_IMPORT_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const attributeTypeRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[1]>(
        c,
        RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[3]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const relationRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[4]>(
        c,
        RepositoryTokens.NODE_RELATION_REPOSITORY,
      )
      const relationTypeRepository = await resolveAs<ConstructorParameters<typeof SchemaImportUseCase>[5]>(
        c,
        RepositoryTokens.RELATION_TYPE_REPOSITORY,
      )
      return new SchemaImportUseCase(
        tableRepository,
        attributeTypeRepository,
        attributeRepository,
        nodeRepository,
        relationRepository,
        relationTypeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.NODE_RELATION_REPOSITORY,
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    ],
  )

  container.registerSingleton(
    UseCaseTokens.TABLE_NODES_EXPORT_USE_CASE,
    async (c) => {
      const tableRepository = await resolveAs<ConstructorParameters<typeof TableNodesExportUseCase>[0]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      const nodeRepository = await resolveAs<ConstructorParameters<typeof TableNodesExportUseCase>[1]>(
        c,
        RepositoryTokens.NODE_REPOSITORY,
      )
      const attributeRepository = await resolveAs<ConstructorParameters<typeof TableNodesExportUseCase>[2]>(
        c,
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const nodeAttributeRepository = await resolveAs<ConstructorParameters<typeof TableNodesExportUseCase>[3]>(
        c,
        RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
      )
      return new TableNodesExportUseCase(
        tableRepository,
        nodeRepository,
        attributeRepository,
        nodeAttributeRepository,
        simpleLogger,
      )
    },
    [
      RepositoryTokens.TABLE_REPOSITORY,
      RepositoryTokens.NODE_REPOSITORY,
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    ],
  )

  // Query template use cases
  container.registerSingleton(
    UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE,
    async (c) => {
      const queryTemplateRepository = await resolveAs<ConstructorParameters<typeof ExecuteQueryTemplateUseCase>[0]>(
        c,
        RepositoryTokens.QUERY_TEMPLATE_REPOSITORY,
      )
      return new ExecuteQueryTemplateUseCase(queryTemplateRepository, simpleLogger)
    },
    [RepositoryTokens.QUERY_TEMPLATE_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE,
    async (c) => {
      const executeQueryTemplateUseCase = await resolveAs<
        ConstructorParameters<typeof ExecuteTemplateWithGraphQLUseCase>[0]
      >(c, UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE)
      const graphqlSchema = await resolveAs<ConstructorParameters<typeof ExecuteTemplateWithGraphQLUseCase>[1]>(
        c,
        GraphQLTokens.GRAPHQL_SCHEMA,
      )
      return new ExecuteTemplateWithGraphQLUseCase(executeQueryTemplateUseCase, graphqlSchema, simpleLogger)
    },
    [UseCaseTokens.EXECUTE_QUERY_TEMPLATE_USE_CASE, GraphQLTokens.GRAPHQL_SCHEMA],
  )

  container.registerSingleton(
    UseCaseTokens.EXECUTE_TEMPLATE_WITH_SUBSCRIPTION_USE_CASE,
    async (c) => {
      const executeTemplateWithGraphQLUseCase = await resolveAs<
        ConstructorParameters<typeof ExecuteTemplateWithSubscriptionUseCase>[0]
      >(c, UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE)
      return new ExecuteTemplateWithSubscriptionUseCase(executeTemplateWithGraphQLUseCase, simpleLogger)
    },
    [UseCaseTokens.EXECUTE_TEMPLATE_WITH_GRAPHQL_USE_CASE],
  )

  // Doc use cases
  container.registerSingleton(
    UseCaseTokens.CREATE_DOC_USE_CASE,
    async (c) => {
      const docRepository = await resolveAs<ConstructorParameters<typeof CreateDocUseCase>[0]>(
        c,
        RepositoryTokens.DOC_REPOSITORY,
      )
      const tableRepository = await resolveAs<ConstructorParameters<typeof CreateDocUseCase>[1]>(
        c,
        RepositoryTokens.TABLE_REPOSITORY,
      )
      return new CreateDocUseCase(docRepository, tableRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY, RepositoryTokens.TABLE_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.UPDATE_DOC_USE_CASE,
    async (c) => {
      const docRepository = await resolveAs<ConstructorParameters<typeof UpdateDocUseCase>[0]>(
        c,
        RepositoryTokens.DOC_REPOSITORY,
      )
      return new UpdateDocUseCase(docRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.DELETE_DOC_USE_CASE,
    async (c) => {
      const docRepository = await resolveAs<ConstructorParameters<typeof DeleteDocUseCase>[0]>(
        c,
        RepositoryTokens.DOC_REPOSITORY,
      )
      return new DeleteDocUseCase(docRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY],
  )

  container.registerSingleton(
    UseCaseTokens.ACTIVATE_DOC_USE_CASE,
    async (c) => {
      const docRepository = await resolveAs<ConstructorParameters<typeof ActivateDocUseCase>[0]>(
        c,
        RepositoryTokens.DOC_REPOSITORY,
      )
      return new ActivateDocUseCase(docRepository, simpleLogger)
    },
    [RepositoryTokens.DOC_REPOSITORY],
  )

  // Monitoring use cases
  container.registerSingleton(
    UseCaseTokens.SYSTEM_MONITORING_USE_CASE,
    async (_c) => {
      return new SystemMonitoringUseCase(simpleLogger)
    },
    [],
  )

  // System initialization use case
  container.registerSingleton(
    UseCaseTokens.SYSTEM_INITIALIZATION_USE_CASE,
    async (c) => {
      return new SystemInitializationUseCase(c)
    },
    [],
  )
}
