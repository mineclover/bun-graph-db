import type { TableProjectionInput } from "../../src/core/schema/TableSchemaProjection.js";

export const OA_SDK_PROJECTION_FIXTURE_ID = "project_tasks/v1";

/**
 * Fixed database-shaped input used to publish cross-repository projection evidence.
 * Return a new object for each call so callers cannot leak mutations between runs.
 */
export function createOaSdkProjectionFixture(): TableProjectionInput {
	return {
		table: {
			id: "table_tasks",
			identifier: "project_tasks",
			description: "Project task table used for deterministic OA SDK evidence",
			updatedAt: "2026-08-10T00:00:00.000Z",
		},
		attributeTypes: [
			{
				id: "type_status",
				identifier: "status",
				jsonType: "string",
				description: "Current project task status",
				validationSchema: JSON.stringify({ enum: ["todo", "doing", "done"] }),
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "type_priority",
				identifier: "priority",
				jsonType: "integer",
				description: "Priority from one to five",
				validationSchema: JSON.stringify({ minimum: 1, maximum: 5 }),
				defaultValue: "3",
				examples: "[1,3,5]",
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "type_owner_email",
				identifier: "owner_email",
				jsonType: "string",
				format: "email",
				description: "Owner email address",
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "type_labels",
				identifier: "labels",
				jsonType: "array",
				description: "Stable lower-case task labels",
				validationSchema: JSON.stringify({
					items: { type: "string", pattern: "^[a-z]+$" },
					minItems: 1,
					uniqueItems: true,
				}),
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
		],
		attributes: [
			{
				id: "attr_status",
				tableId: "table_tasks",
				identifier: "status",
				name: "Status",
				attributeTypeId: "type_status",
				isRequired: true,
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "attr_priority",
				tableId: "table_tasks",
				identifier: "priority",
				name: "Priority",
				attributeTypeId: "type_priority",
				isRequired: false,
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "attr_owner_email",
				tableId: "table_tasks",
				identifier: "owner_email",
				name: "Owner email",
				attributeTypeId: "type_owner_email",
				isRequired: true,
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
			{
				id: "attr_labels",
				tableId: "table_tasks",
				identifier: "labels",
				name: "Labels",
				attributeTypeId: "type_labels",
				isRequired: false,
				updatedAt: "2026-08-10T00:00:00.000Z",
			},
		],
	};
}
