export const BUN_GRAPH_DB_API_VERSION = "1.0.0";

export const RESERVED_TABLE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
	"search",
	"docs",
]);
export const RESERVED_NODE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
	"search",
	"shortest-path",
	"hybrid-search",
]);
export const RESERVED_RELATION_PATH_SEGMENTS: ReadonlySet<string> = new Set([
	"search",
]);

const TABLE_PATH_REGEX = /^\/api\/tables\/([^/]+)(?:\/|$)/;
const EXACT_TABLE_PATH_REGEX = /^\/api\/tables\/([^/]+)$/;
const NODE_PATH_REGEX = /^\/api\/nodes\/([^/]+)(?:\/|$)/;
const EXACT_NODE_PATH_REGEX = /^\/api\/nodes\/([^/]+)$/;
const ATTR_TABLE_PATH_REGEX = /^\/api\/attributes\/tables\/([^/]+)$/;
const EXACT_RELATION_PATH_REGEX = /^\/api\/relations\/([^/]+)$/;

function decodePathParam(
	raw: string | undefined,
	reserved?: ReadonlySet<string>,
): string | undefined {
	if (!raw) return undefined;
	const decoded = decodeURIComponent(raw);
	if (!decoded || reserved?.has(decoded)) return undefined;
	return decoded;
}

export function extractRestTablePathParam(
	pathname: string,
): string | undefined {
	return decodePathParam(
		pathname.match(TABLE_PATH_REGEX)?.[1],
		RESERVED_TABLE_PATH_SEGMENTS,
	);
}

export function extractRestExactTableId(pathname: string): string | undefined {
	return decodePathParam(
		pathname.match(EXACT_TABLE_PATH_REGEX)?.[1],
		RESERVED_TABLE_PATH_SEGMENTS,
	);
}

export function extractRestNodePathParam(pathname: string): string | undefined {
	return decodePathParam(
		pathname.match(NODE_PATH_REGEX)?.[1],
		RESERVED_NODE_PATH_SEGMENTS,
	);
}

export function extractRestExactNodeId(pathname: string): string | undefined {
	return decodePathParam(
		pathname.match(EXACT_NODE_PATH_REGEX)?.[1],
		RESERVED_NODE_PATH_SEGMENTS,
	);
}

export function extractRestAttributeTableId(
	pathname: string,
): string | undefined {
	return decodePathParam(pathname.match(ATTR_TABLE_PATH_REGEX)?.[1]);
}

export function extractRestExactRelationId(
	pathname: string,
): string | undefined {
	return decodePathParam(
		pathname.match(EXACT_RELATION_PATH_REGEX)?.[1],
		RESERVED_RELATION_PATH_SEGMENTS,
	);
}

export function isRestReadOnlyOperation(
	method: string,
	pathname: string,
): boolean {
	const upper = method.toUpperCase();
	return (
		upper === "GET" ||
		upper === "HEAD" ||
		upper === "OPTIONS" ||
		(upper === "POST" &&
			(pathname === "/api/nodes/hybrid-search" ||
				pathname === "/api/nodes/shortest-path"))
	);
}

export function isRestAdminRoute(method: string, pathname: string): boolean {
	const upper = method.toUpperCase();
	return (
		pathname === "/tabular-sync" ||
		pathname.startsWith("/api/tabular-sync") ||
		pathname.startsWith("/api/mcp-tools") ||
		pathname === "/api/openapi" ||
		pathname === "/api/stats" ||
		pathname === "/api/audit-log" ||
		pathname.startsWith("/api/template-files") ||
		pathname.startsWith("/api/templates") ||
		(pathname === "/api/tables" && upper !== "GET") ||
		(upper === "DELETE" && Boolean(extractRestExactTableId(pathname))) ||
		(upper === "POST" && pathname === "/api/relation-types")
	);
}
