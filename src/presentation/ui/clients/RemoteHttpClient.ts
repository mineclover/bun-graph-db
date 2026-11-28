import type { PresetBlueprintName } from "@/application/blueprints/PresetBlueprints.js";
import type { NodeDto } from "@/application/dtos/NodeDto.js";
import type {
	ConsolidateInput,
	ConsolidateOutput,
	MemoryStatsOutput,
	RecallInput,
	RecallOutput,
	RememberInput,
	RememberOutput,
} from "@/application/services/AiMemoryService.js";
import type {
	AppliedBlueprintResult,
	ArchitectureAuditResult,
	BlueprintDiffResult,
	IaOutlineOptions,
	IaOutlineResult,
	IaStructuredQuery,
	IaStructuredQueryResult,
	InformationArchitectureBlueprint,
} from "@/application/services/InformationArchitectureTypes.js";
import type {
	ColumnConfig,
	TableColumnProfile,
} from "@/domain/value-objects/ColumnConfig.js";
import { LATEST_LEGACY_MCP_PROTOCOL_VERSION } from "@/mcp/http-server/modern-protocol.js";
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
	PlatformMode,
	PlatformRelation,
	PlatformRelationType,
	PlatformRow,
	PlatformTableSummary,
	RelationCommand,
	SavedViewConfig,
	UpdateRowCommand,
} from "@/presentation/ui/contracts.js";

export interface RemoteHttpClientOptions {
	baseUrl?: string;
	token?: string;
	mode?: Extract<PlatformMode, "remote-http" | "cloudflare-do">;
	fetchImpl?: typeof fetch;
}

interface ApiEnvelope<T = unknown> {
	success?: boolean;
	data?: T;
	error?: string;
}

export function createRemoteHttpClient(
	options: RemoteHttpClientOptions = {},
): IGraphPlatformClient {
	const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
	let authToken = options.token ?? "";
	const fetchImpl: typeof fetch =
		options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
	const listeners = new Set<
		(event: { scope: ChangeScope; tableId?: string }) => void
	>();
	let rpcId = 0;

	const notify = (scope: ChangeScope, tableId?: string): void => {
		for (const listener of listeners) {
			listener(tableId ? { scope, tableId } : { scope });
		}
	};

	const buildHeaders = (
		extra: Record<string, string> = {},
	): Record<string, string> => {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...extra,
		};
		if (authToken) {
			headers.Authorization = `Bearer ${authToken}`;
		}
		return headers;
	};

	const urlFor = (path: string): string =>
		baseUrl ? `${baseUrl}${path}` : path;

	const callApi = async <T = unknown>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> => {
		const res = await fetchImpl(urlFor(path), {
			method,
			headers: buildHeaders(),
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});
		const json = (await res.json()) as ApiEnvelope<T> & T;
		if (!res.ok || json.success === false) {
			throw new Error(
				json.error || `HTTP ${res.status} on ${method} ${path}`,
			);
		}
		return (json.data !== undefined ? json.data : json) as T;
	};

	const callMcp = async <T = unknown>(
		toolName: string,
		args: Record<string, unknown> = {},
	): Promise<T> => {
		rpcId += 1;
		const res = await fetchImpl(urlFor("/mcp"), {
			method: "POST",
			headers: buildHeaders({
				"MCP-Protocol-Version": LATEST_LEGACY_MCP_PROTOCOL_VERSION,
			}),
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: rpcId,
				method: "tools/call",
				params: {
					name: toolName,
					arguments: args,
				},
			}),
		});
		const payload = (await res.json()) as {
			result?: {
				isError?: boolean;
				structuredContent?: T;
				content?: Array<{ text?: string }>;
			};
			error?: { message?: string };
		};
		if (!res.ok || payload.error || payload.result?.isError) {
			const text = payload.result?.content?.[0]?.text;
			throw new Error(
				payload.error?.message || text || `MCP ${toolName} failed`,
			);
		}
		if (payload.result?.structuredContent !== undefined) {
			return payload.result.structuredContent;
		}
		const text = payload.result?.content?.[0]?.text;
		return (text ? JSON.parse(text) : {}) as T;
	};

	const callGraphql = async <T = unknown>(
		query: string,
		variables: Record<string, unknown> = {},
	): Promise<T> => {
		const res = await fetchImpl(urlFor("/graphql"), {
			method: "POST",
			headers: buildHeaders(),
			body: JSON.stringify({ query, variables }),
		});
		const json = (await res.json()) as {
			data?: T;
			errors?: Array<{ message: string }>;
		};
		if (!res.ok || json.errors?.length) {
			throw new Error(
				json.errors?.[0]?.message || `GraphQL error (${res.status})`,
			);
		}
		return json.data as T;
	};

	const ensureUiViewsTable = async (): Promise<string> => {
		const listRes = await callApi<{
			tables?: Array<{ id: string; identifier: string }>;
		}>("GET", "/api/tables?limit=100");
		const existing = listRes.tables?.find(
			(t) => t.identifier === UI_VIEWS_TABLE_IDENTIFIER,
		);
		if (existing) return existing.id;
		const created = await callApi<{ table?: { id: string }; id?: string }>(
			"POST",
			"/api/tables",
			{
				identifier: UI_VIEWS_TABLE_IDENTIFIER,
				description: "Platform Saved View definitions (SSOT)",
			},
		);
		return created.table?.id ?? created.id ?? UI_VIEWS_TABLE_IDENTIFIER;
	};

	return {
		mode: options.mode ?? "remote-http",

		setAuthToken(token: string) {
			authToken = token.trim();
		},

		getAuthToken() {
			return authToken;
		},

		async inspectArchitecture(): Promise<PlatformTableSummary[]> {
			const [tablesRes, auditRes] = await Promise.all([
				callApi<{
					tables?: Array<{
						id: string;
						identifier: string;
						description: string | null;
					}>;
				}>("GET", "/api/tables?limit=100"),
				callMcp<ArchitectureAuditResult>("ia-audit", {}).catch(() => null),
			]);

			const auditById = new Map(
				(auditRes?.tables ?? []).map((t) => [t.identifier, t]),
			);
			return (tablesRes.tables ?? []).map((t) => {
				const audited = auditById.get(t.identifier);
				return {
					id: t.id,
					identifier: t.identifier,
					description: t.description ?? null,
					attributeCount: audited?.attributeCount ?? 0,
					nodeCount: audited?.nodeCount ?? 0,
					treeValidation: audited?.hierarchyValidation,
				};
			});
		},

		async getTableColumns(
			tableIdOrIdentifier: string,
		): Promise<TableColumnProfile> {
			try {
				return await callApi<TableColumnProfile>(
					"GET",
					`/api/tables/${encodeURIComponent(tableIdOrIdentifier)}/columns`,
				);
			} catch {
				return await callMcp<TableColumnProfile>("ia-get-columns", {
					tableIdentifier: tableIdOrIdentifier,
				});
			}
		},

		async configureColumn(
			tableIdOrIdentifier: string,
			attributeIdentifier: string,
			config: ColumnConfig,
		): Promise<void> {
			await callApi(
				"PUT",
				`/api/tables/${encodeURIComponent(tableIdOrIdentifier)}/columns/${encodeURIComponent(attributeIdentifier)}`,
				{ config },
			);
			notify("schema", tableIdOrIdentifier);
		},

		async applyPreset(
			preset: PresetBlueprintName,
		): Promise<AppliedBlueprintResult> {
			const res = await callMcp<AppliedBlueprintResult>("ia-apply-blueprint", {
				preset,
			});
			notify("schema");
			notify("rows");
			return res;
		},

		async applyBlueprint(
			bp: InformationArchitectureBlueprint,
		): Promise<AppliedBlueprintResult> {
			const res = await callMcp<AppliedBlueprintResult>("ia-apply-blueprint", {
				blueprint: bp,
			});
			notify("schema");
			notify("rows");
			return res;
		},

		async diffBlueprint(
			_bp: InformationArchitectureBlueprint,
		): Promise<BlueprintDiffResult> {
			throw new Error(
				"diffBlueprint over Remote HTTP is not yet exposed by MCP tools",
			);
		},

		async validateRow(columns, draft, isCreate = false) {
			return validateRowDraft(columns, draft, isCreate);
		},

	async createRow(input: CreateRowCommand): Promise<NodeDto> {
			let resolvedTableId = input.tableId;
			if (!resolvedTableId && input.tableIdentifier) {
				const tables = await this.inspectArchitecture();
				const match = tables.find(
					(t) => t.identifier === input.tableIdentifier,
				);
				if (match) resolvedTableId = match.id;
			}
			const created = await callApi<NodeDto>("POST", "/api/nodes", {
				tableId: resolvedTableId,
				content: input.content,
				title: input.title ?? undefined,
				description: input.description ?? undefined,
				...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
				attributes: input.attributes,
			});
			notify("rows", input.tableIdentifier ?? resolvedTableId);
			return created;
		},

		async updateRow(nodeId: string, patch: UpdateRowCommand): Promise<NodeDto> {
			const updated = await callApi<NodeDto>(
				"PUT",
				`/api/nodes/${encodeURIComponent(nodeId)}`,
				{
					tableId: patch.tableId,
					tableIdentifier: patch.tableIdentifier,
					content: patch.content,
					title: patch.title ?? undefined,
					description: patch.description ?? undefined,
					...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
					attributes: patch.attributes,
				},
			);
			notify("rows", patch.tableIdentifier ?? updated.tableId);
			return updated;
		},

		async deleteRow(nodeId: string): Promise<void> {
			await callApi("DELETE", `/api/nodes/${encodeURIComponent(nodeId)}`);
			notify("rows");
		},

		async listRelationTypes(): Promise<PlatformRelationType[]> {
			const res = await callApi<{
				relationTypes?: PlatformRelationType[];
			}>("GET", "/api/relation-types?limit=200");
			return res.relationTypes ?? [];
		},

		async listRelations(
			tableIdOrIdentifier?: string,
		): Promise<PlatformRelation[]> {
			const [relTypes, tables] = await Promise.all([
				this.listRelationTypes(),
				this.inspectArchitecture(),
			]);
			const typeById = new Map(relTypes.map((rt) => [rt.id, rt.identifier]));
			const targetTables = tableIdOrIdentifier
				? tables.filter(
						(t) =>
							t.id === tableIdOrIdentifier ||
							t.identifier === tableIdOrIdentifier,
					)
				: tables;

			const seen = new Set<string>();
			const relations: PlatformRelation[] = [];
			for (const t of targetTables) {
				const res = await callApi<{
					relations?: Array<{
						id: string;
						sourceNodeId: string;
						targetNodeId: string;
						relationTypeId: string;
						tableId: string;
						strength?: number | null;
						confidence?: number | null;
						properties?: Record<string, unknown> | null;
					}>;
				}>(
					"GET",
					`/api/relations/search?tableId=${encodeURIComponent(t.id)}&limit=500`,
				);
				for (const rel of res.relations ?? []) {
					if (seen.has(rel.id)) continue;
					seen.add(rel.id);
					relations.push({
						id: String(rel.id),
						tableId: String(rel.tableId),
						sourceNodeId: String(rel.sourceNodeId),
						targetNodeId: String(rel.targetNodeId),
						relationType:
							typeById.get(String(rel.relationTypeId)) ??
							String(rel.relationTypeId),
						strength: rel.strength ?? null,
						confidence: rel.confidence ?? null,
						properties: rel.properties ?? null,
					});
				}
			}
			return relations;
		},

		async upsertRelation(
			input: RelationCommand,
		): Promise<PlatformRelation | null> {
			const types = await this.listRelationTypes();
			let match = types.find((rt) => rt.identifier === input.relationType);
			if (!match) {
				match = await callApi<PlatformRelationType>(
					"POST",
					"/api/relation-types",
					{
						identifier: input.relationType,
						description: `Relation ${input.relationType}`,
						category: "ui",
					},
				);
			}
			const created = await callApi<{
				id: string;
				tableId: string;
				sourceNodeId: string;
				targetNodeId: string;
				relationType?: string;
				strength?: number | null;
				confidence?: number | null;
				properties?: Record<string, unknown> | null;
			}>("POST", "/api/relations", {
				tableId: input.tableId,
				sourceNodeId: input.sourceNodeId,
				targetNodeId: input.targetNodeId,
				relationTypeId: match.id,
				strength: input.strength,
				confidence: input.confidence,
			});
			notify("relations", input.tableId);
			return {
				id: String(created.id),
				tableId: String(created.tableId),
				sourceNodeId: String(created.sourceNodeId),
				targetNodeId: String(created.targetNodeId),
				relationType: created.relationType ?? input.relationType,
				strength: created.strength ?? null,
				confidence: created.confidence ?? null,
				properties: created.properties ?? null,
			};
		},

		async deleteRelation(relationId: string): Promise<void> {
			await callApi(
				"DELETE",
				`/api/relations/${encodeURIComponent(relationId)}`,
			);
			notify("relations");
		},

		async moveHierarchyNode(input: MoveHierarchyCommand): Promise<void> {
			const data = await callGraphql<{
				moveHierarchyNode: {
					success: boolean;
					errors?: Array<{ message: string }>;
				};
			}>(
				`mutation MoveNode($input: MoveHierarchyNodeInput!) {
					moveHierarchyNode(input: $input) {
						success
						errors { message }
					}
				}`,
				{
					input: {
						nodeId: input.nodeId,
						newParentId: input.newParentId,
						relationTypeId: input.relationType ?? "parentOf",
					},
				},
			);
			if (!data.moveHierarchyNode.success) {
				const msg = (data.moveHierarchyNode.errors ?? [])
					.map((e) => e.message)
					.join("; ");
				throw new Error(msg || "Failed to move hierarchy node");
			}
			notify("relations");
		},

		async queryTable(
			query: IaStructuredQuery,
		): Promise<IaStructuredQueryResult> {
			const { facets, ...rest } = query;
			return await callMcp<IaStructuredQueryResult>("ia-query-structured", {
				...rest,
				...(Array.isArray(facets)
					? { facets }
					: facets === "auto" || facets === undefined
						? { autoFacets: true }
						: {}),
				includeBreadcrumbs: query.includeBreadcrumbs ?? true,
				includeTopicBreadcrumbs: query.includeTopicBreadcrumbs ?? true,
			});
		},

		async getOutline(opts: IaOutlineOptions): Promise<IaOutlineResult> {
			return await callMcp<IaOutlineResult>(
				"ia-get-outline",
				opts as unknown as Record<string, unknown>,
			);
		},

		async getDependencyGraph(
			opts: DependencyGraphQuery,
		): Promise<GraphSubgraph> {
			const [queryRes, relations] = await Promise.all([
				this.queryTable({
					tableIdentifier: opts.tableIdentifier,
					limit: opts.limit ?? 100,
				}),
				this.listRelations(opts.tableIdentifier),
			]);
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

		async auditArchitecture(): Promise<ArchitectureAuditResult> {
			return await callMcp<ArchitectureAuditResult>("ia-audit", {});
		},

		async remember(input: RememberInput): Promise<RememberOutput> {
			const res = await callMcp<RememberOutput>(
				"memory-remember",
				input as unknown as Record<string, unknown>,
			);
			notify("memory");
			notify("rows", "ai_memories");
			return res;
		},

		async recall(input: RecallInput): Promise<RecallOutput> {
			return await callMcp<RecallOutput>(
				"memory-recall",
				input as unknown as Record<string, unknown>,
			);
		},

		async consolidate(input: ConsolidateInput): Promise<ConsolidateOutput> {
			const res = await callMcp<ConsolidateOutput>(
				"memory-consolidate",
				input as unknown as Record<string, unknown>,
			);
			notify("memory");
			notify("rows", "ai_memories");
			return res;
		},

		async getMemoryStats(namespace?: string): Promise<MemoryStatsOutput> {
			const recallRes = await this.recall({
				namespace,
				includeSuperseded: true,
				limit: 100,
			});
			const byKind: MemoryStatsOutput["byKind"] = {
				working: 0,
				episodic: 0,
				semantic: 0,
				procedural: 0,
			};
			const byStatus: MemoryStatsOutput["byStatus"] = {
				active: 0,
				consolidated: 0,
				superseded: 0,
				archived: 0,
			};
			const topics = new Set<string>();
			for (const hit of recallRes.hits) {
				byKind[hit.memory.kind] = (byKind[hit.memory.kind] ?? 0) + 1;
				byStatus[hit.memory.status] = (byStatus[hit.memory.status] ?? 0) + 1;
				for (const t of hit.memory.topicPath ?? []) topics.add(t);
			}
			return {
				total: recallRes.hits.length,
				byKind,
				byStatus,
				embeddedCount: recallRes.hits.length,
				topicCount: topics.size,
			};
		},

		async listSavedViews(): Promise<SavedViewConfig[]> {
			const tables = await this.inspectArchitecture();
			const viewTable = tables.find(
				(t) => t.identifier === UI_VIEWS_TABLE_IDENTIFIER,
			);
			if (!viewTable) return [];
			const res = await this.queryTable({
				tableIdentifier: UI_VIEWS_TABLE_IDENTIFIER,
				limit: 100,
			});
			const views: SavedViewConfig[] = [];
			for (const hit of res.hits ?? []) {
				const meta = hit.node.metadata as {
					savedView?: SavedViewConfig;
				} | null;
				if (meta?.savedView) {
					views.push({ ...meta.savedView, id: hit.node.id });
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
			) as Record<string, unknown>;
			const summaryContent = `Saved view: ${payload.name} (${payload.tableIdentifier}/${payload.viewType})`;
			if (view.id && !view.id.startsWith("tmp-")) {
				try {
					const updated = await this.updateRow(view.id, {
						title: payload.name,
						content: summaryContent,
						metadata,
					});
					notify("views");
					return { ...payload, id: updated.id };
				} catch {
					// Fall through to create
				}
			}
			const created = await this.createRow({
				tableId,
				tableIdentifier: UI_VIEWS_TABLE_IDENTIFIER,
				title: payload.name,
				content: summaryContent,
				metadata,
			});
			notify("views");
			return { ...payload, id: created.id };
		},

		async deleteSavedView(viewId: string): Promise<void> {
			await this.deleteRow(viewId);
			notify("views");
		},

		async getHealth() {
			return await callApi<Record<string, unknown>>("GET", "/health");
		},

		async getMetricsJson() {
			return await callApi<Record<string, unknown>>(
				"GET",
				"/metrics?format=json",
			);
		},

		async getAuditLog(limit = 50) {
			return await callApi<Record<string, unknown>>(
				"GET",
				`/api/audit-log?limit=${limit}`,
			);
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
