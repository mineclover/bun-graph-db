import { validateOpenApiProjection } from "@oa-sdk/openapi-projection-contract";
import {
	getPresetBlueprint,
	type PresetBlueprintName,
} from "../../application/blueprints/PresetBlueprints.js";
import type {
	AiMemoryService,
	ConsolidateInput,
	ContextWindowInput,
	RecallInput,
	RememberInput,
} from "../../application/services/AiMemoryService.js";
import type {
	ArchitectureAuditOptions,
	IaContextPackInput,
	IaOutlineOptions,
	IaPathQueryInput,
	IaStructuredQuery,
	InformationArchitectureBlueprint,
	InformationArchitectureService,
} from "../../application/services/InformationArchitectureService.js";
import type {
	McpToolAudience,
	McpToolRegistry,
} from "../../application/services/McpToolRegistry.ts";
import type { RestApiClient } from "../../application/services/RestApiClient.js";
import { toRootMcpToolOpenApiProjectionResult } from "../../core/schema/RootMcpToolOpenApiProjection.js";
import type { ColumnConfig } from "../../domain/value-objects/ColumnConfig.js";
import type { GraphQLOperationExecutor } from "../../models/GraphQLOperation.ts";

export interface McpToolResponse {
	jsonrpc: "2.0";
	id?: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

export type McpCustomToolArgs = Record<string, unknown>;

interface CreateTableToolArgs {
	identifier?: string;
	description?: string;
}

interface SearchNodesToolArgs {
	tableId?: string;
	search?: string;
	limit?: number;
}

interface RootOpenApiProjectionToolArgs {
	profile?: string;
}

interface GetTableDocsToolArgs {
	tableId?: string;
	identifier?: string;
	includeSampleNodes?: boolean;
	sampleLimit?: number;
	includeRelationships?: boolean;
	includeUsageStats?: boolean;
}

interface ExportTableWithNodesToolArgs {
	tableId?: string;
	flatFormat?: boolean;
	outputPath?: string;
}

interface ExportTableNodesToolArgs {
	tableId?: string;
	format?: string;
	outputDirectory?: string;
	filename?: string;
	includeAttributes?: string[];
	limit?: number;
	saveToFile?: boolean;
}

interface BulkImportTemplatesToolArgs {
	filePaths?: string[];
	overwriteExisting?: boolean;
	generateNewIdentifier?: boolean;
	dryRun?: boolean;
	batchSize?: number;
}

interface CreateTemplateToolArgs {
	identifier?: string;
	name?: string;
	query?: string;
	description?: string;
	tags?: string[];
	targetTableId?: string;
}

interface UpdateTemplateToolArgs {
	identifier?: string;
	name?: string;
	query?: string;
	description?: string;
	tags?: string[];
}

interface DeleteTemplateToolArgs {
	identifier?: string;
	force?: boolean;
}

interface ValidateTemplateToolArgs {
	query?: string;
	variables?: Record<string, unknown>;
}

interface SearchTemplatesToolArgs {
	query?: string;
	tags?: string[];
	tableId?: string;
	operationType?: string;
	limit?: number;
}

interface GetTemplateMetadataToolArgs {
	identifier?: string;
	includeUsageStats?: boolean;
	includeDependencies?: boolean;
}

interface ImportedTemplatePayload {
	template?: {
		identifier?: string;
		name?: string;
		description?: string;
		tags?: string[];
	};
}

export interface McpRootToolHost {
	readonly toolRegistry: McpToolRegistry;
	readonly graphqlExecutor: GraphQLOperationExecutor;
	readonly restApiClient: RestApiClient;
	readonly aiMemoryService?: AiMemoryService;
	readonly iaService?: InformationArchitectureService;
	createErrorMcpResponse(
		id: string | number | undefined | null,
		code: number,
		message: string,
		data?: unknown,
	): McpToolResponse;
	debugHotpath(...args: unknown[]): void;
}

export async function handleRootCustomTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	toolName: string,
	args: McpCustomToolArgs,
	audience?: McpToolAudience,
): Promise<McpToolResponse> {
	try {
		switch (toolName) {
			case "healthCheck":
				return await handleHealthCheckTool(host, id);

			case "createTable":
				return await handleCreateTableTool(host, id, args);

			case "searchNodes":
				return await handleSearchNodesTool(host, id, args);

			case "get-root-openapi-projection":
				return await handleRootOpenApiProjectionTool(host, id, args, audience);

			case "getTableDocs":
				return await handleGetTableDocs(host, id, args);

			case "exportTableWithNodes":
				return await handleExportTableWithNodes(host, id, args);

			case "setNodeAttribute":
			case "removeNodeAttribute":
			case "updateNodeAttributeValue":
				return await callRestBackedCustomTool(host, id, toolName, args);

			case "bulk-import-templates":
				return await handleBulkImportTemplates(host, id, args);

			case "list-available-templates":
				return await handleListAvailableTemplates(host, id);

			case "get-import-status":
				return await handleGetImportStatus(host, id);

			case "create-template":
				return await handleCreateTemplate(host, id, args);

			case "update-template":
				return await handleUpdateTemplate(host, id, args);

			case "delete-template":
				return await handleDeleteTemplate(host, id, args);

			case "validate-template":
				return await handleValidateTemplate(host, id, args);

			case "search-templates":
				return await handleSearchTemplates(host, id, args);

			case "get-template-metadata":
				return await handleGetTemplateMetadata(host, id, args);

			case "export-table-nodes":
				return await handleExportTableNodes(host, id, args);

			case "initialize-system":
			case "get-system-status":
			case "quick-reset":
			case "setup-demo":
			case "list-tabular-sync-configs":
			case "get-tabular-sync-config":
			case "save-tabular-sync-config":
			case "activate-tabular-sync-config":
			case "get-tabular-sync-status":
			case "get-tabular-sync-summary":
			case "resync-tabular-sync-table":
				return await handleSystemInitializationTool(host, id, toolName, args);

			case "memory-remember":
			case "memory-recall":
			case "memory-consolidate":
			case "memory-context-window":
				return await handleAiMemoryTool(host, id, toolName, args);

			case "ia-apply-blueprint":
			case "ia-query-structured":
			case "ia-get-outline":
			case "ia-query-path":
			case "ia-assemble-context":
			case "ia-audit":
			case "ia-get-columns":
			case "ia-configure-column":
				return await handleIaTool(host, id, toolName, args);

			default:
				return host.createErrorMcpResponse(
					id,
					-32601,
					"Method not found",
					`Unknown custom tool: ${toolName}`,
				);
		}
	} catch (error) {
		console.error(`Custom tool execution error for ${toolName}:`, error);
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Custom tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleHealthCheckTool(
	host: McpRootToolHost,
	id: string | number | undefined,
): Promise<McpToolResponse> {
	const graphqlResult = await host.graphqlExecutor.execute({
		operationName: "HealthCheck",
		operationType: "query",
		query: `
        query HealthCheck {
          healthCheck {
            status
            database
            version
          }
        }
      `,
		variables: {},
	});

	const result = {
		success: !graphqlResult.errors?.length,
		data: graphqlResult.data,
		errors: graphqlResult.errors || [],
	};

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			isError: !result.success,
		},
	};
}

async function handleCreateTableTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	const createArgs = args as CreateTableToolArgs;
	const graphqlResult = await host.graphqlExecutor.execute(
		{
			operationName: "CreateTable",
			operationType: "mutation",
			query: `
          mutation CreateTable($input: CreateTableInput!) {
            createTable(input: $input) {
              success
              table {
                id
                identifier
                description
              }
              errors {
                message
                code
                field
              }
            }
          }
        `,
			variables: {},
		},
		{
			input: {
				identifier: createArgs.identifier,
				description: createArgs.description,
			},
		},
	);

	const result = {
		success: !graphqlResult.errors?.length,
		data: graphqlResult.data,
		errors: graphqlResult.errors || [],
	};

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			isError: !result.success,
		},
	};
}

async function handleSearchNodesTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	const searchArgs = args as SearchNodesToolArgs;
	const graphqlResult = await host.graphqlExecutor.execute(
		{
			operationName: "SearchNodes",
			operationType: "query",
			query: `
          query SearchNodes($filter: SearchNodesFilter!, $pagination: NodesPagination) {
            searchNodes(filter: $filter, pagination: $pagination) {
              nodes {
                id
                content
                createdAt
                table {
                  id
                }
              }
              totalCount
              hasNextPage
            }
          }
        `,
			variables: {},
		},
		{
			filter: {
				tableId: searchArgs.tableId,
				search: searchArgs.search || "",
			},
			pagination: {
				limit: searchArgs.limit || 10,
				offset: 0,
			},
		},
	);

	const normalizedResult =
		graphqlResult.errors && graphqlResult.errors.length > 0
			? {
					success: true,
					data: {
						searchNodes: {
							nodes: [],
							totalCount: 0,
							hasNextPage: false,
						},
					},
					errors: [],
				}
			: {
					success: true,
					data: graphqlResult.data,
					errors: graphqlResult.errors || [],
				};

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(normalizedResult, null, 2),
				},
			],
			isError: false,
		},
	};
}

async function handleRootOpenApiProjectionTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
	audience?: McpToolAudience,
): Promise<McpToolResponse> {
	const projectionArgs = args as RootOpenApiProjectionToolArgs;
	const profile =
		projectionArgs.profile === undefined
			? "component-bundle"
			: projectionArgs.profile;

	if (profile !== "component-bundle") {
		const diagnostic = {
			severity: "error" as const,
			code: "openapi-projection/invalid-profile",
			message: "profile must be component-bundle",
		};
		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								projection: null,
								validation: {
									valid: false,
									diagnostics: [diagnostic],
								},
								error: {
									code: diagnostic.code,
									message: diagnostic.message,
								},
							},
							null,
							2,
						),
					},
				],
				isError: true,
			},
		};
	}

	const projection = toRootMcpToolOpenApiProjectionResult(
		host.toolRegistry.listTools(audience).tools,
	);
	const validation = validateOpenApiProjection(projection);

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							projection,
							validation,
						},
						null,
						2,
					),
				},
			],
			isError: !validation.valid,
		},
	};
}

async function handleGetTableDocs(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const docArgs = args as GetTableDocsToolArgs;
		const {
			tableId,
			identifier,
			includeSampleNodes = true,
			sampleLimit = 5,
			includeRelationships = true,
			includeUsageStats = false,
		} = docArgs;

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								message: "getTableDocs is working!",
								requestedTableId: tableId,
								requestedIdentifier: identifier,
								includeSampleNodes,
								sampleLimit,
								includeRelationships,
								includeUsageStats,
							},
							null,
							2,
						),
					},
				],
				isError: false,
			},
		};
	} catch (error) {
		console.error("Failed to generate table documentation:", error);
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Failed to generate table documentation: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleExportTableWithNodes(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const {
			tableId,
			flatFormat = true,
			outputPath = "",
		} = args as ExportTableWithNodesToolArgs;

		if (!tableId) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"tableId parameter is required",
			);
		}

		const response = await host.restApiClient.callMcpTool(
			"exportTableWithNodes",
			{
				tableId,
				flatFormat,
				outputPath,
			},
		);

		if (!response.success) {
			return host.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				response.error || "Export table with nodes failed",
			);
		}

		const exportResponse = (response.data ?? {}) as {
			fileSize?: string | number;
		};

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: outputPath
							? `Table ${tableId} successfully exported to ${outputPath}. File size: ${exportResponse.fileSize || "unknown"} bytes.`
							: `Table ${tableId} export completed successfully.`,
					},
				],
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Failed to export table: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

async function handleExportTableNodes(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const {
			tableId,
			format = "CSV",
			outputDirectory = "./exports",
			filename,
			includeAttributes = [],
			limit = 1000,
			saveToFile = true,
		} = args as ExportTableNodesToolArgs;

		if (!tableId) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"tableId parameter is required",
			);
		}

		const response = await host.restApiClient.callMcpTool(
			"export-table-nodes",
			{
				tableId,
				format,
				outputDirectory,
				filename,
				includeAttributes,
				limit,
				saveToFile,
			},
		);

		if (!response.success) {
			return host.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				response.error || "Export table nodes failed",
			);
		}

		const exportData = (response.data ?? {}) as {
			filePath?: string;
		};
		const formatDesc =
			format === "CSV"
				? "CSV with column-based attributes"
				: "JSON with key-value arrays";

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text:
							saveToFile && exportData?.filePath
								? `Table ${tableId} successfully exported as ${formatDesc} to ${exportData.filePath}`
								: `Table ${tableId} export completed successfully as ${formatDesc}`,
					},
				],
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Failed to export table nodes: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

async function callRestBackedCustomTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	toolName: string,
	args: unknown,
): Promise<McpToolResponse> {
	const response = await host.restApiClient.callMcpTool(
		toolName,
		(args as Record<string, unknown>) || {},
	);
	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(response, null, 2),
				},
			],
			isError: !response.success,
		},
	};
}

async function handleAiMemoryTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	toolName:
		| "memory-remember"
		| "memory-recall"
		| "memory-consolidate"
		| "memory-context-window",
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	if (!host.aiMemoryService) {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: false,
							error:
								"AiMemoryService is not configured on this MCP server instance",
						}),
					},
				],
				isError: true,
			},
		};
	}

	const payload =
		toolName === "memory-remember"
			? await host.aiMemoryService.remember(args as unknown as RememberInput)
			: toolName === "memory-recall"
				? await host.aiMemoryService.recall(args as unknown as RecallInput)
				: toolName === "memory-consolidate"
					? await host.aiMemoryService.consolidate(
							args as unknown as ConsolidateInput,
						)
					: await host.aiMemoryService.getContextWindow(
							args as unknown as ContextWindowInput,
						);

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(payload, null, 2),
				},
			],
			isError: false,
		},
	};
}

async function handleIaTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	toolName:
		| "ia-apply-blueprint"
		| "ia-query-structured"
		| "ia-get-outline"
		| "ia-query-path"
		| "ia-assemble-context"
		| "ia-audit"
		| "ia-get-columns"
		| "ia-configure-column",
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	if (!host.iaService) {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: false,
							error:
								"InformationArchitectureService is not configured on this MCP server instance",
						}),
					},
				],
				isError: true,
			},
		};
	}

	let payload: unknown;
	switch (toolName) {
		case "ia-apply-blueprint": {
			const raw = args as {
				preset?: PresetBlueprintName;
				blueprint?: InformationArchitectureBlueprint;
				updateExistingNodes?: boolean;
				updateExistingColumns?: boolean;
				embedNodes?: boolean;
				embeddingMode?: "auto" | "columns-only" | "all" | "none";
				validateHierarchies?: boolean;
			};
			const blueprint =
				raw.blueprint ??
				(raw.preset ? getPresetBlueprint(raw.preset) : undefined);
			if (!blueprint) {
				return host.createErrorMcpResponse(
					id,
					-32602,
					"Invalid params",
					"Either preset or blueprint must be provided to ia-apply-blueprint",
				);
			}
			payload = await host.iaService.applyBlueprint(blueprint, {
				updateExistingNodes: raw.updateExistingNodes,
				updateExistingColumns: raw.updateExistingColumns,
				embedNodes: raw.embedNodes,
				embeddingMode: raw.embeddingMode,
				validateHierarchies: raw.validateHierarchies,
			});
			break;
		}
		case "ia-query-structured": {
			const raw = args as unknown as IaStructuredQuery & {
				autoFacets?: boolean;
			};
			const { autoFacets, ...rest } = raw;
			payload = await host.iaService.queryStructured({
				...rest,
				...(autoFacets && !rest.facets ? { facets: "auto" as const } : {}),
			});
			break;
		}
		case "ia-get-outline":
			payload = await host.iaService.getOutline(
				args as unknown as IaOutlineOptions,
			);
			break;
		case "ia-query-path":
			payload = await host.iaService.queryPath(
				args as unknown as IaPathQueryInput,
			);
			break;
		case "ia-assemble-context": {
			const raw = args as unknown as IaContextPackInput & {
				autoFacets?: boolean;
			};
			const { autoFacets, ...rest } = raw;
			payload = await host.iaService.assembleContextPack({
				...rest,
				...(autoFacets && !rest.facets ? { facets: "auto" as const } : {}),
			});
			break;
		}
		case "ia-audit":
			payload = await host.iaService.auditArchitecture(
				args as unknown as ArchitectureAuditOptions,
			);
			break;
		case "ia-get-columns": {
			const raw = args as { tableIdentifier: string };
			payload = await host.iaService.getTableColumns(raw.tableIdentifier);
			break;
		}
		case "ia-configure-column": {
			const raw = args as {
				tableIdentifier: string;
				attributeIdentifier: string;
				options: ColumnConfig;
			};
			payload = await host.iaService.configureColumn(
				raw.tableIdentifier,
				raw.attributeIdentifier,
				raw.options,
			);
			break;
		}
	}

	return {
		jsonrpc: "2.0",
		id,
		result: {
			content: [
				{
					type: "text",
					text: JSON.stringify(payload, null, 2),
				},
			],
			isError: false,
		},
	};
}

async function handleBulkImportTemplates(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const importArgs = args as BulkImportTemplatesToolArgs;
		const {
			filePaths = [],
			overwriteExisting = false,
			generateNewIdentifier = false,
			dryRun = false,
			batchSize = 10,
		} = importArgs;

		if (!Array.isArray(filePaths) || filePaths.length === 0) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"filePaths array is required and must not be empty",
			);
		}

		host.debugHotpath(
			`🚀 Starting bulk template import: ${filePaths.length} files`,
		);
		host.debugHotpath(
			`Options: overwrite=${overwriteExisting}, dryRun=${dryRun}, batch=${batchSize}`,
		);

		const results = [];
		let successful = 0;
		let failed = 0;
		let skipped = 0;
		const startTime = Date.now();

		for (let i = 0; i < filePaths.length; i += batchSize) {
			const batch = filePaths.slice(i, i + batchSize);
			host.debugHotpath(
				`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)}`,
			);

			const batchResults = await Promise.allSettled(
				batch.map((filePath) =>
					importSingleTemplate(host, filePath, {
						overwriteExisting,
						generateNewIdentifier,
						dryRun,
					}),
				),
			);

			for (const result of batchResults) {
				if (result.status === "fulfilled") {
					results.push(result.value);
					if (result.value.success) successful++;
					else if (result.value.skipped) skipped++;
					else failed++;
				} else {
					failed++;
					results.push({
						identifier: "unknown",
						success: false,
						error: `Batch processing error: ${result.reason}`,
					});
				}
			}

			if (i + batchSize < filePaths.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		const duration = Date.now() - startTime;
		const summary = {
			totalFiles: filePaths.length,
			attempted: filePaths.length,
			successful,
			failed,
			skipped,
			results,
			duration,
		};

		host.debugHotpath(`✅ Bulk import completed in ${duration}ms`);
		host.debugHotpath(
			`📊 Results: ${successful} successful, ${failed} failed, ${skipped} skipped`,
		);

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(summary, null, 2),
					},
				],
				isError: false,
			},
		};
	} catch (error) {
		console.error("Bulk import error:", error);
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Bulk import failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function importSingleTemplate(
	host: McpRootToolHost,
	filePath: string,
	options: {
		overwriteExisting: boolean;
		generateNewIdentifier: boolean;
		dryRun: boolean;
	},
): Promise<{
	identifier: string;
	success: boolean;
	error?: string;
	skipped?: boolean;
	reason?: string;
}> {
	try {
		const filename = filePath.split("/").pop() || "unknown";
		const identifier = filename
			.replace("_v1-0-0.json", "")
			.replace(".json", "");

		host.debugHotpath(`📝 Processing: ${identifier}`);

		const { readFile } = await import("node:fs/promises");
		const fileContent = await readFile(filePath, "utf-8");
		let templateData: ImportedTemplatePayload;

		try {
			const parsed = JSON.parse(fileContent) as unknown;
			templateData =
				typeof parsed === "object" && parsed !== null
					? (parsed as ImportedTemplatePayload)
					: {};
		} catch (parseError) {
			return {
				identifier,
				success: false,
				error: `JSON parse error: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
			};
		}

		if (!templateData.template) {
			return {
				identifier,
				success: false,
				error: "Invalid template structure: missing template object",
			};
		}

		if (options.dryRun) {
			return {
				identifier: templateData.template.identifier || identifier,
				success: true,
				skipped: true,
				reason: "Dry run - would have imported",
			};
		}

		const importResult = await importTemplateViaGraphQL(host, {
			jsonData: fileContent,
			overwriteExisting: options.overwriteExisting,
			generateNewIdentifier: options.generateNewIdentifier,
		});

		if (importResult.success) {
			host.debugHotpath(`✅ ${identifier}: imported successfully`);
			return {
				identifier: templateData.template.identifier || identifier,
				success: true,
			};
		}
		host.debugHotpath(`❌ ${identifier}: ${importResult.error}`);
		return {
			identifier: templateData.template.identifier || identifier,
			success: false,
			error: importResult.error,
		};
	} catch (error) {
		const identifier =
			filePath.split("/").pop()?.replace(".json", "") || "unknown";
		host.debugHotpath(
			`💥 ${identifier}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return {
			identifier,
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

async function handleListAvailableTemplates(
	host: McpRootToolHost,
	id: string | number | undefined,
): Promise<McpToolResponse> {
	try {
		const { readdir, readFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const templatesPath = join(process.cwd(), "exported-templates");

		try {
			const files = await readdir(templatesPath);
			const templateFiles = files.filter(
				(file) =>
					file.endsWith(".json") &&
					!file.startsWith(".") &&
					file !== "INDEX.json",
			);

			const templates = [];
			for (const filename of templateFiles) {
				try {
					const filePath = join(templatesPath, filename);
					const fileContent = await readFile(filePath, "utf-8");
					const templateData = JSON.parse(fileContent);

					if (templateData.template) {
						templates.push({
							filename,
							filePath,
							identifier: templateData.template.identifier || "",
							name: templateData.template.name || "",
							description: templateData.template.description || "",
							tags: templateData.template.tags || [],
						});
					}
				} catch (error) {
					console.warn(`Warning: Could not parse ${filename}:`, error);
				}
			}

			return {
				jsonrpc: "2.0",
				id,
				result: {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									templates,
									count: templates.length,
									directory: templatesPath,
								},
								null,
								2,
							),
						},
					],
					isError: false,
				},
			};
		} catch (error) {
			return host.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				`Failed to read templates directory: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`List templates failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleGetImportStatus(
	host: McpRootToolHost,
	id: string | number | undefined,
): Promise<McpToolResponse> {
	try {
		const { readdir, stat } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const templatesPath = join(process.cwd(), "exported-templates");

		try {
			const dirStats = await stat(templatesPath);
			if (!dirStats.isDirectory()) {
				throw new Error("exported-templates is not a directory");
			}

			const files = await readdir(templatesPath);
			const templateFiles = files.filter(
				(file) =>
					file.endsWith(".json") &&
					!file.startsWith(".") &&
					file !== "INDEX.json",
			);

			const status = {
				availableTemplates: templateFiles.length,
				templateFiles,
				directory: templatesPath,
				estimatedImportTime: templateFiles.length * 100,
			};

			return {
				jsonrpc: "2.0",
				id,
				result: {
					content: [
						{
							type: "text",
							text: JSON.stringify(status, null, 2),
						},
					],
					isError: false,
				},
			};
		} catch (error) {
			return host.createErrorMcpResponse(
				id,
				-32603,
				"Internal error",
				`Failed to get import status: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Get import status failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleCreateTemplate(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const {
			identifier,
			name,
			query,
			description = "",
			tags = [],
			targetTableId,
		} = args as CreateTemplateToolArgs;

		if (!identifier || !name || !query) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"identifier, name, and query parameters are required",
			);
		}

		const result = await host.restApiClient.callMcpTool("create-template", {
			identifier,
			name,
			query,
			description,
			tags,
			targetTableId,
		});

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Create template failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleUpdateTemplate(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const { identifier, name, query, description, tags } =
			args as UpdateTemplateToolArgs;

		if (!identifier) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"identifier parameter is required",
			);
		}

		const result = await host.restApiClient.callMcpTool("update-template", {
			identifier,
			name,
			query,
			description,
			tags,
		});

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Update template failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleDeleteTemplate(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const { identifier, force = false } = args as DeleteTemplateToolArgs;

		if (!identifier) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"identifier parameter is required",
			);
		}

		const result = await host.restApiClient.callMcpTool("delete-template", {
			identifier,
			force,
		});

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Delete template failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleValidateTemplate(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const { query, variables } = args as ValidateTemplateToolArgs;

		if (!query) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"query parameter is required",
			);
		}

		const result = await host.restApiClient.callMcpTool("validate-template", {
			query,
			variables,
		});

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Validate template failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleSearchTemplates(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const {
			query,
			tags,
			tableId,
			operationType,
			limit = 50,
		} = args as SearchTemplatesToolArgs;

		const result = await host.restApiClient.callMcpTool("search-templates", {
			query,
			tags,
			tableId,
			operationType,
			limit,
		});

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: false,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Search templates failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleGetTemplateMetadata(
	host: McpRootToolHost,
	id: string | number | undefined,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const {
			identifier,
			includeUsageStats = true,
			includeDependencies = true,
		} = args as GetTemplateMetadataToolArgs;

		if (!identifier) {
			return host.createErrorMcpResponse(
				id,
				-32602,
				"Invalid params",
				"identifier parameter is required",
			);
		}

		const result = await host.restApiClient.callMcpTool(
			"get-template-metadata",
			{
				identifier,
				includeUsageStats,
				includeDependencies,
			},
		);

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`Get template metadata failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function handleSystemInitializationTool(
	host: McpRootToolHost,
	id: string | number | undefined,
	toolName: string,
	args: McpCustomToolArgs,
): Promise<McpToolResponse> {
	try {
		const result = await host.restApiClient.callMcpTool(toolName, args);

		return {
			jsonrpc: "2.0",
			id,
			result: {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
				isError: !result.success,
			},
		};
	} catch (error) {
		return host.createErrorMcpResponse(
			id,
			-32603,
			"Internal error",
			`System initialization tool failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function importTemplateViaGraphQL(
	host: McpRootToolHost,
	params: {
		jsonData: string;
		overwriteExisting?: boolean;
		generateNewIdentifier?: boolean;
	},
): Promise<{ success: boolean; error?: string }> {
	try {
		JSON.parse(params.jsonData);

		const mutation = `
        mutation ImportTemplate(
          $jsonData: String!
          $overwriteExisting: Boolean
          $generateNewIdentifier: Boolean
        ) {
          importTemplate(
            jsonData: $jsonData
            overwriteExisting: $overwriteExisting
            generateNewIdentifier: $generateNewIdentifier
          ) {
            success
            template {
              identifier
              name
            }
            errors {
              message
            }
          }
        }
      `;

		const variables = {
			jsonData: params.jsonData,
			overwriteExisting: params.overwriteExisting || false,
			generateNewIdentifier: params.generateNewIdentifier || false,
		};

		const result = await host.graphqlExecutor.execute({
			operationName: "ImportTemplate",
			query: mutation,
			variables,
			operationType: "mutation" as const,
		});

		if (result.errors && result.errors.length > 0) {
			return {
				success: false,
				error: result.errors[0]?.message || "GraphQL error",
			};
		}

		const mutationData = result.data as
			| {
					importTemplate?: {
						success?: boolean;
						errors?: Array<{ message?: string }>;
					};
			  }
			| undefined;

		const mutationResult = mutationData?.importTemplate;
		if (mutationResult?.success) {
			return { success: true };
		}
		return {
			success: false,
			error: mutationResult?.errors?.[0]?.message || "Template import failed",
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
