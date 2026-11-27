import {
	type SchemaDiagnostic,
	validateOpenApiProjection,
} from "@oa-sdk/openapi-projection-contract";
import type { McpToolDefinition } from "../../../application/services/McpToolRegistry.js";
import type { TableSchemaProjectionService } from "../../../application/services/TableSchemaProjectionService.js";
import {
	type TableSchemaOpenApiOperationContractProjectionResult,
	toTableSchemaOpenApiOperationContractProjectionResult,
} from "../../../core/schema/TableSchemaOpenApiProjection.js";
import type {
	ProjectionDiagnostic,
	TableSchemaProjection,
} from "../../../core/schema/TableSchemaProjection.js";
import { type McpInputSchema, SchemaMapper } from "../schema/SchemaMapper.js";

export type TableSchemaProjectionProvider = Pick<
	TableSchemaProjectionService,
	"project"
>;

export function buildOpenApiProjectionTool(tableId: string): McpToolDefinition {
	return {
		name: `get-openapi-projection-${tableId}`,
		description: `Returns an OpenAPI 3.2 projection artifact for the current table ${tableId}. Use profile 'component-bundle' for reusable component schemas or 'operation-contract' for create/update operation contracts.`,
		inputSchema: {
			type: "object",
			properties: {
				profile: {
					type: "string",
					enum: ["component-bundle", "operation-contract"],
					default: "component-bundle",
					description:
						"Projection profile to return. Defaults to component-bundle.",
				},
			},
			required: [],
			additionalProperties: false,
		},
		outputSchema: {
			$schema: "https://json-schema.org/draft/2020-12/schema",
			type: "object",
			properties: {
				projection: { type: ["object", "null"] },
				validation: {
					type: "object",
					properties: {
						valid: { type: "boolean" },
						diagnostics: { type: "array" },
					},
					required: ["valid", "diagnostics"],
				},
				error: { type: "object" },
			},
			required: ["projection", "validation"],
		},
		operationType: "query",
	};
}

export function buildTableStaticTools(tableId: string): McpToolDefinition[] {
	const aiMetadataTool: McpToolDefinition = {
		name: `get-table-metadata-${tableId}`,
		description: `[테이블 정보 조회] Get comprehensive metadata for table ${tableId}: schema structure (data types, required fields), usage patterns (common queries, templates), and sample data. Perfect for understanding table capabilities and AI-assisted queries.`,
		inputSchema: {
			type: "object",
			properties: {
				includeSampleData: {
					type: "boolean",
					description: "Whether to include sample data in the response",
					default: true,
				},
				sampleLimit: {
					type: "number",
					description: "Maximum number of sample nodes to include",
					default: 5,
				},
			},
			required: [],
		},
		operationType: "query",
		graphqlOperation: {
			operationType: "query",
			query: `
          query GetTableMetadata($tableId: ID!, $includeAiMetadata: Boolean!) {
            table(id: $tableId) {
              id
              identifier
              description
              aiMetadata @include(if: $includeAiMetadata) {
                schemaInfo {
                  dataTypes
                  requiredFields
                  searchableFields
                  relationshipCapabilities
                }
                usagePatterns {
                  commonQueries {
                    pattern
                    description
                    example
                  }
                  templateRecommendations {
                    templateId
                    useCase
                  }
                  queryComplexity
                }
                sampleData {
                  nodes {
                    id
                    content
                    attributes
                  }
                  relationships {
                    from
                    to
                    type
                  }
                }
              }
            }
          }
        `,
		},
	};

	const validateInputSchemaTool: McpToolDefinition = {
		name: `validate-input-schema-${tableId}`,
		description:
			"[inputSchema 검증] Validate JSON Schema for MCP tool inputSchema compatibility. Checks compliance with MCP spec (JSON Schema Draft-07, type: object required). Returns detailed errors and warnings. Use before creating templates with inputSchema.",
		inputSchema: {
			type: "object",
			properties: {
				schema: {
					type: "object",
					description: "JSON Schema to validate for MCP compatibility",
				},
			},
			required: ["schema"],
		},
		operationType: "query",
	};

	const validateDataTool: McpToolDefinition = {
		name: `validate-data-${tableId}`,
		description:
			"[데이터 검증] Validate runtime data against a JSON Schema. Performs type checking with coercion, constraint validation, and format validation. Returns coerced data if valid, or detailed errors with standardized error codes (TYPE_*, CONSTRAINT_*) if invalid.",
		inputSchema: {
			type: "object",
			properties: {
				data: {
					type: "object",
					description: "Data to validate",
				},
				schema: {
					type: "object",
					description: "JSON Schema to validate against",
				},
			},
			required: ["data", "schema"],
		},
		operationType: "query",
	};

	const discoverSearchOperationsTool: McpToolDefinition = {
		name: `discover-search-operations-${tableId}`,
		description: `[검색 기능 탐색] Discover all possible ways to search nodes in table ${tableId}. Shows available search operations, field options, and query variations. Use this to learn what search capabilities are available.`,
		inputSchema: {
			type: "object",
			properties: {
				baseOperation: {
					type: "string",
					description: "Base operation to discover variations for",
					default: "searchNodes",
				},
			},
			required: [],
		},
		operationType: "query",
	};

	const discoverFilterOptionsTool: McpToolDefinition = {
		name: `discover-filter-options-${tableId}`,
		description: `[필터 옵션 조회] List all filter options for searching nodes in table ${tableId}. Shows available operators (EQUALS, CONTAINS, GREATER_THAN, etc.), attribute filters, and relationship filters. Essential for building advanced queries.`,
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
		operationType: "query",
	};

	const generateSearchExamplesTool: McpToolDefinition = {
		name: `generate-search-examples-${tableId}`,
		description: `[검색 예제 생성] Generate ready-to-use search query examples for table ${tableId}. Includes basic text search, attribute filtering, relationship queries, and complex multi-condition searches. Copy-paste ready examples.`,
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
		operationType: "query",
	};

	const exportWithMappingTool: McpToolDefinition = {
		name: `export-with-mapping-${tableId}`,
		description: `[커스텀 포맷 Export] Export table ${tableId} data with custom format mapping. Transform Flat JSON to any custom structure using address-based field mapping. Supports preset formats (CSV_FLAT, API_RESPONSE, GRAPH_FORMAT) or custom mapping templates.`,
		inputSchema: {
			type: "object",
			properties: {
				mapping: {
					type: "object",
					description:
						'Mapping template or simple key-value mappings. Key = target path, Value = source path (e.g., {"users[*].id": "$.nodes[*].id", "users[*].name": "$.nodes[*].title"})',
				},
				presetFormat: {
					type: "string",
					enum: ["CSV_FLAT", "API_RESPONSE", "GRAPH_FORMAT"],
					description: "Use a preset format instead of custom mapping",
				},
				prettyPrint: {
					type: "boolean",
					description: "Pretty print JSON output",
					default: true,
				},
				includeNulls: {
					type: "boolean",
					description: "Include null values in output",
					default: false,
				},
				strictMode: {
					type: "boolean",
					description: "Fail on missing source fields",
					default: false,
				},
			},
			required: [],
		},
		operationType: "query",
	};

	const importWithMappingTool: McpToolDefinition = {
		name: `import-with-mapping-${tableId}`,
		description: `[커스텀 포맷 Import] Import data into table ${tableId} from custom format. Transform custom JSON structure back to Flat JSON using reverse address mapping. Use for batch data import.`,
		inputSchema: {
			type: "object",
			properties: {
				data: {
					type: "object",
					description: "Custom format data to import",
				},
				mapping: {
					type: "object",
					description:
						"Mapping template (same format used for export). Will be inverted automatically.",
				},
				presetFormat: {
					type: "string",
					enum: ["CSV_FLAT", "API_RESPONSE", "GRAPH_FORMAT"],
					description: "Use a preset format instead of custom mapping",
				},
				mergeStrategy: {
					type: "string",
					enum: ["replace", "merge", "deep-merge"],
					description: "How to merge with existing data",
					default: "replace",
				},
			},
			required: ["data"],
		},
		operationType: "mutation",
	};

	const generatePatchesTool: McpToolDefinition = {
		name: `generate-patches-${tableId}`,
		description: `[Patch 생성] Generate update patches from custom format data for table ${tableId}. Useful for partial updates - converts custom format data to FlatNodePatch[] that can be applied to existing nodes.`,
		inputSchema: {
			type: "object",
			properties: {
				data: {
					type: "object",
					description: "Custom format data containing updates",
				},
				mapping: {
					type: "object",
					description:
						"Mapping template (must include ID mapping for node identification)",
				},
				presetFormat: {
					type: "string",
					enum: ["CSV_FLAT", "API_RESPONSE", "GRAPH_FORMAT"],
					description: "Use a preset format instead of custom mapping",
				},
			},
			required: ["data"],
		},
		operationType: "query",
	};

	const validateMappingTool: McpToolDefinition = {
		name: `validate-mapping-${tableId}`,
		description: `[매핑 검증] Validate a format mapping template for table ${tableId}. Checks for duplicate targets, invalid paths, unsupported transforms, and warns about potential issues.`,
		inputSchema: {
			type: "object",
			properties: {
				mapping: {
					type: "object",
					description: "Mapping template to validate",
				},
				validateAgainstData: {
					type: "boolean",
					description: "Also validate source paths against actual table data",
					default: false,
				},
			},
			required: ["mapping"],
		},
		operationType: "query",
	};

	const listPresetsTool: McpToolDefinition = {
		name: `list-format-presets-${tableId}`,
		description:
			"[프리셋 목록] List available preset format mappings. Shows CSV_FLAT, API_RESPONSE, GRAPH_FORMAT with their descriptions and mapping definitions. Useful for understanding available transformations.",
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
		operationType: "query",
	};

	return [
		aiMetadataTool,
		validateInputSchemaTool,
		validateDataTool,
		discoverSearchOperationsTool,
		discoverFilterOptionsTool,
		generateSearchExamplesTool,
		exportWithMappingTool,
		importWithMappingTool,
		generatePatchesTool,
		validateMappingTool,
		listPresetsTool,
	];
}

export async function buildProjectedNodeTools(
	tableId: string,
	projectionService?: TableSchemaProjectionProvider,
): Promise<McpToolDefinition[]> {
	const { createInputSchema, updateInputSchema, metadata } =
		await getProjectedNodeToolSchemas(tableId, projectionService);

	const createNodeTool: McpToolDefinition = {
		name: `create-table-${tableId}-node`,
		description: `[노드 생성] Create a node in table ${tableId} with projection-derived attribute values.`,
		inputSchema: createInputSchema,
		_meta: metadata,
		operationType: "mutation",
		graphqlOperation: {
			operationType: "mutation",
			query: `
          mutation CreateTableNodeWithAttributes($input: CreateNodeWithAttributesInput!) {
            createNodeWithAttributes(input: $input) {
              success
              node {
                id
                tableId
                content
                title
                description
                createdAt
                updatedAt
              }
              attributes {
                id
                attributeId
                value
                attribute {
                  identifier
                  name
                }
              }
              errors {
                message
                code
                field
              }
            }
          }
        `,
		},
	};

	const updateNodeTool: McpToolDefinition = {
		name: `update-table-${tableId}-node`,
		description: `[노드 속성 수정] Update projection-derived attribute values for a node in table ${tableId}.`,
		inputSchema: updateInputSchema,
		_meta: metadata,
		operationType: "mutation",
		graphqlOperation: {
			operationType: "mutation",
			query: `
          mutation UpdateTableNode($id: ID!, $input: UpdateNodeInput!) {
            updateNode(id: $id, input: $input) {
              success
              node {
                id
                tableId
                content
                title
                description
                createdAt
                updatedAt
              }
              errors {
                message
                code
                field
              }
            }
          }
        `,
		},
	};

	return [createNodeTool, updateNodeTool];
}

async function getProjectedNodeToolSchemas(
	tableId: string,
	projectionService?: TableSchemaProjectionProvider,
): Promise<{
	createInputSchema: McpInputSchema;
	updateInputSchema: McpInputSchema;
	metadata: Record<string, unknown>;
}> {
	if (!projectionService) {
		const createInputSchema = createFallbackNodeInputSchema(tableId);
		return {
			createInputSchema,
			updateInputSchema: createUpdateNodeInputSchemaFromCreateSchema(
				tableId,
				createInputSchema,
			),
			metadata: {
				tableSchemaProjection: {
					tableId,
					available: false,
					warnings: [
						"Table schema projection service is not configured for this table MCP server.",
					],
				},
			},
		};
	}

	try {
		const projection = await projectionService.project({ tableId });
		const openApiProjection =
			toTableSchemaOpenApiOperationContractProjectionResult(projection);
		const openApiValidation = validateOpenApiProjection(openApiProjection);

		if (!openApiValidation.valid) {
			return createProjectionFallbackSchemas(
				tableId,
				"OpenAPI projection has error diagnostics",
				projection,
				openApiProjection,
				openApiValidation.diagnostics,
			);
		}

		let mappedSchemas: {
			createInputSchema: McpInputSchema;
			updateInputSchema: McpInputSchema;
		};
		try {
			mappedSchemas =
				SchemaMapper.mapOpenApiProjectionToMcpNodeToolSchemas(
					openApiProjection,
				);
		} catch (error) {
			return createCompatibilityProjectionSchemas(
				tableId,
				`OpenAPI projection mapping failed: ${error instanceof Error ? error.message : String(error)}`,
				projection,
				openApiProjection,
				openApiValidation.diagnostics,
			);
		}
		const { createInputSchema, updateInputSchema } = mappedSchemas;

		if (
			!SchemaMapper.validateJsonSchema(createInputSchema) ||
			!SchemaMapper.validateJsonSchema(updateInputSchema)
		) {
			return createCompatibilityProjectionSchemas(
				tableId,
				"OpenAPI projection-derived MCP input schema is invalid",
				projection,
				openApiProjection,
				openApiValidation.diagnostics,
			);
		}

		return {
			createInputSchema,
			updateInputSchema,
			metadata: createProjectionMetadata(
				projection,
				openApiProjection,
				openApiValidation.diagnostics,
				{ schemaSource: "openapi-projection" },
			),
		};
	} catch (error) {
		console.warn(`Failed to project table schema for table ${tableId}:`, error);
		const createInputSchema = createFallbackNodeInputSchema(tableId);
		return {
			createInputSchema,
			updateInputSchema: createUpdateNodeInputSchemaFromCreateSchema(
				tableId,
				createInputSchema,
			),
			metadata: {
				tableSchemaProjection: {
					tableId,
					available: false,
					warnings: [error instanceof Error ? error.message : String(error)],
				},
			},
		};
	}
}

function createProjectionFallbackSchemas(
	tableId: string,
	reason: string,
	projection: TableSchemaProjection,
	openApiProjection?: TableSchemaOpenApiOperationContractProjectionResult,
	diagnostics?: SchemaDiagnostic[],
): {
	createInputSchema: McpInputSchema;
	updateInputSchema: McpInputSchema;
	metadata: Record<string, unknown>;
} {
	const createInputSchema = createFallbackNodeInputSchema(tableId);
	return {
		createInputSchema,
		updateInputSchema: createUpdateNodeInputSchemaFromCreateSchema(
			tableId,
			createInputSchema,
		),
		metadata: {
			tableSchemaProjection: {
				...(createProjectionMetadata(
					projection,
					openApiProjection,
					diagnostics,
					{
						schemaSource: openApiProjection
							? "openapi-projection"
							: "table-schema-projection",
						usable: false,
					},
				).tableSchemaProjection as Record<string, unknown>),
				usable: false,
				warnings: [reason],
			},
		},
	};
}

function createCompatibilityProjectionSchemas(
	tableId: string,
	reason: string,
	projection: TableSchemaProjection,
	openApiProjection?: TableSchemaOpenApiOperationContractProjectionResult,
	diagnostics?: SchemaDiagnostic[],
): {
	createInputSchema: McpInputSchema;
	updateInputSchema: McpInputSchema;
	metadata: Record<string, unknown>;
} {
	const createInputSchema =
		SchemaMapper.mapTableProjectionToMcpInputSchema(projection);
	if (!SchemaMapper.validateJsonSchema(createInputSchema)) {
		return createProjectionFallbackSchemas(
			tableId,
			reason,
			projection,
			openApiProjection,
			diagnostics,
		);
	}

	return {
		createInputSchema,
		updateInputSchema: createUpdateNodeInputSchemaFromCreateSchema(
			tableId,
			createInputSchema,
		),
		metadata: {
			tableSchemaProjection: {
				...(createProjectionMetadata(
					projection,
					openApiProjection,
					diagnostics,
					{
						schemaSource: "table-schema-projection-compatibility-fallback",
					},
				).tableSchemaProjection as Record<string, unknown>),
				warnings: [reason],
			},
		},
	};
}

function createUpdateNodeInputSchemaFromCreateSchema(
	tableId: string,
	createInputSchema: McpInputSchema,
): McpInputSchema {
	const createAttributesSchema = createInputSchema.properties.attributes ?? {
		type: "object",
		description: `Attribute values for table ${tableId}`,
		properties: {},
		required: [],
		additionalProperties: true,
	};
	const attributesSchema = {
		...createAttributesSchema,
		required: [],
	};

	return {
		type: "object",
		properties: {
			nodeId: {
				type: "string",
				description: `Node ID in table ${tableId}`,
			},
			attributes: attributesSchema,
		},
		required: ["nodeId", "attributes"],
		additionalProperties: false,
	};
}

function createFallbackNodeInputSchema(tableId: string): McpInputSchema {
	return {
		type: "object",
		properties: {
			content: {
				type: "string",
				description: `Node content for table ${tableId}`,
			},
			attributes: {
				type: "object",
				description: `Attribute values for table ${tableId}`,
				properties: {},
				required: [],
				additionalProperties: true,
			},
		},
		required: ["content", "attributes"],
		additionalProperties: false,
	};
}

function createProjectionMetadata(
	projection: TableSchemaProjection,
	openApiProjection?: TableSchemaOpenApiOperationContractProjectionResult,
	diagnosticsOverride?: SchemaDiagnostic[],
	options: {
		schemaSource?: string;
		usable?: boolean;
	} = {},
): { tableSchemaProjection: Record<string, unknown> } {
	const diagnostics = (
		diagnosticsOverride ??
		openApiProjection?.diagnostics ??
		projection.diagnostics
	).map((diagnostic) => serializeProjectionDiagnostic(diagnostic));
	const errors = diagnostics.filter(
		(diagnostic) => diagnostic.severity === "error",
	);
	const warnings = diagnostics.filter(
		(diagnostic) => diagnostic.severity === "warning",
	);

	return {
		tableSchemaProjection: {
			available: true,
			usable: options.usable ?? errors.length === 0,
			tableId: projection.tableId,
			tableIdentifier: projection.tableIdentifier,
			versionHash: openApiProjection?.versionHash ?? projection.versionHash,
			...(openApiProjection ? { profile: openApiProjection.profile } : {}),
			...(options.schemaSource ? { schemaSource: options.schemaSource } : {}),
			diagnostics,
			warnings,
			errors,
		},
	};
}

function serializeProjectionDiagnostic(
	diagnostic: ProjectionDiagnostic | SchemaDiagnostic,
): Record<string, unknown> {
	return {
		severity: diagnostic.severity,
		code: diagnostic.code,
		message: diagnostic.message,
		...(diagnostic.source
			? { source: serializeProjectionSource(diagnostic.source) }
			: {}),
	};
}

function serializeProjectionSource(
	source: ProjectionDiagnostic["source"] | SchemaDiagnostic["source"],
): Record<string, unknown> | undefined {
	if (!source) return undefined;

	if (source.kind === "file") {
		return {
			kind: source.kind,
			filePath: source.filePath,
			pointer: source.pointer,
			...(source.line !== undefined ? { line: source.line } : {}),
			...(source.column !== undefined ? { column: source.column } : {}),
		};
	}

	return {
		kind: source.kind,
		entity: source.entity,
		id: source.id,
		pointer: source.pointer,
	};
}
