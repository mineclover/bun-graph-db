import { describe, expect, test } from "vitest";
import type { ILogger } from "@/application/ports/ILogger.js";
import { createHeadlessGraphDb } from "@/core/HeadlessGraphDb.js";
import type { TableColumnSummary } from "@/domain/value-objects/ColumnConfig.js";
import { createPortableGraphNode } from "@/infrastructure/container/PortableBootstrap.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import { AuthoringCommandStack } from "@/presentation/ui/authoring/AuthoringController.js";
import { createDefaultFieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import { createLocalHeadlessClient } from "@/presentation/ui/clients/LocalHeadlessClient.js";
import { createRemoteHttpClient } from "@/presentation/ui/clients/RemoteHttpClient.js";
import { validateRowDraft } from "@/presentation/ui/clients/sharedHelpers.js";
import type { IGraphPlatformClient } from "@/presentation/ui/contracts.js";
import { createDefaultViewRegistry } from "@/presentation/ui/views/ViewRegistry.js";

const silentLogger: ILogger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {},
};

async function runSharedClientSuite(
	client: IGraphPlatformClient,
): Promise<void> {
	const events: string[] = [];
	const unsub = client.subscribe((ev) => events.push(ev.scope));

	await client.applyPreset("knowledge");

	const tables = await client.inspectArchitecture();
	expect(tables.map((t) => t.identifier)).toEqual(
		expect.arrayContaining(["ia_topics", "ia_documents", "ia_concepts"]),
	);

	const docCols = await client.getTableColumns("ia_documents");
	expect(docCols.columns.length).toBeGreaterThan(0);

	const docTable = tables.find((t) => t.identifier === "ia_documents");
	const topicTable = tables.find((t) => t.identifier === "ia_topics");
	expect(docTable).toBeDefined();
	expect(topicTable).toBeDefined();

	const created = await client.createRow({
		tableId: docTable?.id ?? "",
		tableIdentifier: "ia_documents",
		title: "Platform Spec",
		content: "Unified UI platform client verification row",
		attributes: {
			domain: "engineering",
			audience: "developer",
			status: "draft",
			priority: 1,
			topic_slug: "web-edge",
		},
	});
	expect(created.id).toBeTruthy();

	const updated = await client.updateRow(created.id, {
		tableId: docTable?.id ?? "",
		tableIdentifier: "ia_documents",
		attributes: {
			status: "published",
		},
	});
	expect(updated.id).toBe(created.id);

	const queried = await client.queryTable({
		tableIdentifier: "ia_documents",
		textQuery: "Unified UI platform",
		facets: "auto",
		limit: 10,
	});
	expect(queried.hits.length).toBeGreaterThanOrEqual(1);
	expect(queried.hits[0]?.node.attributes?.status).toBe("published");

	// Upsert & delete relation
	const docIds = queried.hits.map((h) => h.node.id);
	const allDocs = await client.queryTable({
		tableIdentifier: "ia_documents",
		limit: 20,
	});
	const otherId = allDocs.hits.find((h) => h.node.id !== created.id)?.node.id;
	if (otherId) {
		const rel = await client.upsertRelation({
			tableId: docTable?.id ?? "",
			sourceNodeId: created.id,
			targetNodeId: otherId,
			relationType: "dependsOn",
			strength: 3,
		});
		expect(rel?.id).toBeTruthy();

		const graph = await client.getDependencyGraph({
			tableIdentifier: "ia_documents",
			focusNodeId: created.id,
		});
		expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
		expect(graph.edges.length).toBeGreaterThanOrEqual(1);
		expect(graph.impactNodeIds).toContain(created.id);
		expect(graph.impactNodeIds).toContain(otherId);

		if (rel?.id) {
			await client.deleteRelation(rel.id);
		}
	}
	expect(docIds.length).toBeGreaterThanOrEqual(1);

	// Outline & hierarchy move (including cycle guard)
	const outline = await client.getOutline({
		tableIdentifier: "ia_topics",
		maxDepth: 5,
	});
	expect(outline.roots.length).toBeGreaterThanOrEqual(1);
	const rootTopic = outline.roots[0];
	const childTopic = rootTopic?.children[0];
	if (rootTopic && childTopic) {
		await expect(
			client.moveHierarchyNode({
				nodeId: rootTopic.id,
				newParentId: childTopic.id,
				relationType: "parentOf",
			}),
		).rejects.toThrow(/cycle/i);
	}

	// AI Memory remember / recall / consolidate / stats
	const mem1 = await client.remember({
		content: "UI memory one for consolidation check",
		kind: "episodic",
		topicPath: ["ui", "platform"],
		importance: 0.85,
	});
	const mem2 = await client.remember({
		content: "UI memory two for consolidation check",
		kind: "episodic",
		topicPath: ["ui", "platform"],
		importance: 0.85,
	});
	const recalled = await client.recall({
		query: "consolidation check",
		limit: 10,
	});
	expect(recalled.hits.length).toBeGreaterThanOrEqual(2);
	const consolidated = await client.consolidate({
		sourceMemoryIds: [mem1.memory.id, mem2.memory.id],
		content: "Consolidated UI memory check",
		kind: "semantic",
		markSourcesAsSuperseded: true,
	});
	expect(consolidated.supersededIds).toEqual(
		expect.arrayContaining([mem1.memory.id, mem2.memory.id]),
	);
	const stats = await client.getMemoryStats();
	expect(stats.total).toBeGreaterThanOrEqual(1);

	// Saved Views SSOT CRUD
	const saved = await client.saveView({
		id: "tmp-1",
		name: "Approved Docs Table",
		tableIdentifier: "ia_documents",
		viewType: "table",
		sortColumn: "id",
		sortDirection: "ascending",
	});
	expect(saved.id).toBeTruthy();
	const views = await client.listSavedViews();
	expect(views.some((v) => v.name === "Approved Docs Table")).toBe(true);
	await client.deleteSavedView(saved.id);
	const afterDeleteViews = await client.listSavedViews();
	expect(afterDeleteViews.some((v) => v.id === saved.id)).toBe(false);

	// Cleanup created doc row
	await client.deleteRow(created.id);

	const audit = await client.auditArchitecture();
	expect(audit.totalTables).toBeGreaterThanOrEqual(3);

	expect(events.length).toBeGreaterThan(0);
	unsub();
}

describe("Platform UI Architecture (Contracts, Clients, Authoring, View Plugins)", () => {
	test("LocalHeadlessClient executes full platform contract parity", async () => {
		const db = new SqliteDatabase(":memory:");
		const headless = await createHeadlessGraphDb({
			database: db,
			databaseLabel: ":ui-local-test:",
		});
		try {
			const client = createLocalHeadlessClient(headless);
			await runSharedClientSuite(client);
		} finally {
			await headless.dispose();
			db.close();
		}
	});

	test("RemoteHttpClient executes full platform contract parity over PortableGraphNode", async () => {
		const db = new SqliteDatabase(":memory:");
		const node = await createPortableGraphNode(db, {
			databaseLabel: ":ui-remote-test:",
			logger: silentLogger,
		});
		try {
			const client = createRemoteHttpClient({
				baseUrl: "http://localhost",
				fetchImpl: (input, init) => {
					const req =
						input instanceof Request ? input : new Request(String(input), init);
					return node.fetch(req);
				},
			});
			await runSharedClientSuite(client);
			const health = await client.getHealth?.();
			expect(health?.status).toBe("OK");
		} finally {
			await node.dispose();
			db.close();
		}
	});

	test("Authoring validation, FieldEditorRegistry, AuthoringCommandStack, and ViewRegistry behave deterministically", async () => {
		const columns: TableColumnSummary[] = [
			{
				id: "1",
				identifier: "status",
				name: "Status",
				description: null,
				attributeTypeId: "string",
				isRequired: true,
				config: { role: "status", enumValues: ["draft", "approved"] },
			},
			{
				id: "2",
				identifier: "priority",
				name: "Priority",
				description: null,
				attributeTypeId: "number",
				isRequired: false,
				config: { role: "priority" },
			},
			{
				id: "3",
				identifier: "tags",
				name: "Tags",
				description: null,
				attributeTypeId: "json",
				isRequired: false,
				config: { role: "tag" },
			},
		];

		const badReport = validateRowDraft(
			columns,
			{ content: "", attributes: { status: "invalid", priority: "NaN" } },
			true,
		);
		expect(badReport.valid).toBe(false);
		expect(badReport.issues.map((i) => i.field)).toEqual(
			expect.arrayContaining(["content", "status", "priority"]),
		);

		const okReport = validateRowDraft(
			columns,
			{ content: "Valid", attributes: { status: "draft", priority: 2 } },
			true,
		);
		expect(okReport.valid).toBe(true);

		const editors = createDefaultFieldEditorRegistry();
		expect(editors.resolve(columns[0] as TableColumnSummary).id).toBe(
			"enum-select",
		);
		expect(editors.resolve(columns[1] as TableColumnSummary).id).toBe(
			"number-metric",
		);
		expect(editors.resolve(columns[2] as TableColumnSummary).id).toBe(
			"tag-chips",
		);

		const views = createDefaultViewRegistry(editors);
		expect(views.map((v) => v.id)).toEqual([
			"table",
			"outline",
			"board",
			"graph",
			"timeline",
			"audit",
		]);
		const mockTable = {
			id: "1",
			identifier: "ia_documents",
			description: null,
			attributeCount: 3,
			nodeCount: 2,
		};
		expect(views.find((v) => v.id === "board")?.supports(mockTable, columns)).toBe(
			true,
		);
		expect(
			views.find((v) => v.id === "timeline")?.supports(mockTable, columns),
		).toBe(false);

		let counter = 0;
		const stack = new AuthoringCommandStack();
		await stack.execute({
			label: "inc",
			async execute() {
				counter += 1;
			},
			async undo() {
				counter -= 1;
			},
		});
		expect(counter).toBe(1);
		expect(stack.canUndo()).toBe(true);
		await stack.undo();
		expect(counter).toBe(0);
		expect(stack.canRedo()).toBe(true);
		await stack.redo();
		expect(counter).toBe(1);
	});
});
