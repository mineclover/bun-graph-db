import {
	extractRestAttributeTableId,
	extractRestExactRelationId,
	extractRestNodePathParam,
	extractRestTablePathParam,
	isRestAdminRoute,
	isRestReadOnlyOperation,
} from "@/core/contracts/RestRouteContract.js";
import { constantTimeEqual } from "@/shared/utils/portableHash.js";
import {
	type SecurityAuditEvent,
	type SecurityAuditListOptions,
	SecurityAuditLog,
} from "./SecurityAuditLog.js";

export type {
	SecurityAuditEvent,
	SecurityAuditListOptions,
} from "./SecurityAuditLog.js";
export { SecurityAuditLog } from "./SecurityAuditLog.js";

const accessTextEncoder = new TextEncoder();
const accessTextDecoder = new TextDecoder();

import { type DocumentNode, Kind, parse, type ValueNode, visit } from "graphql";
import type { ILogger } from "../ports/ILogger.js";

export type AccessRole = "reader" | "writer" | "admin";
export type AccessAction = "read" | "write" | "admin";

export interface AccessPrincipal {
	id: string;
	role: AccessRole;
	tableIds: readonly string[];
	expiresAt?: string | number;
}

export interface AccessRequirement {
	action: AccessAction;
	endpoint: string;
	tableId?: string;
	tableIds?: readonly string[];
	/** A table-owned resource was referenced but its owner could not be resolved. */
	unresolvedTableScopedResource?: boolean;
	/** The endpoint exposes or mutates global state rather than a table-scoped resource. */
	requiresGlobalScope?: boolean;
	requestBytes?: number;
	graphqlComplexity?: number;
}

export interface AllowedAccessDecision {
	allowed: true;
	principal?: AccessPrincipal;
}

export interface DeniedAccessDecision {
	allowed: false;
	status: 400 | 401 | 403 | 404 | 413 | 429;
	code:
		| "authentication_required"
		| "invalid_credentials"
		| "forbidden"
		| "not_found"
		| "rate_limited"
		| "request_too_large"
		| "query_too_complex";
}

export type AccessDecision = AllowedAccessDecision | DeniedAccessDecision;

interface AccessTokenDefinition {
	id?: string;
	role?: AccessRole;
	tableIds?: string[];
	expiresAt?: string | number;
}

export interface ExternalResourceAccessResolver {
	/** Resolve a node's owning table before dispatching an external request. */
	resolveNodeTableId?: (nodeId: string) => Promise<string | undefined>;
	/** Resolve a relation's owning table before dispatching an external request. */
	resolveRelationTableId?: (relationId: string) => Promise<string | undefined>;
	/**
	 * Resolve a table ID or identifier to its canonical `{ id, identifier }` pair
	 * so table-scoped tokens configured with either numeric IDs or identifiers
	 * match requests referencing `tableId`, `tableIdentifier`, or `nodeId`.
	 */
	resolveTableIdentity?: (
		tableIdOrIdentifier: string,
	) => Promise<{ id: string; identifier: string } | undefined>;
}

interface RateLimitBucket {
	count: number;
	resetAt: number;
}

export interface AccessControlOptions {
	enabled: boolean;
	tokens: ReadonlyMap<string, AccessPrincipal>;
	allowedOrigins: readonly string[];
	rateLimit: {
		enabled: boolean;
		max: number;
		windowMs: number;
	};
	maxRequestBytes: number;
	maxGraphqlComplexity: number;
	logger?: ILogger;
	auditLog?: SecurityAuditLog;
	onAuditEvent?: (event: SecurityAuditEvent) => void;
}

const roleRank: Record<AccessRole, number> = {
	reader: 1,
	writer: 2,
	admin: 3,
};

function parseBoolean(
	value: string | undefined,
	defaultValue: boolean,
): boolean {
	if (value === undefined) return defaultValue;
	return value === "true";
}

function parsePositiveInteger(
	value: string | undefined,
	defaultValue: number,
): number {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseAccessTokens(
	env: Record<string, string | undefined>,
): Map<string, AccessPrincipal> {
	const configured = env.BUN_GRAPH_DB_ACCESS_TOKENS;
	const legacyAdminToken = env.BUN_GRAPH_DB_API_TOKEN;
	const tokens = new Map<string, AccessPrincipal>();

	if (configured) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(configured);
		} catch {
			throw new Error("BUN_GRAPH_DB_ACCESS_TOKENS must be valid JSON.");
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error(
				"BUN_GRAPH_DB_ACCESS_TOKENS must map credential strings to access definitions.",
			);
		}

		for (const [token, definition] of Object.entries(
			parsed as Record<string, unknown>,
		)) {
			if (
				!token ||
				!definition ||
				typeof definition !== "object" ||
				Array.isArray(definition)
			) {
				throw new Error(
					"Every BUN_GRAPH_DB_ACCESS_TOKENS entry must contain a non-empty token and object definition.",
				);
			}

			const typed = definition as AccessTokenDefinition;
			const role = typed.role || "reader";
			if (!(role in roleRank)) {
				throw new Error(`Unsupported access role: ${String(typed.role)}`);
			}
			if (
				typed.tableIds !== undefined &&
				(!Array.isArray(typed.tableIds) ||
					typed.tableIds.some((value) => typeof value !== "string"))
			) {
				throw new Error("Access token tableIds must be an array of strings.");
			}

			if (typed.expiresAt !== undefined) {
				const expMs =
					typeof typed.expiresAt === "number"
						? typed.expiresAt
						: Date.parse(typed.expiresAt);
				if (!Number.isFinite(expMs)) {
					throw new Error(
						`Invalid expiresAt value for access token '${typed.id ?? token}': ${String(typed.expiresAt)}`,
					);
				}
			}

			tokens.set(token, {
				id: typed.id?.trim() || `token-${tokens.size + 1}`,
				role,
				tableIds: typed.tableIds
					?.map((value) => value.trim())
					.filter(Boolean) ?? ["*"],
				...(typed.expiresAt !== undefined
					? { expiresAt: typed.expiresAt }
					: {}),
			});
		}
	}

	if (legacyAdminToken) {
		tokens.set(legacyAdminToken, {
			id: "legacy-admin",
			role: "admin",
			tableIds: ["*"],
		});
	}

	// Per-process capability for MCP's authenticated loopback bridge. It goes
	// through the ordinary Bearer credential path and is never inferred from an
	// address or forgeable X-* header.
	const internalBridgeToken = env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN?.trim();
	if (internalBridgeToken) {
		tokens.set(internalBridgeToken, {
			id: "internal-mcp-bridge",
			role: "admin",
			tableIds: ["*"],
		});
	}

	return tokens;
}

interface CompiledTokenEntry {
	bytes: Uint8Array;
	principal: AccessPrincipal;
	expiresAtMs?: number;
}

function parseExpirationMs(expiresAt?: string | number): number | undefined {
	if (expiresAt === undefined) return undefined;
	const ms = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
	if (!Number.isFinite(ms)) {
		throw new Error(`Invalid expiresAt value: ${String(expiresAt)}`);
	}
	return ms;
}

const RATE_LIMIT_PRUNE_THRESHOLD = 1024;
const RATE_LIMIT_MAX_BUCKETS = 4096;

function credentialFrom(request: Request): string | undefined {
	const authorization = request.headers.get("Authorization");
	if (authorization?.startsWith("Bearer "))
		return authorization.slice("Bearer ".length).trim();
	return request.headers.get("X-API-Key")?.trim() || undefined;
}

function requestIdentity(
	request: Request,
	principal?: AccessPrincipal,
): string {
	if (principal) return `principal:${principal.id}`;
	const forwarded = request.headers
		.get("X-Forwarded-For")
		?.split(",")[0]
		?.trim();
	return `network:${forwarded || request.headers.get("X-Real-IP") || "unknown"}`;
}

export class AccessControl {
	private readonly rateLimitBuckets = new Map<string, RateLimitBucket>();
	private readonly compiledTokens: CompiledTokenEntry[];
	private readonly requestPrincipals = new WeakMap<
		Request,
		AccessPrincipal | null
	>();
	private readonly auditLog: SecurityAuditLog;

	constructor(private readonly options: AccessControlOptions) {
		this.compiledTokens = Array.from(options.tokens.entries()).map(
			([token, principal]) => ({
				bytes: accessTextEncoder.encode(token),
				principal,
				expiresAtMs: parseExpirationMs(principal.expiresAt),
			}),
		);
		this.auditLog =
			options.auditLog ??
			new SecurityAuditLog({ onEvent: options.onAuditEvent });
	}

	static fromEnvironment(
		env: Record<string, string | undefined>,
		logger?: ILogger,
	): AccessControl {
		const production = env.NODE_ENV === "production";
		const enabled = parseBoolean(env.BUN_GRAPH_DB_AUTH_REQUIRED, production);
		const allowedOrigins = (
			env.BUN_GRAPH_DB_ALLOWED_ORIGINS ||
			env.CORS_ORIGIN ||
			""
		)
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean);

		return new AccessControl({
			enabled,
			tokens: parseAccessTokens(env),
			allowedOrigins,
			rateLimit: {
				enabled: parseBoolean(env.BUN_GRAPH_DB_RATE_LIMIT_ENABLED, production),
				max: parsePositiveInteger(env.BUN_GRAPH_DB_RATE_LIMIT_MAX, 1_000),
				windowMs: parsePositiveInteger(
					env.BUN_GRAPH_DB_RATE_LIMIT_WINDOW_MS,
					15 * 60 * 1_000,
				),
			},
			maxRequestBytes: parsePositiveInteger(
				env.BUN_GRAPH_DB_MAX_REQUEST_BYTES,
				1_048_576,
			),
			maxGraphqlComplexity: parsePositiveInteger(
				env.BUN_GRAPH_DB_GRAPHQL_MAX_COMPLEXITY,
				250,
			),
			logger,
		});
	}

	authorize(
		request: Request,
		requirement: AccessRequirement,
		preResolvedPrincipal?: AccessPrincipal,
	): AccessDecision {
		const originDecision = this.validateOrigin(request, requirement);
		if (originDecision) return originDecision;

		const principal =
			preResolvedPrincipal !== undefined
				? preResolvedPrincipal
				: this.principalFor(request);
		if (this.options.enabled && !principal) {
			const credential = credentialFrom(request);
			return this.denied(
				requirement,
				credential ? "invalid_credentials" : "authentication_required",
			);
		}

		const rateLimitDecision = this.validateRateLimit(
			request,
			principal,
			requirement,
		);
		if (rateLimitDecision) return rateLimitDecision;

		if (
			requirement.requestBytes !== undefined &&
			requirement.requestBytes > this.options.maxRequestBytes
		) {
			return this.denied(requirement, "request_too_large", principal, false);
		}
		if (
			requirement.graphqlComplexity !== undefined &&
			requirement.graphqlComplexity > this.options.maxGraphqlComplexity
		) {
			return this.denied(requirement, "query_too_complex", principal, false);
		}

		if (!this.options.enabled) {
			this.audit("allowed", requirement, undefined);
			return { allowed: true };
		}

		if (
			!principal ||
			roleRank[principal.role] < this.requiredRoleRank(requirement.action)
		) {
			return this.denied(requirement, "forbidden", principal, false);
		}
		const requestedTableIds =
			requirement.tableIds ||
			(requirement.tableId ? [requirement.tableId] : []);
		if (requirement.requiresGlobalScope && !principal.tableIds.includes("*")) {
			return this.denied(requirement, "forbidden", principal, false);
		}
		if (
			requirement.unresolvedTableScopedResource &&
			!principal.tableIds.includes("*")
		) {
			return this.denied(requirement, "not_found", principal);
		}
		if (
			requestedTableIds.length > 0 &&
			!principal.tableIds.includes("*") &&
			requestedTableIds.some((tableId) => !principal.tableIds.includes(tableId))
		) {
			return this.denied(requirement, "not_found", principal);
		}

		this.audit("allowed", requirement, principal);
		return { allowed: true, principal };
	}

	responseFor(decision: DeniedAccessDecision): Response {
		const status = decision.status;
		const body =
			decision.code === "not_found"
				? { error: "Not Found" }
				: { error: decision.code };
		return new Response(JSON.stringify(body), {
			status,
			headers: {
				"Content-Type": "application/json",
				...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
			},
		});
	}

	principalFor(request: Request): AccessPrincipal | undefined {
		const cached = this.requestPrincipals.get(request);
		if (cached !== undefined) return cached ?? undefined;
		const credential = credentialFrom(request);
		const principal = credential ? this.findPrincipal(credential) : undefined;
		this.requestPrincipals.set(request, principal ?? null);
		return principal;
	}

	isAuthenticationRequired(): boolean {
		return this.options.enabled;
	}

	registerToken(token: string, principal: AccessPrincipal): void {
		const trimmedToken = token.trim();
		if (!trimmedToken) {
			throw new Error("Access token must be a non-empty string.");
		}
		if (!(principal.role in roleRank)) {
			throw new Error(`Unsupported access role: ${String(principal.role)}`);
		}
		const expiresAtMs = parseExpirationMs(principal.expiresAt);
		const entry: CompiledTokenEntry = {
			bytes: accessTextEncoder.encode(trimmedToken),
			principal: {
				id: principal.id.trim() || `token-${this.compiledTokens.length + 1}`,
				role: principal.role,
				tableIds: [...principal.tableIds],
				...(principal.expiresAt !== undefined
					? { expiresAt: principal.expiresAt }
					: {}),
			},
			expiresAtMs,
		};
		const existingIndex = this.compiledTokens.findIndex(
			(candidate) =>
				candidate.bytes.length === entry.bytes.length &&
				constantTimeEqual(candidate.bytes, entry.bytes),
		);
		if (existingIndex >= 0) {
			this.compiledTokens[existingIndex] = entry;
		} else {
			this.compiledTokens.push(entry);
		}
	}

	revokeToken(tokenOrPrincipalId: string): boolean {
		const trimmed = tokenOrPrincipalId.trim();
		if (!trimmed) return false;
		const candidateBytes = accessTextEncoder.encode(trimmed);
		let removed = false;
		for (let i = this.compiledTokens.length - 1; i >= 0; i--) {
			const entry = this.compiledTokens[i];
			if (!entry) continue;
			const matchesSecret =
				entry.bytes.length === candidateBytes.length &&
				constantTimeEqual(entry.bytes, candidateBytes);
			const matchesPrincipalId = entry.principal.id === trimmed;
			if (matchesSecret || matchesPrincipalId) {
				this.compiledTokens.splice(i, 1);
				removed = true;
			}
		}
		return removed;
	}

	listPrincipals(): readonly AccessPrincipal[] {
		return this.compiledTokens.map((entry) => ({
			id: entry.principal.id,
			role: entry.principal.role,
			tableIds: [...entry.principal.tableIds],
			...(entry.principal.expiresAt !== undefined
				? { expiresAt: entry.principal.expiresAt }
				: {}),
		}));
	}

	getAuditEvents(
		options?: SecurityAuditListOptions,
	): readonly SecurityAuditEvent[] {
		return this.auditLog.list(options);
	}

	private findPrincipal(credential: string): AccessPrincipal | undefined {
		if (this.compiledTokens.length === 0) return undefined;
		const credentialBytes = accessTextEncoder.encode(credential);
		const now = Date.now();
		for (const entry of this.compiledTokens) {
			if (
				entry.bytes.length === credentialBytes.length &&
				constantTimeEqual(entry.bytes, credentialBytes)
			) {
				if (entry.expiresAtMs !== undefined && now >= entry.expiresAtMs) {
					return undefined;
				}
				return entry.principal;
			}
		}
		return undefined;
	}

	private validateOrigin(
		request: Request,
		requirement: AccessRequirement,
	): AccessDecision | undefined {
		const origin = request.headers.get("Origin");
		if (
			!origin ||
			this.options.allowedOrigins.length === 0 ||
			this.options.allowedOrigins.includes("*")
		)
			return undefined;
		if (this.options.allowedOrigins.includes(origin)) return undefined;
		return this.denied(requirement, "forbidden");
	}

	private validateRateLimit(
		request: Request,
		principal: AccessPrincipal | undefined,
		requirement: AccessRequirement,
	): AccessDecision | undefined {
		if (!this.options.rateLimit.enabled) return undefined;

		const now = Date.now();
		if (this.rateLimitBuckets.size >= RATE_LIMIT_PRUNE_THRESHOLD) {
			for (const [bucketKey, entry] of this.rateLimitBuckets) {
				if (entry.resetAt <= now) {
					this.rateLimitBuckets.delete(bucketKey);
				}
			}
			while (this.rateLimitBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
				const oldestKey = this.rateLimitBuckets.keys().next().value;
				if (oldestKey === undefined) break;
				this.rateLimitBuckets.delete(oldestKey);
			}
		}

		const key = requestIdentity(request, principal);
		const existing = this.rateLimitBuckets.get(key);
		const bucket =
			!existing || existing.resetAt <= now
				? { count: 0, resetAt: now + this.options.rateLimit.windowMs }
				: existing;
		bucket.count += 1;
		this.rateLimitBuckets.set(key, bucket);

		if (bucket.count <= this.options.rateLimit.max) return undefined;
		return this.denied(requirement, "rate_limited", principal);
	}

	private requiredRoleRank(action: AccessAction): number {
		return action === "admin"
			? roleRank.admin
			: action === "write"
				? roleRank.writer
				: roleRank.reader;
	}

	private denied(
		requirement: AccessRequirement,
		code: DeniedAccessDecision["code"],
		principal?: AccessPrincipal,
		hideTable: boolean = true,
	): AccessDecision {
		this.audit(code, requirement, principal);
		if (code === "authentication_required" || code === "invalid_credentials") {
			return { allowed: false, status: 401, code };
		}
		if (code === "rate_limited") return { allowed: false, status: 429, code };
		if (code === "request_too_large")
			return { allowed: false, status: 413, code };
		if (code === "query_too_complex")
			return { allowed: false, status: 400, code };
		const shouldHideTable =
			hideTable &&
			Boolean(requirement.tableId || requirement.unresolvedTableScopedResource);
		return {
			allowed: false,
			status: shouldHideTable ? 404 : 403,
			code: shouldHideTable ? "not_found" : code,
		};
	}

	private audit(
		outcome: string,
		requirement: AccessRequirement,
		principal?: AccessPrincipal,
	): void {
		this.auditLog.record({
			timestamp: new Date().toISOString(),
			outcome: outcome === "allowed" ? "allowed" : "denied",
			...(outcome === "allowed" ? {} : { code: outcome }),
			action: requirement.action,
			endpoint: requirement.endpoint,
			principalId: principal?.id,
			principalRole: principal?.role,
			tableIds:
				requirement.tableIds ??
				(requirement.tableId ? [requirement.tableId] : undefined),
		});
		this.options.logger?.info("Access decision", {
			outcome,
			principalId: principal?.id || "anonymous",
			role: principal?.role,
			endpoint: requirement.endpoint,
			action: requirement.action,
			tableId: requirement.tableId,
		});
	}
}

export interface ResolvedMcpRequestAccess {
	action: AccessAction;
	tableId?: string;
	scope?: "global" | "table";
}

export type McpToolActionResolver = (
	toolName: string,
	argumentsValue: unknown,
) => ResolvedMcpRequestAccess | undefined;

export async function authorizeExternalRequest(
	control: AccessControl,
	request: Request,
	resolveMcpToolAction?: McpToolActionResolver,
	resourceResolver?: ExternalResourceAccessResolver,
): Promise<AccessDecision> {
	const url = new URL(request.url);
	const pathname = url.pathname;

	if (
		request.method === "OPTIONS" ||
		pathname === "/" ||
		(request.method === "GET" &&
			(pathname === "/studio" ||
				pathname === "/studio.css" ||
				pathname === "/studio.js")) ||
		pathname === "/health" ||
		pathname === "/api/health"
	) {
		return { allowed: true };
	}

	const tableMcpMatch = pathname.match(/^\/sub\/([^/]+)\/mcp\/?$/);
	const isMcp = pathname === "/mcp" || Boolean(tableMcpMatch);
	const isGraphql = pathname === "/graphql";
	const isSchema =
		pathname === "/schema" ||
		pathname.startsWith("/schema/") ||
		pathname === "/schema.json" ||
		pathname === "/introspection.json" ||
		pathname === "/introspection";
	const isMetrics = pathname === "/metrics";
	const isApi = pathname.startsWith("/api/") || pathname === "/tabular-sync";

	// The policy is intentionally closed by default: a new external endpoint is
	// an admin operation until it receives an explicit classification below.
	if (isMetrics || (!isMcp && !isGraphql && !isSchema && !isApi)) {
		return control.authorize(request, {
			action: "admin",
			endpoint: pathname,
			requiresGlobalScope: true,
		});
	}

	const needsJsonBody =
		(isMcp && request.method === "POST") ||
		(isGraphql && request.method === "POST") ||
		(isApi && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method));
	const { requestBytes, jsonPayload } = await readRequestBytesAndJson(
		request,
		needsJsonBody,
	);
	let action: AccessAction = isSchema ? "admin" : "read";
	let requestedTableIds = tableMcpMatch
		? [decodeURIComponent(tableMcpMatch[1] || "")]
		: [];
	let nodeIds: string[] = [];
	let relationIds: string[] = [];
	let unresolvedTableScopedResource = false;
	let requiresGlobalScope = isSchema;
	let graphqlComplexity: number | undefined;
	if (isMcp && request.method === "POST") {
		if (isRecord(jsonPayload)) {
			const payload = jsonPayload as {
				method?: unknown;
				params?: { name?: unknown; arguments?: unknown };
			};
			const toolName =
				typeof payload.params?.name === "string"
					? payload.params.name
					: undefined;
			const toolAccess = toolName
				? resolveMcpToolAction?.(toolName, payload.params?.arguments)
				: undefined;
			action =
				payload.method === "tools/call"
					? toolAccess?.action || "admin"
					: "read";
			if (payload.method === "tools/call" && toolAccess?.tableId)
				requestedTableIds = [toolAccess.tableId];
			requiresGlobalScope = Boolean(
				payload.method === "tools/call" && toolAccess?.scope === "global",
			);
			nodeIds = collectNodeIds(payload.params?.arguments);
			if (
				payload.method === "tools/call" &&
				toolAccess?.scope === "table" &&
				requestedTableIds.length === 0 &&
				nodeIds.length === 0
			) {
				unresolvedTableScopedResource = true;
			}
		} else {
			action = "admin";
			requiresGlobalScope = true;
		}
	} else if (isGraphql && request.method === "POST") {
		if (isRecord(jsonPayload) && typeof jsonPayload.query === "string") {
			const analysis = analyzeGraphqlRequest(
				jsonPayload.query,
				jsonPayload.variables,
			);
			graphqlComplexity = analysis.complexity;
			action = analysis.action;
			requestedTableIds = analysis.tableIds;
			nodeIds = analysis.nodeIds;
			relationIds = analysis.relationIds;
			requiresGlobalScope = analysis.requiresGlobalScope;
		} else {
			action = "admin";
			requiresGlobalScope = true;
		}
	} else if (isApi) {
		const apiAccess = classifyApiAccess(
			request.method,
			pathname,
			url,
			jsonPayload,
		);
		action = apiAccess.action;
		requestedTableIds = apiAccess.tableIds;
		nodeIds = apiAccess.nodeIds;
		relationIds = apiAccess.relationIds;
		requiresGlobalScope = apiAccess.requiresGlobalScope;
	}

	if (resourceResolver?.resolveNodeTableId && nodeIds.length > 0) {
		const resolved = await Promise.all(
			nodeIds.map(async (nodeId) => ({
				nodeId,
				tableId: await resourceResolver.resolveNodeTableId?.(nodeId),
			})),
		);
		const resolvedTableIds = resolved.flatMap(({ tableId }) =>
			tableId ? [tableId] : [],
		);
		requestedTableIds = uniqueStrings([
			...requestedTableIds,
			...resolvedTableIds,
		]);
		unresolvedTableScopedResource = resolved.some(({ tableId }) => !tableId);
	}

	if (relationIds.length > 0) {
		if (resourceResolver?.resolveRelationTableId) {
			const resolved = await Promise.all(
				relationIds.map(async (relationId) => ({
					relationId,
					tableId: await resourceResolver.resolveRelationTableId?.(relationId),
				})),
			);
			const resolvedTableIds = resolved.flatMap(({ tableId }) =>
				tableId ? [tableId] : [],
			);
			requestedTableIds = uniqueStrings([
				...requestedTableIds,
				...resolvedTableIds,
			]);
			if (resolved.some(({ tableId }) => !tableId)) {
				unresolvedTableScopedResource = true;
			}
		} else {
			action = "admin";
			requiresGlobalScope = true;
		}
	}

	const principal = control.principalFor(request);
	if (
		resourceResolver?.resolveTableIdentity &&
		requestedTableIds.length > 0 &&
		principal &&
		!principal.tableIds.includes("*") &&
		requestedTableIds.some((tableId) => !principal.tableIds.includes(tableId))
	) {
		const normalized = await Promise.all(
			requestedTableIds.map(async (tableRef) => {
				if (principal.tableIds.includes(tableRef)) return tableRef;
				const identity =
					await resourceResolver.resolveTableIdentity?.(tableRef);
				if (!identity) return tableRef;
				if (principal.tableIds.includes(identity.id)) return identity.id;
				if (principal.tableIds.includes(identity.identifier))
					return identity.identifier;
				return tableRef;
			}),
		);
		requestedTableIds = uniqueStrings(normalized);
	}

	return control.authorize(
		request,
		{
			action,
			endpoint: pathname,
			tableId: requestedTableIds[0],
			tableIds: requestedTableIds,
			unresolvedTableScopedResource,
			requiresGlobalScope,
			requestBytes,
			graphqlComplexity,
		},
		principal,
	);
}

const GRAPHQL_PARSE_CACHE_MAX_ENTRIES = 256;
const GRAPHQL_PARSE_CACHE_MAX_QUERY_CHARS = 16_384;

interface CachedParsedGraphqlQuery {
	document: DocumentNode;
	complexity: number;
}

const parsedGraphqlQueryCache = new Map<string, CachedParsedGraphqlQuery>();

function getParsedGraphqlQuery(query: string): CachedParsedGraphqlQuery {
	if (query.length <= GRAPHQL_PARSE_CACHE_MAX_QUERY_CHARS) {
		const cached = parsedGraphqlQueryCache.get(query);
		if (cached) {
			parsedGraphqlQueryCache.delete(query);
			parsedGraphqlQueryCache.set(query, cached);
			return cached;
		}
	}

	const document = parse(query);
	let complexity = 0;
	visit(document, {
		Field() {
			complexity += 1;
		},
	});

	const entry: CachedParsedGraphqlQuery = { document, complexity };
	if (query.length <= GRAPHQL_PARSE_CACHE_MAX_QUERY_CHARS) {
		if (parsedGraphqlQueryCache.size >= GRAPHQL_PARSE_CACHE_MAX_ENTRIES) {
			const oldestKey = parsedGraphqlQueryCache.keys().next().value;
			if (oldestKey !== undefined) {
				parsedGraphqlQueryCache.delete(oldestKey);
			}
		}
		parsedGraphqlQueryCache.set(query, entry);
	}
	return entry;
}

async function readRequestBytesAndJson(
	request: Request,
	needsJsonBody: boolean,
): Promise<{ requestBytes: number; jsonPayload: unknown }> {
	const headerValue = request.headers.get("Content-Length");
	const contentLength = headerValue
		? Number.parseInt(headerValue, 10)
		: Number.NaN;
	const hasValidHeaderLength =
		Number.isSafeInteger(contentLength) && contentLength >= 0;

	if (!needsJsonBody) {
		const requestBytes = hasValidHeaderLength
			? contentLength
			: (await request.clone().arrayBuffer()).byteLength;
		return { requestBytes, jsonPayload: undefined };
	}

	const rawBuffer = await request.clone().arrayBuffer();
	const requestBytes = hasValidHeaderLength
		? contentLength
		: rawBuffer.byteLength;
	if (rawBuffer.byteLength === 0) {
		return { requestBytes, jsonPayload: undefined };
	}

	try {
		const jsonPayload = JSON.parse(
			accessTextDecoder.decode(rawBuffer),
		) as unknown;
		return { requestBytes, jsonPayload };
	} catch {
		return { requestBytes, jsonPayload: undefined };
	}
}

export function extractReferencedGraphqlScope(
	query: string,
	variables: unknown,
): {
	action: AccessAction;
	tableIds: string[];
	nodeIds: string[];
	requiresGlobalScope: boolean;
} {
	const {
		complexity: _complexity,
		relationIds: _relationIds,
		...scope
	} = analyzeGraphqlRequest(query, variables);
	return scope;
}

function analyzeGraphqlRequest(
	query: string,
	variables: unknown,
): {
	complexity: number;
	action: AccessAction;
	tableIds: string[];
	nodeIds: string[];
	relationIds: string[];
	requiresGlobalScope: boolean;
} {
	const tableIds = new Set<string>();
	const nodeIds = new Set<string>();
	const relationIds = new Set<string>();
	let isMutation = false;
	let healthCheckOnly = true;
	let hasRootField = false;
	let hasUnscopedRootField = false;
	let hasAdminRootField = false;
	let complexity = 0;

	try {
		const parsed = getParsedGraphqlQuery(query);
		complexity = parsed.complexity;
		for (const definition of parsed.document.definitions) {
			if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
			const operationIsMutation = definition.operation === "mutation";
			isMutation ||= operationIsMutation;
			for (const selection of definition.selectionSet.selections) {
				if (selection.kind !== Kind.FIELD) {
					healthCheckOnly = false;
					hasUnscopedRootField = true;
					if (operationIsMutation) hasAdminRootField = true;
					continue;
				}
				hasRootField = true;
				const fieldName = selection.name.value;
				if (fieldName === "healthCheck" || fieldName === "__typename") {
					continue;
				}
				healthCheckOnly = false;

				const fieldTableIds = new Set<string>();
				const fieldNodeIds = new Set<string>();
				const fieldRelationIds = new Set<string>();
				const directTableArgNames = rootTableIdArgByField.get(fieldName);

				for (const argument of selection.arguments || []) {
					const argName = argument.name.value;
					const argumentValue = graphQlValueToUnknown(
						argument.value,
						variables,
					);
					collectTableIds(argumentValue, fieldTableIds);
					if (isTableIdKey(argName)) {
						collectTableIds(argumentValue, fieldTableIds, argName);
					}
					if (
						directTableArgNames?.has(argName) &&
						typeof argumentValue === "string" &&
						argumentValue.trim()
					) {
						fieldTableIds.add(argumentValue.trim());
					}
					if (
						isNodeIdKey(argName) ||
						(rootNodeIdFields.has(fieldName) && argName === "id")
					) {
						if (typeof argumentValue === "string" && argumentValue.trim())
							fieldNodeIds.add(argumentValue.trim());
						else collectNodeIds(argumentValue, fieldNodeIds);
					}
					collectNodeIds(argumentValue, fieldNodeIds);
					if (
						isRelationIdKey(argName) ||
						(rootRelationIdFields.has(fieldName) && argName === "id")
					) {
						if (typeof argumentValue === "string" && argumentValue.trim())
							fieldRelationIds.add(argumentValue.trim());
						else collectRelationIds(argumentValue, fieldRelationIds);
					}
					collectRelationIds(argumentValue, fieldRelationIds);
				}

				for (const id of fieldTableIds) tableIds.add(id);
				for (const id of fieldNodeIds) nodeIds.add(id);
				for (const id of fieldRelationIds) relationIds.add(id);

				const fieldHasScope =
					fieldTableIds.size > 0 ||
					fieldNodeIds.size > 0 ||
					fieldRelationIds.size > 0;
				if (ADMIN_ONLY_GRAPHQL_ROOT_FIELDS.has(fieldName)) {
					hasAdminRootField = true;
					hasUnscopedRootField = true;
				} else if (!fieldHasScope) {
					hasUnscopedRootField = true;
					if (
						operationIsMutation &&
						!TABLE_SCOPED_GRAPHQL_MUTATION_FIELDS.has(fieldName)
					) {
						hasAdminRootField = true;
					}
				}
			}
		}
	} catch {
		return {
			complexity: 0,
			action: "admin",
			tableIds: [],
			nodeIds: [],
			relationIds: [],
			requiresGlobalScope: true,
		};
	}

	const requestedTableIds = uniqueStrings([...tableIds]);
	const requestedNodeIds = uniqueStrings([...nodeIds]);
	const requestedRelationIds = uniqueStrings([...relationIds]);
	const isGlobalOperation =
		hasUnscopedRootField ||
		(requestedTableIds.length === 0 &&
			requestedNodeIds.length === 0 &&
			requestedRelationIds.length === 0 &&
			!(hasRootField && healthCheckOnly));
	return {
		complexity,
		// Admin-only root fields and unscoped non-table mutations require admin.
		// Every root field must carry its own scope unless the caller holds global ('*') access.
		action: hasAdminRootField ? "admin" : isMutation ? "write" : "read",
		tableIds: requestedTableIds,
		nodeIds: requestedNodeIds,
		relationIds: requestedRelationIds,
		requiresGlobalScope: isGlobalOperation,
	};
}

function collectTableIds(
	value: unknown,
	tableIds: Set<string>,
	key?: string,
): void {
	if (typeof value === "string" && key && isTableIdKey(key)) {
		tableIds.add(value);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item) => {
			collectTableIds(item, tableIds, key);
		});
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [childKey, childValue] of Object.entries(value)) {
		collectTableIds(childValue, tableIds, childKey);
	}
}

function isTableIdKey(key: string): boolean {
	return (
		key === "tableId" ||
		key === "tableIdentifier" ||
		key === "targetTableId" ||
		key === "tableIds" ||
		key === "tableIdentifiers"
	);
}

const rootTableIdArgByField = new Map<string, ReadonlySet<string>>([
	["table", new Set(["id"])],
	["tableByIdentifier", new Set(["identifier"])],
	["tableOpenApiProjection", new Set(["tableId", "identifier"])],
	["tableDocumentation", new Set(["tableId", "identifier"])],
]);

const rootRelationIdFields = new Set([
	"nodeRelation",
	"updateRelation",
	"deleteRelation",
]);

const rootNodeIdFields = new Set([
	"node",
	"nodeEmbedding",
	"deleteNode",
	"updateNode",
	"removeNodeEmbedding",
	"getNodeAttributes",
	"getConnectedNodes",
	"getNodeRelations",
]);

export const ADMIN_ONLY_GRAPHQL_ROOT_FIELDS: ReadonlySet<string> = new Set([
	"inspectJsonlBackup",
	"exportJsonl",
	"importJsonl",
	"listBackups",
	"backupMetrics",
	"backupDatabase",
	"restoreDatabase",
	"applyRetentionPolicy",
	"importSchema",
	"exportAllTables",
	"exportMultipleTables",
	"exportTableNodes",
	"exportTablePackage",
	"exportTableWithNodes",
	"exportTableToFile",
	"importTablePackage",
	"importTableFromFile",
	"batchImportTablePackages",
	"validateTablePackage",
	"createTable",
	"updateTable",
	"deleteTable",
	"batchCreateTables",
	"batchDeleteTables",
	"createAttributeType",
	"updateAttributeType",
	"deleteAttributeType",
	"createRelationType",
	"updateRelationType",
	"deleteRelationType",
	"createTemplate",
	"updateTemplate",
	"updateTemplateQuery",
	"deleteTemplate",
	"activateTemplate",
	"deactivateTemplate",
	"executeTemplate",
	"executeTemplateWithGraphQL",
	"exportTemplate",
	"exportTemplates",
	"importTemplate",
	"activateTabularSyncConfig",
	"saveTabularSyncConfig",
	"resyncTabularSyncTable",
	"tabularSyncConfig",
	"tabularSyncConfigs",
	"tabularSyncStatus",
	"tabularSyncSummary",
	"systemStats",
	"systemStatus",
	"initializeSystem",
	"batchOperationWithRollback",
]);

export const TABLE_SCOPED_GRAPHQL_MUTATION_FIELDS: ReadonlySet<string> =
	new Set([
		"createNode",
		"createNodeWithAttributes",
		"createPersonNode",
		"updateNode",
		"deleteNode",
		"batchCreateNodes",
		"batchCreateNodesTransactional",
		"batchCreateNodesWithProgress",
		"batchUpdateNodes",
		"batchDeleteNodes",
		"createAttribute",
		"updateAttribute",
		"deleteAttribute",
		"batchCreateAttributes",
		"setNodeAttribute",
		"setNodeAttributes",
		"setNodeAttributesByIdentifier",
		"batchSetNodeAttributes",
		"updateNodeAttributeValue",
		"removeNodeAttribute",
		"bulkSetNodeAttributes",
		"setNodeEmbedding",
		"batchSetNodeEmbeddings",
		"removeNodeEmbedding",
		"createRelation",
		"updateRelation",
		"deleteRelation",
		"batchCreateRelations",
		"createDoc",
		"createDocVersion",
		"updateDoc",
		"deleteDoc",
		"activateDoc",
		"moveHierarchyNode",
	]);

function isNodeIdKey(key: string): boolean {
	return (
		key === "nodeId" ||
		key === "nodeIds" ||
		key === "sourceNodeId" ||
		key === "targetNodeId" ||
		key === "fromNodeId" ||
		key === "toNodeId" ||
		key === "startNodeIds" ||
		key === "endNodeIds" ||
		key === "avoidNodes" ||
		key === "anchorNodeIds" ||
		key === "rootNodeId" ||
		key === "nodeIdA" ||
		key === "nodeIdB" ||
		key === "newParentId"
	);
}

function collectNodeIds(
	value: unknown,
	nodeIds: Set<string> = new Set(),
	key?: string,
): string[] {
	if (typeof value === "string" && key && isNodeIdKey(key)) {
		nodeIds.add(value);
		return uniqueStrings([...nodeIds]);
	}
	if (Array.isArray(value)) {
		value.forEach((item) => {
			collectNodeIds(item, nodeIds, key);
		});
		return uniqueStrings([...nodeIds]);
	}
	if (!value || typeof value !== "object") return uniqueStrings([...nodeIds]);
	for (const [childKey, childValue] of Object.entries(value)) {
		collectNodeIds(childValue, nodeIds, childKey);
	}
	return uniqueStrings([...nodeIds]);
}

function isRelationIdKey(key: string): boolean {
	return key === "relationId" || key === "relationIds";
}

function collectRelationIds(
	value: unknown,
	relationIds: Set<string> = new Set(),
	key?: string,
): string[] {
	if (typeof value === "string" && key && isRelationIdKey(key)) {
		relationIds.add(value);
		return uniqueStrings([...relationIds]);
	}
	if (Array.isArray(value)) {
		value.forEach((item) => {
			collectRelationIds(item, relationIds, key);
		});
		return uniqueStrings([...relationIds]);
	}
	if (!value || typeof value !== "object")
		return uniqueStrings([...relationIds]);
	for (const [childKey, childValue] of Object.entries(value)) {
		collectRelationIds(childValue, relationIds, childKey);
	}
	return uniqueStrings([...relationIds]);
}

function graphQlValueToUnknown(value: ValueNode, variables: unknown): unknown {
	switch (value.kind) {
		case Kind.VARIABLE:
			return isRecord(variables) ? variables[value.name.value] : undefined;
		case Kind.LIST:
			return value.values.map((item) => graphQlValueToUnknown(item, variables));
		case Kind.OBJECT:
			return Object.fromEntries(
				value.fields.map((field) => [
					field.name.value,
					graphQlValueToUnknown(field.value, variables),
				]),
			);
		case Kind.NULL:
			return null;
		case Kind.BOOLEAN:
			return value.value;
		case Kind.INT:
		case Kind.FLOAT:
			return Number(value.value);
		case Kind.STRING:
		case Kind.ENUM:
			return value.value;
		default:
			return undefined;
	}
}

function classifyApiAccess(
	method: string,
	pathname: string,
	url: URL,
	body: unknown,
): {
	action: AccessAction;
	tableIds: string[];
	nodeIds: string[];
	relationIds: string[];
	requiresGlobalScope: boolean;
} {
	if (isRestAdminRoute(method, pathname)) {
		return {
			action: "admin",
			tableIds: [],
			nodeIds: [],
			relationIds: [],
			requiresGlobalScope: true,
		};
	}

	const tableIds = new Set<string>();
	collectTableIds(body, tableIds);
	url.searchParams.forEach((value, key) => {
		collectTableIds(value, tableIds, key);
	});
	const nodeIds = new Set<string>(collectNodeIds(body));
	const pathNodeId = extractRestNodePathParam(pathname);
	if (pathNodeId) nodeIds.add(pathNodeId);

	const pathTableId = extractRestTablePathParam(pathname);
	if (pathTableId) tableIds.add(pathTableId);

	const attrTableId = extractRestAttributeTableId(pathname);
	if (attrTableId) tableIds.add(attrTableId);

	const relationIds = new Set<string>();
	if (method.toUpperCase() === "DELETE") {
		const relationId = extractRestExactRelationId(pathname);
		if (relationId) relationIds.add(relationId);
	}

	const safeMethod = isRestReadOnlyOperation(method, pathname);
	const requestedTableIds = uniqueStrings([...tableIds]);
	const requestedNodeIds = uniqueStrings([...nodeIds]);
	const requestedRelationIds = uniqueStrings([...relationIds]);
	const hasScope =
		requestedTableIds.length > 0 ||
		requestedNodeIds.length > 0 ||
		requestedRelationIds.length > 0;
	return {
		action: safeMethod ? "read" : hasScope ? "write" : "admin",
		tableIds: requestedTableIds,
		nodeIds: requestedNodeIds,
		relationIds: requestedRelationIds,
		requiresGlobalScope: !hasScope,
	};
}

function uniqueStrings(values: string[]): string[] {
	return [
		...new Set(values.map((value) => value.trim()).filter(Boolean)),
	].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
