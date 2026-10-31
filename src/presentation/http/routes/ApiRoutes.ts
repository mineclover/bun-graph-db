import express from 'express'
import type { AttributeApiController } from '../controllers/AttributeApiController.js'
import type { GraphApiController } from '../controllers/GraphApiController.js'
import type { GraphDbApiController } from '../controllers/GraphDbApiController.js'
import type { McpToolController } from '../controllers/McpToolController.js'

export function createApiRoutes(
  graphDbController: GraphDbApiController,
  attributeController: AttributeApiController,
  graphController: GraphApiController,
  mcpToolController?: McpToolController,
): express.Router {
  const router = express.Router()

  // System Operations
  router.get('/health', (req, res) => graphDbController.healthCheck(req, res))
  router.get('/stats', (req, res) => graphDbController.systemStats(req, res))
  router.get('/openapi', (req, res) => graphDbController.getOpenApiDocument(req, res))

  // Table Operations
  router.post('/tables', (req, res) => graphDbController.createTable(req, res))
  router.get('/tables', (req, res) => graphController.getTables(req, res))
  router.get('/tables/search', (req, res) => graphDbController.searchTables(req, res))
  router.get('/tables/:tableId/docs', (req, res) => graphController.getTableDocs(req, res))
  router.get('/tables/:tableId/openapi-projection', (req, res) => graphController.getTableOpenApiProjection(req, res))
  router.get('/tables/:tableId/schema/audit', (req, res) => graphController.getTableSchemaAudit(req, res))
  router.post('/tables/:tableId/export', (req, res) => graphController.exportTableWithNodes(req, res))

  // Node Operations
  router.post('/nodes', (req, res) => graphDbController.createNode(req, res))
  router.get('/nodes/:nodeId/embedding', (req, res) => graphController.getNodeEmbedding(req, res))
  router.put('/nodes/:nodeId/embedding', (req, res) => graphController.setNodeEmbedding(req, res))
  router.delete('/nodes/:nodeId/embedding', (req, res) => graphController.removeNodeEmbedding(req, res))
  router.post('/nodes/hybrid-search', (req, res) => graphController.hybridSearchNodes(req, res))
  router.put('/nodes/:nodeId', (req, res) => graphDbController.updateNode(req, res))
  router.patch('/nodes/:nodeId', (req, res) => graphDbController.updateNode(req, res))
  router.get('/nodes/search', (req, res) => graphDbController.searchNodes(req, res))
  router.get('/nodes/:nodeId/connected', (req, res) => graphController.getConnectedNodes(req, res))
  router.get('/nodes/:nodeId/relations', (req, res) => graphController.getNodeRelations(req, res))
  router.get('/nodes/:nodeId/attributes', (req, res) => attributeController.getNodeAttributes(req, res))
  router.post('/nodes/shortest-path', (req, res) => graphController.findShortestPath(req, res))

  // Relation Operations
  router.post('/relations', (req, res) => graphDbController.createRelation(req, res))
  router.get('/relations/search', (req, res) => graphController.searchRelations(req, res))

  // Template Operations
  router.post('/templates', (req, res) => graphDbController.createTemplate(req, res))
  router.get('/templates/search', (req, res) => graphDbController.searchTemplates(req, res))
  router.post('/templates/execute', (req, res) => graphDbController.executeTemplateWithGraphQL(req, res))
  router.get('/templates/:templateIdentifier/export', (req, res) => graphDbController.exportTemplate(req, res))
  router.post('/templates/import', (req, res) => graphDbController.importTemplate(req, res))

  // Attribute Operations
  router.post('/attributes', (req, res) => attributeController.createAttribute(req, res))
  router.put('/attributes/:attributeId', (req, res) => attributeController.updateAttribute(req, res))
  router.delete('/attributes/:attributeId', (req, res) => attributeController.deleteAttribute(req, res))
  router.get('/attributes/tables/:tableId', (req, res) => attributeController.getTableAttributes(req, res))

  // Node Attribute Operations
  router.post('/node-attributes', (req, res) => attributeController.setNodeAttribute(req, res))
  router.put('/node-attributes', (req, res) => attributeController.updateNodeAttributeValue(req, res))
  router.delete('/node-attributes', (req, res) => attributeController.removeNodeAttribute(req, res))

  // MCP Tool Operations (Bridge between GraphQL and local services)
  if (mcpToolController) {
    router.get('/mcp-tools', (req, res) => mcpToolController.listMcpTools(req, res))
    router.post('/mcp-tools/call', (req, res) => mcpToolController.callMcpTool(req, res))
    router.post('/mcp-tools/bulk-import-templates', (req, res) => mcpToolController.bulkImportTemplates(req, res))
    router.get('/mcp-tools/list-available-templates', (req, res) => mcpToolController.listAvailableTemplates(req, res))
    router.get('/mcp-tools/import-status', (req, res) => mcpToolController.getImportStatus(req, res))

    // New template management tools
    router.post('/mcp-tools/create-template', (req, res) => mcpToolController.createTemplate(req, res))
    router.put('/mcp-tools/update-template', (req, res) => mcpToolController.updateTemplate(req, res))
    router.delete('/mcp-tools/delete-template', (req, res) => mcpToolController.deleteTemplate(req, res))
    router.post('/mcp-tools/validate-template', (req, res) => mcpToolController.validateTemplate(req, res))
    router.post('/mcp-tools/search-templates', (req, res) => mcpToolController.searchTemplates(req, res))
    router.get('/mcp-tools/get-template-metadata', (req, res) => mcpToolController.getTemplateMetadata(req, res))

    // Table export tools
    router.post('/mcp-tools/export-table-nodes', (req, res) => mcpToolController.exportTableNodes(req, res))

    // System initialization tools
    router.post('/mcp-tools/initialize-system', (req, res) => mcpToolController.initializeSystem(req, res))
    router.get('/mcp-tools/get-system-status', (req, res) => mcpToolController.getSystemStatus(req, res))
    router.post('/mcp-tools/quick-reset', (req, res) => mcpToolController.quickReset(req, res))
    router.post('/mcp-tools/setup-demo', (req, res) => mcpToolController.setupDemo(req, res))

    // Tabular sync config tools
    router.get('/mcp-tools/list-tabular-sync-configs', (req, res) => mcpToolController.callMcpTool(req, res))
    router.get('/mcp-tools/get-tabular-sync-config', (req, res) => mcpToolController.callMcpTool(req, res))
    router.post('/mcp-tools/save-tabular-sync-config', (req, res) => mcpToolController.callMcpTool(req, res))
    router.post('/mcp-tools/activate-tabular-sync-config', (req, res) => mcpToolController.callMcpTool(req, res))
    router.get('/mcp-tools/get-tabular-sync-status', (req, res) => mcpToolController.callMcpTool(req, res))
    router.get('/mcp-tools/get-tabular-sync-summary', (req, res) => mcpToolController.callMcpTool(req, res))
    router.post('/mcp-tools/resync-tabular-sync-table', (req, res) => mcpToolController.callMcpTool(req, res))
  }

  return router
}

// API 엔드포인트 매핑 문서화
export const API_ENDPOINT_MAPPING = {
  // MCP Tool Name -> REST API Endpoint
  healthCheck: 'GET /api/health',
  systemStats: 'GET /api/stats',
  getOpenApiDocument: 'GET /api/openapi',
  createTable: 'POST /api/tables',
  searchTables: 'GET /api/tables/search',
  createNode: 'POST /api/nodes',
  updateNode: 'PUT/PATCH /api/nodes/:nodeId',
  searchNodes: 'GET /api/nodes/search',
  createRelation: 'POST /api/relations',
  createTemplate: 'POST /api/templates',
  executeTemplateWithGraphQL: 'POST /api/templates/execute',
  searchTemplates: 'GET /api/templates/search',
  exportTemplate: 'GET /api/templates/:templateIdentifier/export',
  importTemplate: 'POST /api/templates/import',
  setNodeAttribute: 'POST /api/node-attributes',
  createAttribute: 'POST /api/attributes',
  updateAttribute: 'PUT /api/attributes/:attributeId',
  deleteAttribute: 'DELETE /api/attributes/:attributeId',
  getTableAttributes: 'GET /api/attributes/tables/:tableId',
  removeNodeAttribute: 'DELETE /api/node-attributes',
  updateNodeAttributeValue: 'PUT /api/node-attributes',
  getNodeAttributes: 'GET /api/nodes/:nodeId/attributes',
  getTables: 'GET /api/tables',
  getTableDocs: 'GET /api/tables/:tableId/docs',
  getTableOpenApiProjection: 'GET /api/tables/:tableId/openapi-projection',
  exportTableWithNodes: 'POST /api/tables/:tableId/export',
  searchRelations: 'GET /api/relations/search',
  getConnectedNodes: 'GET /api/nodes/:nodeId/connected',
  findShortestPath: 'POST /api/nodes/shortest-path',
  getNodeRelations: 'GET /api/nodes/:nodeId/relations',
  'set-node-embedding': 'PUT /api/nodes/:nodeId/embedding',
  'get-node-embedding': 'GET /api/nodes/:nodeId/embedding',
  'remove-node-embedding': 'DELETE /api/nodes/:nodeId/embedding',
  'hybrid-search-nodes': 'POST /api/nodes/hybrid-search',

  // MCP Tool endpoints
  'bulk-import-templates': 'POST /api/mcp-tools/bulk-import-templates',
  'list-available-templates': 'GET /api/mcp-tools/list-available-templates',
  'get-import-status': 'GET /api/mcp-tools/import-status',
  'create-template': 'POST /api/mcp-tools/create-template',
  'update-template': 'PUT /api/mcp-tools/update-template',
  'delete-template': 'DELETE /api/mcp-tools/delete-template',
  'validate-template': 'POST /api/mcp-tools/validate-template',
  'search-templates': 'POST /api/mcp-tools/search-templates',
  'get-template-metadata': 'GET /api/mcp-tools/get-template-metadata',
  'export-table-nodes': 'POST /api/mcp-tools/call',
  callMcpTool: 'POST /api/mcp-tools/call',
  listMcpTools: 'GET /api/mcp-tools',

  // System initialization tool endpoints
  'initialize-system': 'POST /api/mcp-tools/initialize-system',
  'get-system-status': 'GET /api/mcp-tools/get-system-status',
  'quick-reset': 'POST /api/mcp-tools/quick-reset',
  'setup-demo': 'POST /api/mcp-tools/setup-demo',
  'list-tabular-sync-configs': 'GET /api/mcp-tools/call',
  'get-tabular-sync-config': 'GET /api/mcp-tools/call',
  'save-tabular-sync-config': 'POST /api/mcp-tools/call',
  'activate-tabular-sync-config': 'POST /api/mcp-tools/call',
  'get-tabular-sync-status': 'GET /api/mcp-tools/call',
  'get-tabular-sync-summary': 'GET /api/mcp-tools/call',
  'resync-tabular-sync-table': 'POST /api/mcp-tools/call',
}
