import type {
	IaStructuredQueryResult,
	InformationArchitectureDeps,
} from "@/application/services/InformationArchitectureTypes.js";
import type { Attribute } from "@/domain/entities/Attribute.js";
import type { Node } from "@/domain/entities/Node.js";
import type { SafeJsonValue } from "@/shared/utils/safeJson.js";

export function serializeAttrValue(val: unknown): string {
	if (typeof val === "string") return val;
	if (typeof val === "number" || typeof val === "boolean") return String(val);
	return JSON.stringify(val);
}

export function canonicalJson(val: unknown): string {
	if (val === undefined) return "undefined";
	if (val === null || typeof val !== "object") return JSON.stringify(val);
	if (Array.isArray(val))
		return `[${val.map((item) => canonicalJson(item)).join(",")}]`;
	const entries = Object.entries(val as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => a.localeCompare(b));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function isPlainRecord(
	value: unknown,
): value is Record<string, SafeJsonValue> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractIaKey(node: Node): string | null {
	const parsed = node.getParsedMetadata();
	if (!isPlainRecord(parsed)) return null;
	return typeof parsed.iaKey === "string" && parsed.iaKey.length > 0
		? parsed.iaKey
		: null;
}

export function normalizeNodeMetadataForBlueprint(
	parsed: SafeJsonValue | null,
): Record<string, SafeJsonValue> | undefined {
	if (!isPlainRecord(parsed)) return undefined;
	const out: Record<string, SafeJsonValue> = {};
	for (const [k, v] of Object.entries(parsed)) {
		if (k === "iaKey") continue;
		out[k] = v;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

export function emptyStructuredResult(
	tableId: string,
	tableIdentifier: string,
	scopedRootId: string | undefined,
	subtreeCandidateCount: number,
): IaStructuredQueryResult {
	return {
		tableId,
		tableIdentifier,
		...(scopedRootId ? { scopedRootId } : {}),
		hits: [],
		total: 0,
		hasMore: false,
		facets: {},
		metrics: {
			eligibleCandidates: 0,
			graphCandidates: 0,
			lexicalCandidates: 0,
			vectorCandidates: 0,
			scannedVectors: 0,
			elapsedMs: 0,
			subtreeCandidateCount,
		},
	};
}

export async function collectFilteredNodeIds(
	deps: InformationArchitectureDeps,
	tableId: string,
	filterQuery: string,
): Promise<Set<string>> {
	const matched = new Set<string>();
	let offset = 0;
	while (true) {
		const page = await deps.hybridSearchNodesUseCase.execute({
			tableId,
			filterQuery,
			limit: 200,
			offset,
		});
		for (const hit of page.results) {
			matched.add(hit.node.id);
		}
		if (!page.hasMore || page.results.length === 0) break;
		offset += page.results.length;
	}
	return matched;
}

export async function loadTableNodesByIaKey(
	deps: InformationArchitectureDeps,
	tableId: string,
): Promise<Map<string, Node>> {
	const byKey = new Map<string, Node>();
	const page = await deps.nodeRepository.findByTableId(tableId, {
		limit: 5000,
		offset: 0,
	});
	for (const node of page.data ?? page.nodes ?? []) {
		const key = extractIaKey(node);
		if (key) byKey.set(key, node);
	}
	return byKey;
}

export async function loadTableAttrsList(
	deps: InformationArchitectureDeps,
	tableId: string,
): Promise<Attribute[]> {
	const page = await deps.attributeRepository.findByTableId(tableId, {
		limit: 500,
		offset: 0,
	});
	return page.data ?? page.nodes ?? [];
}

export async function loadNodeAttributesMap(
	deps: InformationArchitectureDeps,
	nodeId: string,
	tableAttrs: Attribute[],
): Promise<Record<string, unknown>> {
	const identByAttrId = new Map<string, string>();
	for (const attr of tableAttrs) {
		identByAttrId.set(String(attr.getId()), attr.getIdentifier());
	}
	const nodeAttrs = await deps.nodeAttributeRepository.findByNodeId(nodeId);
	const out: Record<string, unknown> = {};
	for (const na of nodeAttrs) {
		const ident = identByAttrId.get(String(na.getAttributeId()));
		if (ident) {
			out[ident] = na.getValue();
		}
	}
	return out;
}
