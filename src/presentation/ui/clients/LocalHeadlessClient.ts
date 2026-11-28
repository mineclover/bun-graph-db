import {
	getPresetBlueprint,
	type PresetBlueprintName,
} from "@/application/blueprints/PresetBlueprints.js";
import type {
	ConsolidateInput,
	MemoryStatsOutput,
	RecallInput,
	RememberInput,
} from "@/application/services/AiMemoryService.js";
import type {
	IaOutlineOptions,
	IaStructuredQuery,
	InformationArchitectureBlueprint,
} from "@/application/services/InformationArchitectureTypes.js";
import type { HeadlessGraphDb } from "@/core/HeadlessGraphDb.js";
import type { NodeRelationId, TableId } from "@/core/types/CommonTypes.js";
import { RelationType } from "@/domain/entities/RelationType.js";
import type {
	ColumnConfig,
	TableColumnProfile,
} from "@/domain/value-objects/ColumnConfig.js";
import type { SafeJsonValue } from "@/shared/utils/safeJson.js";
import {
	computeGraphAnalytics,
	UI_VIEWS_TABLE_IDENTIFIER,
	validateRowDraft,
} from "@/presentation/ui/clients/sharedHelpers.js";
import type {
	ChangeScope,
	CreateRowCommand,
	DependencyGraphQuery,
	GraphSubgraph,
	IGraphPlatformClient,
	MoveHierarchyCommand,
	PlatformRelation,
	PlatformRelationType,
	PlatformRow,
	PlatformTableSummary,
	RelationCommand,
	SavedViewConfig,
	UpdateRowCommand,
} from "@/presentation/ui/contracts.js";

export interface LocalHeadlessClientOptions {
	onSaveSnapshot?: (key: string) => Promise<{ key: string; bytes: number }>;
	onRestoreSnapshot?: (key: string) => Promise<void>;
}

export function createLocalHeadlessClient(
	db: HeadlessGraphDb,
	options: LocalHeadlessClientOptions = {},
): IGraphPlatformClient {
	const listeners = new Set<
		(event: { scope: ChangeScope; tableId?: string }) => void
	>();

	const notify = (scope: ChangeScope, tableId?: string): void => {
		for (const listener of listeners) {
			listener(tableId ? { scope, tableId } : { scope });
		}
	};

	const ensureUiViewsTable = async (): Promise<string> => {
		const existing = await db.getTable(UI_VIEWS_TABLE_IDENTIFIER);
		if (existing) return existing.id;
		const created = await db.createTable({
			identifier: UI_VIEWS_TABLE_IDENTIFIER,
			description: "Platform Saved View definitions (SSOT)",
		});
		return created.table.id;
	};

	return {
		mode: "local-headless",

		async inspectArchitecture(): Promise<PlatformTableSummary[]> {
			const inspection = await db.ia.inspectArchitecture();
			return inspection.tables.map((t) => ({
				id: t.id,
				identifier: t.identifier,
				description: t.description,
				attributeCount: t.attributeCount,
				nodeCount: t.nodeCount,
				treeValidation: t.treeValidation,
				dagValidation: t.dagValidation,
			}));
		},

		async getTableColumns(
			tableIdOrIdentifier: string,
		): Promise<TableColumnProfile> {
			const table = await db.getTable(tableIdOrIdentifier);
			const identifier = table?.identifier ?? tableIdOrIdentifier;
			return await db.ia.getTableColumns(identifier);
		},

		async configureColumn(
			tableIdOrIdentifier: string,
			attributeIdentifier: string,
			config: ColumnConfig,
		): Promise<void> {
			const table = await db.getTable(tableIdOrIdentifier);
			const identifier = table?.identifier ?? tableIdOrIdentifier;
			await db.ia.configureColumn(identifier, attributeIdentifier, config);
			notify("schema", identifier);
		},

		async applyPreset(preset: PresetBlueprintName) {
			const res = await db.applyPresetBlueprint(preset);
			notify("schema");
			notify("rows");
			return res;
		},

		async applyBlueprint(bp: InformationArchitectureBlueprint) {
			const res = await db.ia.applyBlueprint(bp);
			notify("schema");
			notify("rows");
			return res;
		},

		async diffBlueprint(bp: InformationArchitectureBlueprint) {
			return await db.ia.diffBlueprint(bp);
		},

		async validateRow(columns, draft, isCreate = false) {
			return validateRowDraft(columns, draft, isCreate);
		},

		async createRow(input: CreateRowCommand) {
			const resolved =
				(await db.getTable(input.tableIdentifier ?? input.tableId)) ?? null;
			const tableId = resolved?.id ?? input.tableId;
			const created = await db.createNode({
				tableId,
				content: input.content,
				title: input.title ?? undefined,
				description: input.description ?? undefined,
				attributes: input.attributes,
			});
			notify("rows", resolved?.identifier ?? tableId);
			return created.node;
		},

		async updateRow(nodeId: string, patch: UpdateRowCommand) {
			const updated = await db.updateNode(nodeId, {
				tableId: patch.tableId,
				tableIdentifier: patch.tableIdentifier,
				content: patch.content,
				title: patch.title ?? undefined,
				description: patch.description ?? undefined,
				attributes: patch.attributes,
			});
			notify("rows", patch.tableIdentifier ?? updated.node.tableId);
			return updated.node;
		},

		async deleteRow(nodeId: string): Promise<void> {
			await db.deleteNode(nodeId);
			notify("rows");
		},

		async listRelationTypes(): Promise<PlatformRelationType[]> {
			const page = await db.repositories.relationTypes.findAll({
				limit: 500,
				offset: 0,
			});
			const items = page.data ?? page.nodes ?? [];
			return items.map((rt) => ({
				id: String(rt.getId()),
				identifier: rt.getIdentifier(),
				description: rt.getDescription(),
				category: rt.getCategory(),
			}));
		},

		async listRelations(
			tableIdOrIdentifier?: string,
		): Promise<PlatformRelation[]> {
			const relTypes = await this.listRelationTypes();
			const typeById = new Map(relTypes.map((rt) => [rt.id, rt.identifier]));

			const tablesToRead: string[] = [];
			if (tableIdOrIdentifier) {
				const resolved = await db.getTable(tableIdOrIdentifier);
				if (resolved) tablesToRead.push(resolved.id);
			} else {
				const allTables = await db.listTables({ limit: 100, offset: 0 });
				for (const t of allTables.data ?? allTables.nodes ?? []) {
					tablesToRead.push(t.id);
				}
			}

			const collected: PlatformRelation[] = [];
			const seenIds = new Set<string>();
			for (const tid of tablesToRead) {
				const page = await db.repositories.nodeRelations.findByTableId(
					tid as TableId,
					{ limit: 500, offset: 0 },
				);
				for (const rel of page.data ?? page.nodes ?? []) {
					const id = String(rel.getId());
					if (seenIds.has(id)) continue;
					seenIds.add(id);
					collected.push({
						id,
						tableId: String(rel.getTableId()),
						sourceNodeId: String(rel.getSourceNodeId()),
						targetNodeId: String(rel.getTargetNodeId()),
						relationType:
							typeById.get(String(rel.getRelationTypeId())) ??
							String(rel.getRelationTypeId()),
						strength: rel.getStrength(),
						confidence: rel.getConfidence(),
						properties: rel.getProperties() ?? null,
					});
				}
			}
			return collected;
		},

		async upsertRelation(
			input: RelationCommand,
		): Promise<PlatformRelation | null> {
			let relType = await db.repositories.relationTypes.findByIdentifier(
				input.relationType,
			);
			if (!relType) {
				const entity = RelationType.create(
					input.relationType,
					`Relation ${input.relationType}`,
					"ui",
				);
				await db.repositories.relationTypes.save(entity);
				relType = await db.repositories.relationTypes.findByIdentifier(
					input.relationType,
				);
			}
			const relationTypeId = String(relType?.getId() ?? input.relationType);
			const created = await db.createRelation({
				tableId: input.tableId,
				sourceNodeId: input.sourceNodeId,
				targetNodeId: input.targetNodeId,
				relationTypeId,
				strength: input.strength,
				confidence: input.confidence,
			});
			notify("relations", input.tableId);
			return {
				id: created.relation.id,
				tableId: created.relation.tableId,
				sourceNodeId: created.relation.sourceNodeId ?? input.sourceNodeId,
				targetNodeId: created.relation.targetNodeId ?? input.targetNodeId,
				relationType: input.relationType,
				strength: created.relation.strength ?? null,
				confidence: created.relation.confidence ?? null,
				properties:
					(created.relation.properties as Record<string, unknown> | null) ??
					null,
			};
		},

		async deleteRelation(relationId: string): Promise<void> {
			await db.repositories.nodeRelations.delete(relationId as NodeRelationId);
			notify("relations");
		},

		async moveHierarchyNode(input: MoveHierarchyCommand): Promise<void> {
			const result = await db.hierarchy.moveHierarchyNode(
				input.nodeId,
				input.newParentId,
				input.relationType ?? "parentOf",
			);
			if (!result.success) {
				const reason = result.errors.map((e) => e.message).join("; ");
				throw new Error(reason || "Failed to reparent node");
			}
			notify("relations");
		},

		async queryTable(query: IaStructuredQuery) {
			return await db.ia.queryStructured({
				...query,
				facets: query.facets ?? "auto",
				includeBreadcrumbs: query.includeBreadcrumbs ?? true,
				includeTopicBreadcrumbs: query.includeTopicBreadcrumbs ?? true,
			});
		},

		async getOutline(opts: IaOutlineOptions) {
			return await db.ia.getOutline(opts);
		},

		async getDependencyGraph(
			opts: DependencyGraphQuery,
		): Promise<GraphSubgraph> {
			const queryRes = await db.ia.queryStructured({
				tableIdentifier: opts.tableIdentifier,
				limit: opts.limit ?? 100,
			});
			const relations = await this.listRelations(opts.tableIdentifier);
			const rows: PlatformRow[] = queryRes.hits.map((hit) => ({
				id: hit.node.id,
				tableId: hit.node.tableId,
				tableIdentifier: queryRes.tableIdentifier,
				title: hit.node.title ?? null,
				content: hit.node.content,
				attributes: hit.node.attributes ?? {},
			}));

			return computeGraphAnalytics(
				rows.map((r) => ({
					id: r.id,
					label: r.title || r.content.slice(0, 32) || `#${r.id}`,
					tableIdentifier: r.tableIdentifier,
				})),
				relations,
				opts.focusNodeId,
				opts.relationTypes,
			);
		},

		async auditArchitecture() {
			return await db.ia.auditArchitecture();
		},

		async remember(input: RememberInput) {
			const res = await db.aiMemory.remember(input);
			notify("memory");
			notify("rows", "ai_memories");
			return res;
		},

		async recall(input: RecallInput) {
			return await db.aiMemory.recall(input);
		},

		async consolidate(input: ConsolidateInput) {
			const res = await db.aiMemory.consolidate(input);
			notify("memory");
			notify("rows", "ai_memories");
			return res;
		},

		async getMemoryStats(namespace?: string): Promise<MemoryStatsOutput> {
			return await db.aiMemory.getStats(namespace);
		},

		async listSavedViews(): Promise<SavedViewConfig[]> {
			const table = await db.getTable(UI_VIEWS_TABLE_IDENTIFIER);
			if (!table) return [];
			const page = await db.repositories.nodes.findByTableId(
				table.id as TableId,
				{ limit: 100, offset: 0 },
			);
			const views: SavedViewConfig[] = [];
			for (const node of page.data ?? page.nodes ?? []) {
				const meta = node.getParsedMetadata() as {
					savedView?: SavedViewConfig;
				} | null;
				if (meta?.savedView) {
					views.push({
						...meta.savedView,
						id: String(node.getId()),
					});
				}
			}
			return views;
		},

		async saveView(view: SavedViewConfig): Promise<SavedViewConfig> {
			const tableId = await ensureUiViewsTable();
			const payload: SavedViewConfig = {
				...view,
				createdAt: view.createdAt ?? new Date().toISOString(),
			};
			const metadata = JSON.parse(
				JSON.stringify({ savedView: payload }),
			) as SafeJsonValue;
			const summaryContent = `Saved view: ${payload.name} (${payload.tableIdentifier}/${payload.viewType})`;
			const existing =
				view.id && !view.id.startsWith("tmp-") && (await db.getNode(view.id))
					? view.id
					: undefined;
			if (existing) {
				await db.updateNode(existing, {
					title: payload.name,
					content: summaryContent,
					metadata,
				});
				notify("views");
				return { ...payload, id: existing };
			}
			const created = await db.createNode({
				tableId,
				title: payload.name,
				content: summaryContent,
				metadata,
			});
			notify("views");
			return { ...payload, id: created.node.id };
		},

		async deleteSavedView(viewId: string): Promise<void> {
			await db.deleteNode(viewId);
			notify("views");
		},

		async saveSnapshot(key: string) {
			if (options.onSaveSnapshot) {
				const res = await options.onSaveSnapshot(key);
				notify("snapshot");
				return res;
			}
			const res = await db.saveSnapshot(key);
			notify("snapshot");
			return res;
		},

		...(options.onRestoreSnapshot
			? {
					async restoreSnapshot(key: string): Promise<void> {
						await options.onRestoreSnapshot?.(key);
						notify("schema");
						notify("rows");
						notify("relations");
						notify("memory");
						notify("snapshot");
					},
				}
			: {}),

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

export { getPresetBlueprint };
