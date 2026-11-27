const runtimeEnv: Record<string, string | undefined> =
	typeof process !== "undefined" && process?.env ? process.env : {};

const databaseDebugEnabled =
	runtimeEnv.BUN_GRAPH_DB_DATABASE_DEBUG === "1" ||
	runtimeEnv.BUN_GRAPH_DB_DATABASE_DEBUG === "true";
const mcpDebugEnabled =
	runtimeEnv.BUN_GRAPH_DB_MCP_DEBUG === "1" ||
	runtimeEnv.BUN_GRAPH_DB_MCP_DEBUG === "true";
const applicationDebugEnabled =
	runtimeEnv.BUN_GRAPH_DB_DEBUG === "1" ||
	runtimeEnv.BUN_GRAPH_DB_DEBUG === "true" ||
	runtimeEnv.BUN_GRAPH_DB_APPLICATION_DEBUG === "1" ||
	runtimeEnv.BUN_GRAPH_DB_APPLICATION_DEBUG === "true";

/** Lazily emits application diagnostics only when explicitly enabled. */
export function debugApplication(
	message: string,
	details?: () => unknown,
): void {
	if (!applicationDebugEnabled) return;
	if (details) {
		console.debug(`[application] ${message}`, details());
	} else {
		console.debug(`[application] ${message}`);
	}
}

/** Lazily emits database diagnostics only when explicitly enabled. */
export function debugDatabase(message: string, details?: () => unknown): void {
	if (!databaseDebugEnabled) return;
	if (details) {
		console.debug(`[database] ${message}`, details());
	} else {
		console.debug(`[database] ${message}`);
	}
}

/** Lazily emits MCP diagnostics only when explicitly enabled. */
export function debugMcp(message: string, details?: () => unknown): void {
	if (!mcpDebugEnabled) return;
	if (details) {
		console.debug(`[mcp] ${message}`, details());
	} else {
		console.debug(`[mcp] ${message}`);
	}
}
