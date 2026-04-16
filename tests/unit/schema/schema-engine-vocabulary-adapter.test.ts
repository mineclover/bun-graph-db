import { describe, expect, it } from "bun:test";
import {
	OPENAPI_PROJECTION_PROFILE_EXTENSION,
	OPENAPI_PROJECTION_REFS_EXTENSION,
	OPENAPI_PROJECTION_SOURCES_EXTENSION,
	OPENAPI_PROJECTION_VERSION_HASH_EXTENSION,
	validateOpenApiProjection,
} from "@oa-sdk/openapi-projection-contract";
import {
	toTableSchemaOpenApiOperationContractProjectionResult,
	toTableSchemaOpenApiProjectionResult,
} from "@/core/schema/TableSchemaOpenApiProjection.js";
import {
	projectTableSchema,
	validateProjectedNodeInput,
	validateProjectedNodeUpdateInput,
	type TableProjectionInput,
} from "@/core/schema/TableSchemaProjection.js";
import { SchemaMapper } from "@/presentation/mcp/schema/SchemaMapper.js";

describe("shared schema engine vocabulary adapter", () => {
	it("maps table schema projections to valid OpenAPI component bundles", () => {
		const tableProjection = projectTableSchema(sampleInput());
		const projection = toTableSchemaOpenApiProjectionResult(tableProjection);

		expect(projection.profile).toBe("component-bundle");
		expect(projection.versionHash).toBe(tableProjection.versionHash);
		expect(projection.projection.openapi).toBe("3.2.0");
		expect(projection.projection.info).toEqual({
			title: "Table schema components for project_tasks",
			version: tableProjection.versionHash,
		});
		expect(projection.projection.paths).toEqual({});
		expect(projection.projection.components.schemas).toHaveProperty(
			"AttributeType_Status",
		);
		expect(projection.projection.components.schemas).toHaveProperty(
			"NodeAttributes_ProjectTasks",
		);
		expect(projection.projection.components.schemas).toHaveProperty(
			"NodeInput_ProjectTasks",
		);
		expect(
			projection.projection.components.schemas.NodeAttributes_ProjectTasks
				?.properties?.status,
		).toEqual({
			$ref: "#/components/schemas/AttributeType_Status",
		});
		expect(
			projection.projection.components.schemas.NodeInput_ProjectTasks
				?.properties?.attributes,
		).toEqual({
			$ref: "#/components/schemas/NodeAttributes_ProjectTasks",
		});
		expect(projection.projection).not.toHaveProperty("$defs");

		expect(projection.refs).toEqual(
			expect.arrayContaining([
				{
					from: "#/components/schemas/NodeAttributes_ProjectTasks/properties/status",
					to: "#/components/schemas/AttributeType_Status",
					ref: "#/components/schemas/AttributeType_Status",
					kind: "valueSchema",
					source: {
						kind: "db",
						entity: "attribute",
						id: "attr_status",
						pointer: "#",
					},
				},
			]),
		);
		expect(
			projection.sources[
				"#/components/schemas/NodeAttributes_ProjectTasks/properties/status"
			],
		).toEqual({
			kind: "db",
			entity: "attribute",
			id: "attr_status",
			pointer: "#",
		});
		expect(projection.diagnostics).toEqual([]);
		expect(projection.projection[OPENAPI_PROJECTION_PROFILE_EXTENSION]).toBe(
			"component-bundle",
		);
		expect(
			projection.projection[OPENAPI_PROJECTION_VERSION_HASH_EXTENSION],
		).toBe(tableProjection.versionHash);
		expect(projection.projection[OPENAPI_PROJECTION_SOURCES_EXTENSION]).toEqual(
			projection.sources,
		);
		expect(projection.projection[OPENAPI_PROJECTION_REFS_EXTENSION]).toEqual(
			projection.refs,
		);
		expect(validateOpenApiProjection(projection)).toEqual({
			valid: true,
			diagnostics: [],
		});
	});

	it("preserves projection error diagnostics through OpenAPI adapter mapping", () => {
		const tableProjection = projectTableSchema({
			...sampleInput(),
			attributes: [
				...sampleInput().attributes,
				{
					id: "attr_missing",
					tableId: "table_tasks",
					identifier: "missing",
					attributeTypeId: "does_not_exist",
					isRequired: false,
				},
			],
		});
		const projection = toTableSchemaOpenApiProjectionResult(tableProjection);
		const validation = validateOpenApiProjection(projection);

		expect(projection.diagnostics).toEqual(
			expect.arrayContaining([
				{
					severity: "error",
					code: "attribute-type-not-found",
					message:
						"Attribute 'missing' references missing attributeType 'does_not_exist'",
					source: {
						kind: "db",
						entity: "attribute",
						id: "attr_missing",
						pointer: "#",
					},
				},
			]),
		);
		expect(validation.valid).toBe(false);
		expect(validation.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					severity: "error",
					code: "attribute-type-not-found",
					source: {
						kind: "db",
						entity: "attribute",
						id: "attr_missing",
						pointer: "#",
					},
				}),
			]),
		);
	});

	it("maps table schema projections to valid OpenAPI operation contracts", () => {
		const tableProjection = projectTableSchema(sampleInput());
		const projection =
			toTableSchemaOpenApiOperationContractProjectionResult(tableProjection);
		const createPath =
			projection.projection.paths["/schema-engine/tables/project_tasks/nodes"];
		const updatePath =
			projection.projection.paths[
				"/schema-engine/tables/project_tasks/nodes/{nodeId}"
			];
		const createOperation = createPath?.post;
		const updateOperation = updatePath?.patch;

		expect(projection.profile).toBe("operation-contract");
		expect(projection.projection.info).toEqual({
			title: "Table node operation contracts for project_tasks",
			version: tableProjection.versionHash,
		});
		expect(createOperation?.operationId).toBe("createProjectTasksNode");
		expect(
			createOperation?.requestBody.content["application/json"].schema,
		).toEqual({
			$ref: "#/components/schemas/NodeCreateInput_ProjectTasks",
		});
		expect(
			projection.projection.components.schemas.NodeCreateInput_ProjectTasks,
		).toEqual({
			type: "object",
			description: "Node create input for table project_tasks",
			required: ["content", "attributes"],
			properties: {
				content: { type: "string" },
				attributes: { $ref: "#/components/schemas/NodeAttributes_ProjectTasks" },
			},
			additionalProperties: false,
		});
		expect(createOperation?.responses["201"]).toEqual({
			description: "Node created.",
		});
		expect(updateOperation?.operationId).toBe("updateProjectTasksNode");
		expect(updateOperation?.parameters).toEqual([
			{
				name: "nodeId",
				in: "path",
				required: true,
				schema: { type: "string" },
				description: "Node identifier.",
			},
		]);
		expect(
			updateOperation?.requestBody.content["application/json"].schema,
		).toEqual({
			$ref: "#/components/schemas/NodeUpdateInput_ProjectTasks",
		});
		expect(updateOperation?.responses["200"]).toEqual({
			description: "Node updated.",
		});
		expect(
			projection.projection.components.schemas.NodeUpdateInput_ProjectTasks
				?.properties?.attributes,
		).toEqual({
			$ref: "#/components/schemas/NodeUpdateAttributes_ProjectTasks",
		});
		expect(
			projection.projection.components.schemas.NodeUpdateAttributes_ProjectTasks
				?.properties?.status,
		).toEqual({
			$ref: "#/components/schemas/AttributeType_Status",
		});
		expect(
			projection.projection.components.schemas.NodeUpdateAttributes_ProjectTasks
				?.required,
		).toBeUndefined();
		expect(projection.projection[OPENAPI_PROJECTION_PROFILE_EXTENSION]).toBe(
			"operation-contract",
		);
		expect(validateOpenApiProjection(projection)).toEqual({
			valid: true,
			diagnostics: [],
		});
		expect(projection.refs.every((ref) => !ref.ref.includes("#/$defs/"))).toBe(
			true,
		);
		expect(
			projection.typeTargets?.every((target) =>
				target.id.startsWith("#/components/schemas/"),
			),
		).toBe(true);
	});

	it("derives MCP create and update node schemas from OpenAPI operation components", () => {
		const tableProjection = projectTableSchema(sampleInput());
		const projection =
			toTableSchemaOpenApiOperationContractProjectionResult(tableProjection);
		const schemas =
			SchemaMapper.mapOpenApiProjectionToMcpNodeToolSchemas(projection);

		expect(schemas.createInputSchema).toEqual(
			expect.objectContaining({
				type: "object",
				required: ["content", "attributes"],
				additionalProperties: false,
			}),
		);
		expect(schemas.createInputSchema.properties.attributes).toEqual(
			expect.objectContaining({
				type: "object",
				additionalProperties: false,
				required: ["status"],
				properties: {
					status: {
						type: "string",
						enum: ["todo", "done"],
					},
				},
			}),
		);

		expect(schemas.updateInputSchema).toEqual(
			expect.objectContaining({
				type: "object",
				required: ["nodeId"],
				additionalProperties: false,
			}),
		);
		expect(schemas.updateInputSchema.properties.nodeId).toEqual(
			expect.objectContaining({
				type: "string",
				description: "Node identifier.",
			}),
		);
		expect(schemas.updateInputSchema.properties.content).toEqual({
			type: "string",
		});
		expect(schemas.updateInputSchema.properties.attributes).toEqual(
			expect.objectContaining({
				type: "object",
				additionalProperties: false,
				required: [],
				properties: {
					status: {
						type: "string",
						enum: ["todo", "done"],
					},
				},
			}),
		);
	});

	it("keeps create and update payload validation aligned with shared projection validators", () => {
		const tableProjection = projectTableSchema(sampleInput());

		expect(
			validateProjectedNodeInput(
				{
					tableId: "table_tasks",
					content: "Ship projection experiment",
					attributes: {
						status: "todo",
					},
				},
				tableProjection,
			),
		).toEqual({ valid: true, errors: [] });

		const invalidCreate = validateProjectedNodeInput(
			{
				tableId: "table_tasks",
				content: "Ship projection experiment",
				attributes: {
					status: "blocked",
				},
			},
			tableProjection,
		);

		expect(invalidCreate.valid).toBe(false);
		if (!invalidCreate.valid) {
			expect(invalidCreate.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: "#/attributes/status",
						code: "enum",
					}),
				]),
			);
		}

		expect(
			validateProjectedNodeUpdateInput(
				{
					attributes: {},
				},
				tableProjection,
			),
		).toEqual({ valid: true, errors: [] });

		expect(
			validateProjectedNodeUpdateInput(
				{
					attributes: {
						status: "done",
					},
				},
				tableProjection,
			),
		).toEqual({ valid: true, errors: [] });

		const invalidUpdate = validateProjectedNodeUpdateInput(
			{
				attributes: {
					status: "blocked",
				},
			},
			tableProjection,
		);

		expect(invalidUpdate.valid).toBe(false);
		if (!invalidUpdate.valid) {
			expect(invalidUpdate.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: "#/attributes/status",
						code: "enum",
					}),
				]),
			);
			expect(invalidUpdate.errors).not.toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: "#/attributes/status",
						code: "required",
					}),
				]),
			);
		}
	});
});

function sampleInput(): TableProjectionInput {
	return {
		table: {
			id: "table_tasks",
			identifier: "project_tasks",
		},
		attributeTypes: [
			{
				id: "type_status",
				identifier: "status",
				jsonType: "string",
				validationSchema: JSON.stringify({ enum: ["todo", "done"] }),
			},
		],
		attributes: [
			{
				id: "attr_status",
				tableId: "table_tasks",
				identifier: "status",
				attributeTypeId: "type_status",
				isRequired: true,
			},
		],
	};
}
