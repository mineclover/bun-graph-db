import type {
	TableColumnProfile,
	TableColumnSummary,
} from "@/domain/value-objects/ColumnConfig.js";
import type {
	GraphSubgraph,
	GraphSubgraphEdge,
	GraphSubgraphNode,
	PlatformRelation,
	PlatformRow,
	PlatformValidationIssue,
	PlatformValidationReport,
} from "@/presentation/ui/contracts.js";

export const UI_VIEWS_TABLE_IDENTIFIER = "ui_views";

export function validateRowDraft(
	columns: readonly TableColumnSummary[],
	draft: { content?: string; attributes?: Record<string, unknown> },
	isCreate = false,
): PlatformValidationReport {
	const issues: PlatformValidationIssue[] = [];
	const attributes = draft.attributes ?? {};

	if (
		isCreate &&
		(typeof draft.content !== "string" || draft.content.trim().length === 0)
	) {
		issues.push({
			field: "content",
			message: "Content is required",
		});
	}

	for (const column of columns) {
		const rawValue = attributes[column.identifier];
		const isEmpty =
			rawValue === undefined ||
			rawValue === null ||
			(typeof rawValue === "string" && rawValue.trim().length === 0);

		if (column.isRequired && isEmpty && column.config.defaultValue === undefined) {
			issues.push({
				field: column.identifier,
				message: `${column.name || column.identifier} is required`,
			});
			continue;
		}

		if (isEmpty) continue;

		if (
			column.config.enumValues &&
			column.config.enumValues.length > 0 &&
			!column.config.enumValues.includes(String(rawValue))
		) {
			issues.push({
				field: column.identifier,
				message: `Must be one of: ${column.config.enumValues.join(", ")}`,
			});
		}

		if (
			column.config.role === "priority" ||
			column.config.role === "metric"
		) {
			const numeric = Number(rawValue);
			if (!Number.isFinite(numeric)) {
				issues.push({
					field: column.identifier,
					message: `${column.name || column.identifier} must be a finite number`,
				});
			}
		}
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}

export function buildFallbackColumnProfile(
	tableId: string,
	tableIdentifier: string,
	rows: readonly PlatformRow[],
): TableColumnProfile {
	const seenKeys = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row.attributes ?? {})) {
			seenKeys.add(key);
		}
	}
	const sortedKeys = [...seenKeys].sort();
	const columns: TableColumnSummary[] = sortedKeys.map((key, index) => ({
		id: key,
		identifier: key,
		name: key,
		description: null,
		attributeTypeId: "string",
		isRequired: false,
		config: { displayOrder: index + 1, filterable: true, sortable: true },
	}));

	return {
		tableId,
		tableIdentifier,
		columns,
		facetableColumns: [],
		searchableColumns: [...sortedKeys],
		sortableColumns: [...sortedKeys],
		filterableColumns: [...sortedKeys],
		visibleColumns: [...sortedKeys],
		hiddenColumns: [],
		enumConstraints: {},
		defaultValues: {},
		embeddingColumns: [],
	};
}

export function computeGraphAnalytics(
	inputNodes: ReadonlyArray<{
		id: string;
		label: string;
		tableIdentifier: string;
	}>,
	inputRelations: readonly PlatformRelation[],
	focusNodeId?: string,
	allowedRelationTypes?: readonly string[],
): GraphSubgraph {
	const availableRelationTypes = [
		...new Set(inputRelations.map((r) => r.relationType).filter(Boolean)),
	].sort();
	const typeFilter =
		allowedRelationTypes && allowedRelationTypes.length > 0
			? new Set(allowedRelationTypes)
			: null;

	const nodeMap = new Map<
		string,
		{ id: string; label: string; tableIdentifier: string }
	>();
	for (const n of inputNodes) {
		nodeMap.set(n.id, n);
	}

	const edges: GraphSubgraphEdge[] = [];
	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();
	const degreeMap = new Map<string, number>();

	for (const n of nodeMap.keys()) {
		outgoing.set(n, []);
		incoming.set(n, []);
		degreeMap.set(n, 0);
	}

	for (const rel of inputRelations) {
		if (typeFilter && !typeFilter.has(rel.relationType)) continue;
		if (!nodeMap.has(rel.sourceNodeId)) {
			nodeMap.set(rel.sourceNodeId, {
				id: rel.sourceNodeId,
				label: `Node #${rel.sourceNodeId}`,
				tableIdentifier: rel.tableId,
			});
			outgoing.set(rel.sourceNodeId, []);
			incoming.set(rel.sourceNodeId, []);
			degreeMap.set(rel.sourceNodeId, 0);
		}
		if (!nodeMap.has(rel.targetNodeId)) {
			nodeMap.set(rel.targetNodeId, {
				id: rel.targetNodeId,
				label: `Node #${rel.targetNodeId}`,
				tableIdentifier: rel.tableId,
			});
			outgoing.set(rel.targetNodeId, []);
			incoming.set(rel.targetNodeId, []);
			degreeMap.set(rel.targetNodeId, 0);
		}

		edges.push({
			id: rel.id,
			sourceId: rel.sourceNodeId,
			targetId: rel.targetNodeId,
			relationType: rel.relationType,
			strength: rel.strength ?? null,
		});
		outgoing.get(rel.sourceNodeId)?.push(rel.targetNodeId);
		incoming.get(rel.targetNodeId)?.push(rel.sourceNodeId);
		degreeMap.set(rel.sourceNodeId, (degreeMap.get(rel.sourceNodeId) ?? 0) + 1);
		degreeMap.set(rel.targetNodeId, (degreeMap.get(rel.targetNodeId) ?? 0) + 1);
	}

	const nodeIds = [...nodeMap.keys()];
	const count = nodeIds.length;

	// Iterative PageRank (damping = 0.85, 20 iterations)
	const rank = new Map<string, number>();
	if (count > 0) {
		const initial = 1 / count;
		for (const id of nodeIds) rank.set(id, initial);

		const damping = 0.85;
		for (let iter = 0; iter < 20; iter += 1) {
			const next = new Map<string, number>();
			let danglingSum = 0;
			for (const id of nodeIds) {
				if ((outgoing.get(id)?.length ?? 0) === 0) {
					danglingSum += rank.get(id) ?? 0;
				}
			}
			const baseRank = (1 - damping) / count + (damping * danglingSum) / count;
			for (const id of nodeIds) {
				let sum = baseRank;
				for (const src of incoming.get(id) ?? []) {
					const outDegree = outgoing.get(src)?.length ?? 1;
					sum += (damping * (rank.get(src) ?? 0)) / outDegree;
				}
				next.set(id, sum);
			}
			for (const [id, val] of next.entries()) {
				rank.set(id, val);
			}
		}
	}

	// Tarjan Strongly Connected Components
	const sccCluster = new Map<string, number>();
	let currentIndex = 0;
	let clusterCounter = 0;
	const indices = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];

	const strongConnect = (v: string): void => {
		indices.set(v, currentIndex);
		lowlink.set(v, currentIndex);
		currentIndex += 1;
		stack.push(v);
		onStack.add(v);

		for (const w of outgoing.get(v) ?? []) {
			if (!indices.has(w)) {
				strongConnect(w);
				lowlink.set(
					v,
					Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0),
				);
			} else if (onStack.has(w)) {
				lowlink.set(v, Math.min(lowlink.get(v) ?? 0, indices.get(w) ?? 0));
			}
		}

		if (lowlink.get(v) === indices.get(v)) {
			clusterCounter += 1;
			while (stack.length > 0) {
				const w = stack.pop();
				if (!w) break;
				onStack.delete(w);
				sccCluster.set(w, clusterCounter);
				if (w === v) break;
			}
		}
	};

	for (const id of nodeIds) {
		if (!indices.has(id)) {
			strongConnect(id);
		}
	}

	// Impact set: bidirectional BFS around focusNodeId (if provided)
	const impactSet = new Set<string>();
	if (focusNodeId && nodeMap.has(focusNodeId)) {
		const walk = (adj: Map<string, string[]>, start: string): void => {
			const queue: string[] = [start];
			impactSet.add(start);
			while (queue.length > 0) {
				const cur = queue.shift();
				if (!cur) continue;
				for (const nxt of adj.get(cur) ?? []) {
					if (!impactSet.has(nxt)) {
						impactSet.add(nxt);
						queue.push(nxt);
					}
				}
			}
		};
		walk(outgoing, focusNodeId);
		walk(incoming, focusNodeId);
	}

	const nodes: GraphSubgraphNode[] = nodeIds.map((id) => {
		const info = nodeMap.get(id) ?? {
			id,
			label: id,
			tableIdentifier: "",
		};
		return {
			id,
			label: info.label,
			tableIdentifier: info.tableIdentifier,
			pageRank: Number((rank.get(id) ?? 0).toFixed(4)),
			sccClusterId: sccCluster.get(id) ?? 0,
			inImpactSet: impactSet.has(id),
			degree: degreeMap.get(id) ?? 0,
		};
	});

	return {
		nodes,
		edges,
		...(focusNodeId && nodeMap.has(focusNodeId) ? { focusNodeId } : {}),
		impactNodeIds: [...impactSet],
		relationTypes: availableRelationTypes,
	};
}
