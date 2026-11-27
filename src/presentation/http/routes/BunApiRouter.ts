import type { ILogger } from '@/application/ports/ILogger.js'
import {
  BUN_GRAPH_DB_API_VERSION,
  extractRestExactNodeId,
  extractRestExactRelationId,
  extractRestExactTableId,
} from '@/core/contracts/RestRouteContract.js'
import type { AttributeApiController } from '../controllers/AttributeApiController.js'
import type { GraphApiController } from '../controllers/GraphApiController.js'
import type { GraphDbApiController } from '../controllers/GraphDbApiController.js'
import type { McpToolController } from '../controllers/McpToolController.js'
import type { HttpControllerHandler } from '../adapters/BunControllerAdapter.js'
import { executeHttpController, type HttpExecutionHooks } from '../aspects/HttpExecutionPipeline.js'
import { toErrorMeta } from '../utils/errorHelpers.js'

export interface BunApiRouterDependencies {
  logger: ILogger
  graphDbController: GraphDbApiController
  attributeController: AttributeApiController
  graphController: GraphApiController
  mcpToolController: McpToolController
  hooks?: HttpExecutionHooks
}

export type BunApiRouter = (request: Request) => Promise<Response>

/**
 * Web-standard REST router for Node 26 and portable Web Fetch runtimes. Authentication is intentionally composed
 * outside this router by the external request handler, before any route is
 * dispatched. Keeping this router free of fallback handlers makes that order
 * explicit and prevents a REST route from gaining an unauthenticated entry.
 */
export function createBunApiRouter({
  logger,
  graphDbController,
  attributeController,
  graphController,
  mcpToolController,
  hooks,
}: BunApiRouterDependencies): BunApiRouter {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method
    const tableOpenApiProjectionMatch =
      method === 'GET' ? pathname.match(/^\/api\/tables\/([^/]+)\/openapi-projection$/) : null
    const tableSchemaAuditMatch =
      method === 'GET' ? pathname.match(/^\/api\/tables\/([^/]+)\/schema\/audit$/) : null
    const nodeEmbeddingMatch = pathname.match(/^\/api\/nodes\/([^/]+)\/embedding$/)

    const run = (handler: HttpControllerHandler, params: Record<string, string> = {}): Promise<Response> =>
      executeHttpController(request, handler, params, logger, hooks)

    try {
      if (method === 'GET' && pathname === '/api/health') {
        logger.info('Health check endpoint called')
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: 'OK',
              timestamp: new Date().toISOString(),
              database: 'Connected',
              version: BUN_GRAPH_DB_API_VERSION,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (method === 'GET' && pathname === '/api/openapi') {
        return await run(graphDbController.getOpenApiDocument.bind(graphDbController))
      }
      if (method === 'GET' && pathname === '/api/stats') {
        return await run(graphDbController.systemStats.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/tables') {
        return await run(graphDbController.createTable.bind(graphDbController))
      }
      if (method === 'GET' && pathname === '/api/tables/search') {
        return await run(graphDbController.searchTables.bind(graphDbController))
      }
      if (method === 'GET' && pathname === '/api/tables') {
        return await run(graphController.getTables.bind(graphController))
      }
      const tableDocsMatch =
        method === 'GET' ? pathname.match(/^\/api\/tables\/([^/]+)\/docs$/) : null
      if (tableDocsMatch) {
        return await run(graphController.getTableDocs.bind(graphController), {
          tableId: decodeURIComponent(tableDocsMatch[1] || ''),
        })
      }
      if (method === 'GET' && pathname === '/api/tables/docs') {
        return await run(graphController.getTableDocs.bind(graphController))
      }
      if (tableOpenApiProjectionMatch) {
        return await run(graphController.getTableOpenApiProjection.bind(graphController), {
          tableId: decodeURIComponent(tableOpenApiProjectionMatch[1] || ''),
        })
      }
      if (tableSchemaAuditMatch) {
        return await run(graphController.getTableSchemaAudit.bind(graphController), {
          tableId: decodeURIComponent(tableSchemaAuditMatch[1] || ''),
        })
      }
      const tableColumnsMatch =
        method === 'GET' ? pathname.match(/^\/api\/tables\/([^/]+)\/columns$/) : null
      if (tableColumnsMatch) {
        return await run(attributeController.getTableColumns.bind(attributeController), {
          tableId: decodeURIComponent(tableColumnsMatch[1] || ''),
        })
      }
      const tableColumnConfigMatch =
        method === 'PUT' ? pathname.match(/^\/api\/tables\/([^/]+)\/columns\/([^/]+)$/) : null
      if (tableColumnConfigMatch) {
        return await run(attributeController.configureTableColumn.bind(attributeController), {
          tableId: decodeURIComponent(tableColumnConfigMatch[1] || ''),
          attributeIdentifier: decodeURIComponent(tableColumnConfigMatch[2] || ''),
        })
      }
      const tableExportMatch = method === 'POST' ? pathname.match(/^\/api\/tables\/([^/]+)\/export$/) : null
      if (tableExportMatch) {
        return await run(graphController.exportTableWithNodes.bind(graphController), {
          tableId: decodeURIComponent(tableExportMatch[1] || ''),
        })
      }
      if (method === 'GET' || method === 'DELETE') {
        const tableId = extractRestExactTableId(pathname)
        if (tableId) {
          if (method === 'GET') {
            return await run(graphDbController.getTable.bind(graphDbController), { tableId })
          }
          return await run(graphDbController.deleteTable.bind(graphDbController), { tableId })
        }
      }
      if (nodeEmbeddingMatch) {
        const nodeId = decodeURIComponent(nodeEmbeddingMatch[1] || '')
        if (method === 'GET') {
          return await run(graphController.getNodeEmbedding.bind(graphController), { nodeId })
        }
        if (method === 'PUT') {
          return await run(graphController.setNodeEmbedding.bind(graphController), { nodeId })
        }
        if (method === 'DELETE') {
          return await run(graphController.removeNodeEmbedding.bind(graphController), { nodeId })
        }
      }
      const nodeConnectedMatch =
        method === 'GET' ? pathname.match(/^\/api\/nodes\/([^/]+)\/connected$/) : null
      if (nodeConnectedMatch) {
        return await run(graphController.getConnectedNodes.bind(graphController), {
          nodeId: decodeURIComponent(nodeConnectedMatch[1] || ''),
        })
      }
      const nodeRelationsMatch =
        method === 'GET' ? pathname.match(/^\/api\/nodes\/([^/]+)\/relations$/) : null
      if (nodeRelationsMatch) {
        return await run(graphController.getNodeRelations.bind(graphController), {
          nodeId: decodeURIComponent(nodeRelationsMatch[1] || ''),
        })
      }
      if (method === 'POST' && pathname === '/api/nodes/shortest-path') {
        return await run(graphController.findShortestPath.bind(graphController))
      }
      if (method === 'POST' && pathname === '/api/nodes/hybrid-search') {
        return await run(graphController.hybridSearchNodes.bind(graphController))
      }
      if (method === 'GET' && pathname === '/api/nodes/search') {
        return await run(graphDbController.searchNodes.bind(graphDbController))
      }
      const nodeAttributesMatch = method === 'GET' ? pathname.match(/^\/api\/nodes\/([^/]+)\/attributes$/) : null
      if (nodeAttributesMatch) {
        return await run(attributeController.getNodeAttributes.bind(attributeController), {
          nodeId: decodeURIComponent(nodeAttributesMatch[1] || ''),
        })
      }
      if (method === 'GET' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        const nodeId = extractRestExactNodeId(pathname)
        if (nodeId) {
          if (method === 'GET') {
            return await run(graphDbController.getNode.bind(graphDbController), { nodeId })
          }
          if (method === 'DELETE') {
            return await run(graphDbController.deleteNode.bind(graphDbController), { nodeId })
          }
          return await run(graphDbController.updateNode.bind(graphDbController), { nodeId })
        }
      }
      if (method === 'POST' && pathname === '/api/nodes') {
        return await run(graphDbController.createNode.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/relations') {
        return await run(graphDbController.createRelation.bind(graphDbController))
      }
      if (method === 'GET' && pathname === '/api/relations/search') {
        return await run(graphController.searchRelations.bind(graphController))
      }
      if (method === 'DELETE') {
        const relationId = extractRestExactRelationId(pathname)
        if (relationId) {
          return await run(graphDbController.deleteRelation.bind(graphDbController), { relationId })
        }
      }
      if (method === 'GET' && pathname === '/api/relation-types') {
        return await run(graphDbController.listRelationTypes.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/relation-types') {
        return await run(graphDbController.createRelationType.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/templates') {
        return await run(graphDbController.createTemplate.bind(graphDbController))
      }
      if (method === 'GET' && pathname === '/api/templates/search') {
        return await run(graphDbController.searchTemplates.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/templates/execute') {
        return await run(graphDbController.executeTemplateWithGraphQL.bind(graphDbController))
      }
      const templateExportMatch =
        method === 'GET' ? pathname.match(/^\/api\/templates\/([^/]+)\/export$/) : null
      if (templateExportMatch) {
        return await run(graphDbController.exportTemplate.bind(graphDbController), {
          templateIdentifier: decodeURIComponent(templateExportMatch[1] || ''),
        })
      }
      if (method === 'POST' && pathname === '/api/templates/import') {
        return await run(graphDbController.importTemplate.bind(graphDbController))
      }
      if (method === 'POST' && pathname === '/api/attributes') {
        return await run(attributeController.createAttribute.bind(attributeController))
      }
      const tableAttributesMatch =
        method === 'GET' ? pathname.match(/^\/api\/attributes\/tables\/([^/]+)$/) : null
      if (tableAttributesMatch) {
        return await run(attributeController.getTableAttributes.bind(attributeController), {
          tableId: decodeURIComponent(tableAttributesMatch[1] || ''),
        })
      }
      const attributeItemMatch =
        method === 'PUT' || method === 'DELETE' ? pathname.match(/^\/api\/attributes\/([^/]+)$/) : null
      if (attributeItemMatch) {
        const attributeId = decodeURIComponent(attributeItemMatch[1] || '')
        if (method === 'PUT') {
          return await run(attributeController.updateAttribute.bind(attributeController), { attributeId })
        }
        return await run(attributeController.deleteAttribute.bind(attributeController), { attributeId })
      }
      if (method === 'POST' && pathname === '/api/node-attributes') {
        return await run(attributeController.setNodeAttribute.bind(attributeController))
      }
      if (method === 'PUT' && pathname === '/api/node-attributes') {
        return await run(attributeController.updateNodeAttributeValue.bind(attributeController))
      }
      if (method === 'DELETE' && pathname === '/api/node-attributes') {
        return await run(attributeController.removeNodeAttribute.bind(attributeController))
      }
      if (method === 'GET' && pathname === '/api/mcp-tools') {
        return await run(mcpToolController.listMcpTools.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/call') {
        return await run(mcpToolController.callMcpTool.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/bulk-import-templates') {
        return await run(mcpToolController.bulkImportTemplates.bind(mcpToolController))
      }
      if (method === 'GET' && pathname === '/api/mcp-tools/list-available-templates') {
        return await run(mcpToolController.listAvailableTemplates.bind(mcpToolController))
      }
      if (method === 'GET' && pathname === '/api/mcp-tools/import-status') {
        return await run(mcpToolController.getImportStatus.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/create-template') {
        return await run(mcpToolController.createTemplate.bind(mcpToolController))
      }
      if (method === 'PUT' && pathname === '/api/mcp-tools/update-template') {
        return await run(mcpToolController.updateTemplate.bind(mcpToolController))
      }
      if (method === 'DELETE' && pathname === '/api/mcp-tools/delete-template') {
        return await run(mcpToolController.deleteTemplate.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/validate-template') {
        return await run(mcpToolController.validateTemplate.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/search-templates') {
        return await run(mcpToolController.searchTemplates.bind(mcpToolController))
      }
      if (method === 'GET' && pathname === '/api/mcp-tools/get-template-metadata') {
        return await run(mcpToolController.getTemplateMetadata.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/initialize-system') {
        return await run(mcpToolController.initializeSystem.bind(mcpToolController))
      }
      if (method === 'GET' && pathname === '/api/mcp-tools/get-system-status') {
        return await run(mcpToolController.getSystemStatus.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/quick-reset') {
        return await run(mcpToolController.quickReset.bind(mcpToolController))
      }
      if (method === 'POST' && pathname === '/api/mcp-tools/setup-demo') {
        return await run(mcpToolController.setupDemo.bind(mcpToolController))
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      logger.error('API request error:', toErrorMeta(error))
      return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
