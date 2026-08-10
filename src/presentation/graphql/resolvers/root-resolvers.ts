import type { GraphQLResolveInfo } from "graphql";
import type { ILogger } from "@/application/ports/ILogger.js";
import type {
	GraphQLContext,
	GraphQLParent,
	NodeParent,
} from "@/core/types/GraphQLTypes.js";
import type { JsonExportService } from "@/domain/services/JsonExportService.js";
import type { SQLiteBackupService } from "@/domain/services/SQLiteBackupService.js";
import type { GraphQLDependencies } from "../GraphQLSchemaBuilder.js";
import type {
	AttributeMutations,
	DocMutations,
	NodeMutations,
	RelationMutations,
	TableMutations,
	TemplateMutations,
} from "../mutations/index.js";
import type { DocQueries, TemplateQueries } from "../queries/index.js";
import {
	callResolver,
	callRootResolver,
	callRootResolverWithFallback,
	castRootArgs as castArgs,
	castParent,
	type RootResolverArgs,
	withPaginationInput,
} from "./resolver-helpers.js";
import type { TablePackageResolver } from "./TablePackageResolver.js";

/**
 * Assembles Query and Mutation entry points while retaining the existing
 * resolver-class fallback behavior. Field resolvers stay in the schema builder.
 */
export const createRootResolvers = (deps: GraphQLDependencies) => ({
	Query: {
		_schema: () => null, // Required placeholder
		// Table queries
		table: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "table", _, args) ??
			callResolver(deps.tableQueries, "table", _, args),
		tableByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "tableByIdentifier", _, args) ??
			callResolver(deps.tableQueries, "tableByIdentifier", _, args),
		tables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "tables", _, args) ??
			callResolver(deps.tableQueries, "tables", _, args),
		getTables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "tables", _, {
				pagination: (args as { input?: Record<string, unknown> }).input,
			}) ??
			callResolver(deps.tableQueries, "tables", _, {
				pagination: (args as { input?: Record<string, unknown> }).input,
			}),
		searchTables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "searchTables", _, args) ??
			callResolver(deps.tableQueries, "searchTables", _, args),
		tableDocumentation: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "tableDocumentation", _, args) ??
			callResolver(deps.tableQueries, "tableDocumentation", _, args),
		tableOpenApiProjection: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.tableResolver, "tableOpenApiProjection", _, args) ??
			callResolver(deps.tableQueries, "tableOpenApiProjection", _, args),

		// Attribute type queries
		attributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.attributeResolver, "attributeType", _, args) ??
			callResolver(deps.attributeQueries, "attributeType", _, args),
		attributeTypeByIdentifier: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callResolver(
				deps.attributeResolver,
				"attributeTypeByIdentifier",
				_,
				args,
			) ??
			callResolver(deps.attributeQueries, "attributeTypeByIdentifier", _, args),
		attributeTypes: (_: GraphQLParent) =>
			callResolver(deps.attributeResolver, "attributeTypes", _) ??
			callResolver(deps.attributeQueries, "attributeTypes", _),

		// Attribute queries
		attribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.attributeResolver, "attribute", _, args) ??
			callResolver(deps.attributeQueries, "attribute", _, args),
		attributeByIdentifier: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.attributeResolver, "attributeByIdentifier", _, args) ??
			callResolver(deps.attributeQueries, "attributeByIdentifier", _, args),
		attributes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(deps.attributeResolver, "attributes", _, args) ??
			callResolver(deps.attributeQueries, "attributes", _, args),

		// Node queries
		node: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.nodeResolver,
				"node",
				_,
				castArgs<{ id: string }>(args),
			) ?? deps.nodeQueries.node(_, castArgs<{ id: string }>(args)),
		nodeByContent: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.nodeResolver,
				"nodeByContent",
				_,
				castArgs<{ tableId: string; content: string }>(args),
			) ??
			deps.nodeQueries.nodeByContent(
				_,
				castArgs<{ tableId: string; content: string }>(args),
			),
		getNodeAttributes: async (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) => ({
			attributes:
				(await (callResolver(
					deps.nodeResolver,
					"attributes_field",
					castParent<NodeParent>({
						id: String(args.nodeId || ""),
						tableId: "",
						content: "",
						createdAt: new Date(),
						updatedAt: new Date(),
						version: 0,
					}),
				) ||
					deps.nodeFieldResolvers.attributes(
						castParent<NodeParent>({
							id: String(args.nodeId || ""),
							tableId: "",
							content: "",
							createdAt: new Date(),
							updatedAt: new Date(),
							version: 0,
						}),
					))) || [],
		}),
		nodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.nodeResolver,
				"nodes",
				_,
				castArgs<Record<string, unknown>>(args),
			) ?? deps.nodeQueries.nodes(_, castArgs<Record<string, unknown>>(args)),
		searchNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.nodeResolver,
				"searchNodes",
				_,
				castArgs<Record<string, unknown>>(args),
			) ??
			deps.nodeQueries.searchNodes(_, castArgs<Record<string, unknown>>(args)),
		searchNodesByAttribute: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			deps.nodeQueries.searchNodesByAttribute(
				_,
				castArgs<Record<string, unknown>>(args),
				context,
			),

		// Relation queries
		relationType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.relationResolver,
				"relationType",
				_,
				castArgs<{ id: string }>(args),
			) ?? deps.relationQueries.relationType(_, castArgs<{ id: string }>(args)),
		relationTypes: (_: GraphQLParent) =>
			callResolver(deps.relationResolver, "relationTypes", _) ??
			deps.relationQueries.relationTypes(_),
		nodeRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.relationResolver,
				"nodeRelation",
				_,
				castArgs<{ id: string }>(args),
			) ?? deps.relationQueries.nodeRelation(_, castArgs<{ id: string }>(args)),
		nodeRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.relationResolver,
				"nodeRelations",
				_,
				castArgs<Record<string, unknown>>(args),
			) ??
			deps.relationQueries.nodeRelations(
				_,
				castArgs<Record<string, unknown>>(args),
			),
		searchRelatedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.relationResolver,
				"searchRelatedNodes",
				_,
				castArgs<Record<string, unknown>>(args),
			) ??
			deps.relationQueries.searchRelatedNodes(
				_,
				castArgs<Record<string, unknown>>(args),
			),
		getConnectedNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.relationQueries.getConnectedNodes(
				_,
				castArgs<{
					input?: {
						nodeId: string;
						depth?: number;
						direction?: string;
						relationTypeIds?: string[];
					};
					nodeId?: string;
					depth?: number;
					direction?: string;
					relationTypeIds?: string[];
				}>(args),
			),
		findPathsBetweenNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.relationQueries.findPathsBetweenNodes(
				_,
				castArgs<{
					input: {
						sourceNodeId: string;
						targetNodeId: string;
						maxDepth?: number;
						relationTypeIds?: string[];
					};
				}>(args),
			),
		getDependencyChain: (_: GraphQLParent, args: Record<string, unknown>) =>
			callResolver(
				deps.relationResolver,
				"getDependencyChain",
				_,
				castArgs<{
					input: {
						nodeId: string;
						direction?: string;
						maxDepth?: number;
						relationTypeIds?: string[];
					};
				}>(args),
			) ??
			deps.relationQueries.getDependencyChain(
				_,
				castArgs<{
					input: {
						nodeId: string;
						direction?: string;
						maxDepth?: number;
						relationTypeIds?: string[];
					};
				}>(args),
			),

		// Enhanced relation analytics (stub implementation)
		relationAnalytics: (_: GraphQLParent, _args: Record<string, unknown>) => ({
			totalRelations: 0,
			internalRelations: 0,
			externalRelations: 0,
			relationTypeDistribution: [],
			strengthDistribution: {
				invalid: 0,
				autoGenerated: 0,
				uncertain: 0,
				confident: 0,
				veryStrong: 0,
			},
			confidenceDistribution: {
				probablyWrong: 0,
				autoGenerated: 0,
				uncertainButValid: 0,
				confident: 0,
				verified: 0,
			},
			tableConnectivity: [],
			networkMetrics: {
				density: 0,
				clustering: 0,
				averagePathLength: 0,
				mostConnectedNodes: [],
				isolatedNodes: 0,
			},
		}),

		// Template queries
		getTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateQueries["getTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"getTemplate",
				deps.templateQueries,
				"getTemplate",
				_,
				args,
			),
		getTemplateByIdentifier: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateQueries["getTemplateByIdentifier"]>[1]
			>(
				deps.queryTemplateResolver,
				"getTemplateByIdentifier",
				deps.templateQueries,
				"getTemplateByIdentifier",
				_,
				args,
			),
		searchTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateQueries["searchTemplates"]>[1]
			>(
				deps.queryTemplateResolver,
				"searchTemplates",
				deps.templateQueries,
				"searchTemplates",
				_,
				args,
				undefined,
				undefined,
				withPaginationInput,
			),
		getPopularTemplates: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateQueries["getPopularTemplates"]>[1]
			>(
				deps.queryTemplateResolver,
				"getPopularTemplates",
				deps.templateQueries,
				"getPopularTemplates",
				_,
				args,
			),

		// Table dependency queries
		templatesByTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateQueries["templatesByTable"]>[1]
			>(
				deps.queryTemplateResolver,
				"templatesByTable",
				deps.templateQueries,
				"templatesByTable",
				_,
				args,
			),
		// Template execution (delegated to mutations)
		executeTemplate: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["executeTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"executeTemplate",
				deps.templateMutations,
				"executeTemplate",
				_,
				args,
				context,
			),

		// InputSchema validation
		validateInputSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<TemplateQueries["validateInputSchema"]>[1]>(
				deps.templateQueries,
				"validateInputSchema",
				_,
				args,
			),

		// Runtime data validation
		validateData: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<TemplateQueries["validateData"]>[1]>(
				deps.templateQueries,
				"validateData",
				_,
				args,
			),

		// Doc queries
		getDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocQueries["getDoc"]>[1]>(
				deps.docResolver,
				"getDoc",
				deps.docQueries,
				"getDoc",
				_,
				args,
			),
		getActiveDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocQueries["getActiveDoc"]>[1]>(
				deps.docResolver,
				"getActiveDoc",
				deps.docQueries,
				"getActiveDoc",
				_,
				args,
			),
		getDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocQueries["getDocs"]>[1]>(
				deps.docResolver,
				"getDocs",
				deps.docQueries,
				"getDocs",
				_,
				args,
			),
		getDocVersions: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocQueries["getDocVersions"]>[1]>(
				deps.docResolver,
				"getDocVersions",
				deps.docQueries,
				"getDocVersions",
				_,
				args,
			),
		searchDocs: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocQueries["searchDocs"]>[1]>(
				deps.docResolver,
				"searchDocs",
				deps.docQueries,
				"searchDocs",
				_,
				args,
			),

		// Essential system queries only
		healthCheck: (_: GraphQLParent, _args: Record<string, unknown>) =>
			deps.systemQueries?.healthCheck() || null,
		systemStats: (_: GraphQLParent, _args: Record<string, unknown>) =>
			deps.systemQueries?.systemStats() || null,
		systemStatus: (_: GraphQLParent, _args: Record<string, unknown>) =>
			deps.systemResolver?.systemStatus?.() || null,
		tabularSyncConfigs: (_: GraphQLParent, _args: Record<string, unknown>) =>
			deps.systemQueries?.tabularSyncConfigs?.() || [],
		tabularSyncConfig: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.systemQueries?.tabularSyncConfig?.(
				castArgs<{ configKey?: string | null }>(args),
			) || null,
		tabularSyncStatus: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.systemQueries?.tabularSyncStatus?.(
				castArgs<{
					limit?: number | null;
					tableIdentifier?: string | null;
					status?: string | null;
					mode?: string | null;
					windowPreset?: string | null;
					createdAfter?: string | null;
					createdBefore?: string | null;
				}>(args),
			) || null,
		tabularSyncSummary: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.systemQueries?.tabularSyncSummary?.(
				castArgs<{
					limit?: number | null;
					tableIdentifier?: string | null;
					status?: string | null;
					mode?: string | null;
					windowPreset?: string | null;
					createdAfter?: string | null;
					createdBefore?: string | null;
				}>(args),
			) || [],

		// Schema export queries
		exportTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<typeof deps.schemaResolvers.Query.exportTable>[1]
			>(deps.schemaResolvers.Query, "exportTable", _, args),
		exportAllTables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<typeof deps.schemaResolvers.Query.exportAllTables>[1]
			>(deps.schemaResolvers.Query, "exportAllTables", _, args),

		// Table Package queries
		validateTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<TablePackageResolver["validateTablePackage"]>[1]
			>(deps.tablePackageResolver, "validateTablePackage", _, args),
		analyzeTableDependencies: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<TablePackageResolver["analyzeTableDependencies"]>[1]
			>(deps.tablePackageResolver, "analyzeTableDependencies", _, args),
		getImportSession: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<TablePackageResolver["getImportSession"]>[1]>(
				deps.tablePackageResolver,
				"getImportSession",
				_,
				args,
			),

		// Export queries
		getSupportedExportFormats: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<
					typeof deps.exportMutations.Query.getSupportedExportFormats
				>[1]
			>(deps.exportMutations.Query, "getSupportedExportFormats", _, args),
		validateExportOptions: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolver<
				Parameters<typeof deps.exportMutations.Query.validateExportOptions>[1]
			>(deps.exportMutations.Query, "validateExportOptions", _, args, context),
		getExportHistory: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolver<
				Parameters<typeof deps.exportMutations.Query.getExportHistory>[1]
			>(deps.exportMutations.Query, "getExportHistory", _, args, context),

		// JSON Export queries
		exportTableJson: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.jsonExportQueries) {
				throw new Error("JsonExportQueries not available");
			}
			const { JsonExportQueries, jsonExportService, logger } =
				deps.jsonExportQueries;
			return callRootResolver<
				{ tableId: string; options?: Record<string, unknown> },
				unknown,
				{ jsonExportService: JsonExportService; logger: ILogger }
			>(
				JsonExportQueries,
				"exportTableJson",
				_,
				args,
				{ jsonExportService, logger },
				info,
			);
		},

		// JSONL Backup queries
		inspectJsonlBackup: (_: GraphQLParent, args: Record<string, unknown>) =>
			deps.jsonlBackupQueries?.inspectJsonlBackup(
				_,
				args as { inputDir: string },
			) || null,

		// SQLite Backup queries
		listBackups: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.backupQueries) {
				throw new Error("BackupQueries not available");
			}
			const { BackupQueries, backupService, logger } = deps.backupQueries;
			return callRootResolver<
				{
					filter?: {
						type?: "FILE" | "TABLE" | "ALL";
						createdAfter?: string;
						createdBefore?: string;
					};
				},
				unknown,
				{ backupService: SQLiteBackupService; logger: ILogger }
			>(BackupQueries, "listBackups", _, args, { backupService, logger }, info);
		},
		backupMetrics: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.backupQueries) {
				throw new Error("BackupQueries not available");
			}
			const { BackupQueries, backupService, logger } = deps.backupQueries;
			return callRootResolver<
				RootResolverArgs,
				unknown,
				{ backupService: SQLiteBackupService; logger: ILogger }
			>(
				BackupQueries,
				"backupMetrics",
				_,
				args,
				{ backupService, logger },
				info,
			);
		},
	},

	Mutation: {
		_schema: () => null, // Required placeholder

		// Table mutations
		createTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TableMutations["createTable"]>[1]
			>(
				deps.tableResolver,
				"createTable",
				deps.tableMutations,
				"createTable",
				_,
				args,
			),
		batchCreateTables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<TableMutations["batchCreateTables"]>[1]>(
				deps.tableMutations,
				"batchCreateTables",
				_,
				args,
			),
		updateTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TableMutations["updateTable"]>[1]
			>(
				deps.tableResolver,
				"updateTable",
				deps.tableMutations,
				"updateTable",
				_,
				args,
			),
		batchDeleteTables: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<TableMutations["batchDeleteTables"]>[1]>(
				deps.tableMutations,
				"batchDeleteTables",
				_,
				args,
			),
		deleteTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TableMutations["deleteTable"]>[1]
			>(
				deps.tableResolver,
				"deleteTable",
				deps.tableMutations,
				"deleteTable",
				_,
				args,
			),

		// Attribute type mutations
		createAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["createAttributeType"]>[1]
			>(
				deps.attributeResolver,
				"createAttributeType",
				deps.attributeMutations,
				"createAttributeType",
				_,
				args,
			),
		updateAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["updateAttributeType"]>[1]
			>(
				deps.attributeResolver,
				"updateAttributeType",
				deps.attributeMutations,
				"updateAttributeType",
				_,
				args,
			),
		deleteAttributeType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["deleteAttributeType"]>[1]
			>(
				deps.attributeResolver,
				"deleteAttributeType",
				deps.attributeMutations,
				"deleteAttributeType",
				_,
				args,
			),

		// Attribute mutations
		createAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["createAttribute"]>[1]
			>(
				deps.attributeResolver,
				"createAttribute",
				deps.attributeMutations,
				"createAttribute",
				_,
				args,
			),
		batchCreateAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<AttributeMutations["batchCreateAttributes"]>[1]
			>(deps.attributeMutations, "batchCreateAttributes", _, args),
		updateAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["updateAttribute"]>[1]
			>(
				deps.attributeResolver,
				"updateAttribute",
				deps.attributeMutations,
				"updateAttribute",
				_,
				args,
			),
		deleteAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<AttributeMutations["deleteAttribute"]>[1]
			>(
				deps.attributeResolver,
				"deleteAttribute",
				deps.attributeMutations,
				"deleteAttribute",
				_,
				args,
			),

		// Node mutations
		createNode: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<NodeMutations["createNode"]>[1]>(
				deps.nodeResolver,
				"createNode",
				deps.nodeMutations,
				"createNode",
				_,
				args,
			),
		batchCreateNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<NodeMutations["batchCreateNodes"]>[1]>(
				deps.nodeMutations,
				"batchCreateNodes",
				_,
				args,
			),
		batchCreateNodesTransactional: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<NodeMutations["batchCreateNodesTransactional"]>[1]
			>(deps.nodeMutations, "batchCreateNodesTransactional", _, args),
		batchCreateNodesWithProgress: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<NodeMutations["batchCreateNodesWithProgress"]>[1]
			>(deps.nodeMutations, "batchCreateNodesWithProgress", _, args),
		batchUpdateNodes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<NodeMutations["batchUpdateNodes"]>[1]>(
				deps.nodeMutations,
				"batchUpdateNodes",
				_,
				args,
			),
		updateNode: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<NodeMutations["updateNode"]>[1]>(
				deps.nodeResolver,
				"updateNode",
				deps.nodeMutations,
				"updateNode",
				_,
				args,
			),
		deleteNode: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<NodeMutations["deleteNode"]>[1]>(
				deps.nodeResolver,
				"deleteNode",
				deps.nodeMutations,
				"deleteNode",
				_,
				args,
			),
		setNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["setNodeAttribute"]>[1]
			>(
				deps.nodeResolver,
				"setNodeAttribute",
				deps.nodeMutations,
				"setNodeAttribute",
				_,
				args,
			),
		removeNodeAttribute: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["removeNodeAttribute"]>[1]
			>(
				deps.nodeResolver,
				"removeNodeAttribute",
				deps.nodeMutations,
				"removeNodeAttribute",
				_,
				args,
			),
		updateNodeAttributeValue: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["updateNodeAttributeValue"]>[1]
			>(
				deps.nodeResolver,
				"updateNodeAttributeValue",
				deps.nodeMutations,
				"updateNodeAttributeValue",
				_,
				args,
			),
		createNodeWithAttributes: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["createNodeWithAttributes"]>[1]
			>(
				deps.nodeResolver,
				"createNodeWithAttributes",
				deps.nodeMutations,
				"createNodeWithAttributes",
				_,
				args,
			),
		createPersonNode: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["createPersonNode"]>[1]
			>(
				deps.nodeResolver,
				"createPersonNode",
				deps.nodeMutations,
				"createPersonNode",
				_,
				args,
			),
		setNodeAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["setNodeAttributes"]>[1]
			>(
				deps.nodeResolver,
				"setNodeAttributes",
				deps.nodeMutations,
				"setNodeAttributes",
				_,
				args,
			),
		setNodeAttributesByIdentifier: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolverWithFallback<
				Parameters<NodeMutations["setNodeAttributesByIdentifier"]>[1]
			>(
				deps.nodeResolver,
				"setNodeAttributesByIdentifier",
				deps.nodeMutations,
				"setNodeAttributesByIdentifier",
				_,
				args,
			),
		batchSetNodeAttributes: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<Parameters<NodeMutations["batchSetNodeAttributes"]>[1]>(
				deps.nodeMutations,
				"batchSetNodeAttributes",
				_,
				args,
			),
		batchOperationWithRollback: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<NodeMutations["batchOperationWithRollback"]>[1]
			>(deps.nodeMutations, "batchOperationWithRollback", _, args),

		// Relation mutations
		createRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<RelationMutations["createRelationType"]>[1]
			>(
				deps.relationResolver,
				"createRelationType",
				deps.relationMutations,
				"createRelationType",
				_,
				args,
			),
		updateRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<RelationMutations["updateRelationType"]>[1]
			>(
				deps.relationResolver,
				"updateRelationType",
				deps.relationMutations,
				"updateRelationType",
				_,
				args,
			),
		deleteRelationType: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<RelationMutations["deleteRelationType"]>[1]
			>(
				deps.relationResolver,
				"deleteRelationType",
				deps.relationMutations,
				"deleteRelationType",
				_,
				args,
			),
		createRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<RelationMutations["createRelation"]>[1]
			>(
				deps.relationResolver,
				"createRelation",
				deps.relationMutations,
				"createRelation",
				_,
				args,
			),
		batchCreateRelations: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<RelationMutations["batchCreateRelations"]>[1]
			>(deps.relationMutations, "batchCreateRelations", _, args),
		deleteRelation: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<RelationMutations["deleteRelation"]>[1]
			>(
				deps.relationResolver,
				"deleteRelation",
				deps.relationMutations,
				"deleteRelation",
				_,
				args,
			),

		// Template mutations
		createTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["createTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"createTemplate",
				deps.templateMutations,
				"createTemplate",
				_,
				args,
			),
		updateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["updateTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"updateTemplate",
				deps.templateMutations,
				"updateTemplate",
				_,
				args,
			),
		updateTemplateQuery: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["updateTemplateQuery"]>[1]
			>(
				deps.queryTemplateResolver,
				"updateTemplateQuery",
				deps.templateMutations,
				"updateTemplateQuery",
				_,
				args,
			),
		deleteTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["deleteTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"deleteTemplate",
				deps.templateMutations,
				"deleteTemplate",
				_,
				args,
			),
		activateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["activateTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"activateTemplate",
				deps.templateMutations,
				"activateTemplate",
				_,
				args,
			),
		deactivateTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["deactivateTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"deactivateTemplate",
				deps.templateMutations,
				"deactivateTemplate",
				_,
				args,
			),
		executeTemplate: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["executeTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"executeTemplate",
				deps.templateMutations,
				"executeTemplate",
				_,
				args,
			),
		executeTemplateWithGraphQL: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["executeTemplateWithGraphQL"]>[1]
			>(
				deps.queryTemplateResolver,
				"executeTemplateWithGraphQL",
				deps.templateMutations,
				"executeTemplateWithGraphQL",
				_,
				args,
				context,
			),
		exportTemplate: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["exportTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"exportTemplate",
				deps.templateMutations,
				"exportTemplate",
				_,
				args,
				context,
			),
		exportTemplates: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["exportTemplates"]>[1]
			>(
				deps.queryTemplateResolver,
				"exportTemplates",
				deps.templateMutations,
				"exportTemplates",
				_,
				args,
				context,
			),
		importTemplate: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolverWithFallback<
				Parameters<TemplateMutations["importTemplate"]>[1]
			>(
				deps.queryTemplateResolver,
				"importTemplate",
				deps.templateMutations,
				"importTemplate",
				_,
				args,
				context,
			),

		// Doc mutations
		createDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocMutations["createDoc"]>[1]>(
				deps.docResolver,
				"createDoc",
				deps.docMutations,
				"createDoc",
				_,
				args,
			),
		updateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocMutations["updateDoc"]>[1]>(
				deps.docResolver,
				"updateDoc",
				deps.docMutations,
				"updateDoc",
				_,
				args,
			),
		deleteDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocMutations["deleteDoc"]>[1]>(
				deps.docResolver,
				"deleteDoc",
				deps.docMutations,
				"deleteDoc",
				_,
				args,
			),
		activateDoc: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<Parameters<DocMutations["activateDoc"]>[1]>(
				deps.docResolver,
				"activateDoc",
				deps.docMutations,
				"activateDoc",
				_,
				args,
			),
		createDocVersion: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolverWithFallback<
				Parameters<DocMutations["createDocVersion"]>[1]
			>(
				deps.docResolver,
				"createDocVersion",
				deps.docMutations,
				"createDocVersion",
				_,
				args,
			),

		// System initialization mutations
		initializeSystem: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<{ input: RootResolverArgs }>(
				deps.systemResolver,
				"initializeSystem",
				_,
				args,
			) || null,
		saveTabularSyncConfig: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<{
				input: {
					configKey: string;
					config: Record<string, unknown>;
					active?: boolean;
				};
			}>(deps.systemResolver, "saveTabularSyncConfig", _, args) || null,
		activateTabularSyncConfig: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<{ configKey: string }>(
				deps.systemResolver,
				"activateTabularSyncConfig",
				_,
				args,
			) || null,
		resyncTabularSyncTable: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<{ tableIdentifier: string }>(
				deps.systemResolver,
				"resyncTabularSyncTable",
				_,
				args,
			) || null,

		// Schema import mutations
		importSchema: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<typeof deps.schemaResolvers.Mutation.importSchema>[1]
			>(deps.schemaResolvers.Mutation, "importSchema", _, args),

		// Table Package mutations
		exportTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<TablePackageResolver["exportTablePackage"]>[1]
			>(deps.tablePackageResolver, "exportTablePackage", _, args),
		importTablePackage: (_: GraphQLParent, args: Record<string, unknown>) =>
			callRootResolver<
				Parameters<TablePackageResolver["importTablePackage"]>[1]
			>(deps.tablePackageResolver, "importTablePackage", _, args),
		batchImportTablePackages: (
			_: GraphQLParent,
			args: Record<string, unknown>,
		) =>
			callRootResolver<
				Parameters<TablePackageResolver["batchImportTablePackages"]>[1]
			>(deps.tablePackageResolver, "batchImportTablePackages", _, args),

		// Export mutations
		exportTableNodes: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolver<
				Parameters<typeof deps.exportMutations.Mutation.exportTableNodes>[1]
			>(deps.exportMutations.Mutation, "exportTableNodes", _, args, context),
		exportMultipleTables: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) =>
			callRootResolver<
				Parameters<typeof deps.exportMutations.Mutation.exportMultipleTables>[1]
			>(
				deps.exportMutations.Mutation,
				"exportMultipleTables",
				_,
				args,
				context,
			),

		// JSONL Backup mutations
		exportJsonl: async (_: GraphQLParent, args: Record<string, unknown>) => {
			if (!deps.jsonlBackupQueries) {
				throw new Error("JSONL backup service not available");
			}
			return deps.jsonlBackupQueries.exportJsonl(_, args);
		},
		importJsonl: async (_: GraphQLParent, args: Record<string, unknown>) => {
			if (!deps.jsonlBackupQueries) {
				throw new Error("JSONL backup service not available");
			}
			return deps.jsonlBackupQueries.importJsonl(
				_,
				args as {
					input: {
						inputDir: string;
						tableIdentifiers?: string[];
						conflictResolution: "SKIP" | "OVERWRITE" | "MERGE";
						validateSchema?: boolean;
						dryRun?: boolean;
					};
				},
			);
		},

		// SQLite Backup mutations
		backupDatabase: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.backupMutations) {
				throw new Error("BackupMutations not available");
			}
			const { BackupMutations, backupService, logger } = deps.backupMutations;
			return callRootResolver<
				{ input?: Record<string, unknown> },
				unknown,
				{ backupService: SQLiteBackupService; logger: ILogger }
			>(
				BackupMutations,
				"backupDatabase",
				_,
				args,
				{ backupService, logger },
				info,
			);
		},
		restoreDatabase: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.backupMutations) {
				throw new Error("BackupMutations not available");
			}
			const { BackupMutations, backupService, logger } = deps.backupMutations;
			return callRootResolver<
				{
					input: import("@/core/types/DatabaseBackup.js").SQLiteRestoreOptions;
				},
				unknown,
				{ backupService: SQLiteBackupService; logger: ILogger }
			>(
				BackupMutations,
				"restoreDatabase",
				_,
				args,
				{ backupService, logger },
				info,
			);
		},
		applyRetentionPolicy: (
			_: GraphQLParent,
			args: Record<string, unknown>,
			_context: GraphQLContext,
			info: GraphQLResolveInfo,
		) => {
			if (!deps.backupMutations) {
				throw new Error("BackupMutations not available");
			}
			const { BackupMutations, backupService, logger } = deps.backupMutations;
			return callRootResolver<
				{
					policy: import("@/core/types/DatabaseBackup.js").BackupRetentionPolicy;
				},
				unknown,
				{ backupService: SQLiteBackupService; logger: ILogger }
			>(
				BackupMutations,
				"applyRetentionPolicy",
				_,
				args,
				{ backupService, logger },
				info,
			);
		},
	},
});
