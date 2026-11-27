export type HttpSurfaceKind =
	| "rest"
	| "graphql"
	| "mcp"
	| "studio"
	| "health"
	| "metrics"
	| "other";

export interface HttpMetricTelemetry {
	method: string;
	surface: HttpSurfaceKind;
	status: number;
	durationMs: number;
	isMutation?: boolean;
}

export interface MetricsJsonSnapshot {
	uptimeSeconds: number;
	httpRequestsTotal: number;
	httpErrorsTotal: number;
	httpMutationsTotal: number;
	httpBySurface: Record<string, number>;
	httpByStatus: Record<string, number>;
	authDecisions: Record<string, number>;
	durationMs: {
		count: number;
		sum: number;
		buckets: Record<string, number>;
	};
	activeTokens?: number;
}

const DURATION_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 5000] as const;

export function classifyHttpSurface(pathname: string): HttpSurfaceKind {
	if (pathname === "/health" || pathname === "/api/health") return "health";
	if (pathname === "/metrics") return "metrics";
	if (pathname === "/studio" || pathname === "/") return "studio";
	if (pathname === "/mcp" || /^\/sub\/[^/]+\/mcp\/?$/.test(pathname))
		return "mcp";
	if (pathname === "/graphql") return "graphql";
	if (pathname.startsWith("/api/")) return "rest";
	return "other";
}

/**
 * Zero-dependency Prometheus + JSON observability registry portable across Node, Web, and Workers.
 */
export class MetricsRegistry {
	private readonly startedAtMs = Date.now();
	private httpRequestsTotal = 0;
	private httpErrorsTotal = 0;
	private httpMutationsTotal = 0;
	private readonly httpBySurface = new Map<string, number>();
	private readonly httpByStatus = new Map<string, number>();
	private readonly authDecisions = new Map<string, number>();
	private durationCount = 0;
	private durationSum = 0;
	private readonly durationBuckets = new Map<number, number>(
		DURATION_BUCKETS.map((le) => [le, 0]),
	);

	recordHttpRequest(telemetry: HttpMetricTelemetry): void {
		this.httpRequestsTotal += 1;
		if (telemetry.status >= 400) {
			this.httpErrorsTotal += 1;
		}
		if (telemetry.isMutation) {
			this.httpMutationsTotal += 1;
		}

		const surfaceKey = `${telemetry.surface}:${telemetry.method.toUpperCase()}`;
		this.httpBySurface.set(
			surfaceKey,
			(this.httpBySurface.get(surfaceKey) ?? 0) + 1,
		);

		const statusKey = String(telemetry.status);
		this.httpByStatus.set(
			statusKey,
			(this.httpByStatus.get(statusKey) ?? 0) + 1,
		);

		const ms = Math.max(0, telemetry.durationMs);
		this.durationCount += 1;
		this.durationSum += ms;
		for (const bound of DURATION_BUCKETS) {
			if (ms <= bound) {
				this.durationBuckets.set(
					bound,
					(this.durationBuckets.get(bound) ?? 0) + 1,
				);
			}
		}
	}

	recordAuthDecision(outcome: "allowed" | "denied", code?: string): void {
		const key =
			outcome === "allowed" ? "allowed:ok" : `denied:${code ?? "unknown"}`;
		this.authDecisions.set(key, (this.authDecisions.get(key) ?? 0) + 1);
	}

	toJsonSnapshot(extraGauges?: { activeTokens?: number }): MetricsJsonSnapshot {
		const buckets: Record<string, number> = {};
		for (const bound of DURATION_BUCKETS) {
			buckets[String(bound)] = this.durationBuckets.get(bound) ?? 0;
		}
		buckets["+Inf"] = this.durationCount;

		return {
			uptimeSeconds: Math.floor((Date.now() - this.startedAtMs) / 1000),
			httpRequestsTotal: this.httpRequestsTotal,
			httpErrorsTotal: this.httpErrorsTotal,
			httpMutationsTotal: this.httpMutationsTotal,
			httpBySurface: Object.fromEntries(this.httpBySurface.entries()),
			httpByStatus: Object.fromEntries(this.httpByStatus.entries()),
			authDecisions: Object.fromEntries(this.authDecisions.entries()),
			durationMs: {
				count: this.durationCount,
				sum: this.durationSum,
				buckets,
			},
			activeTokens: extraGauges?.activeTokens,
		};
	}

	renderPrometheus(extraGauges?: { activeTokens?: number }): string {
		const snap = this.toJsonSnapshot(extraGauges);
		const lines: string[] = [
			"# HELP bun_graph_db_uptime_seconds Process uptime in seconds",
			"# TYPE bun_graph_db_uptime_seconds gauge",
			`bun_graph_db_uptime_seconds ${snap.uptimeSeconds}`,
			"# HELP bun_graph_db_http_requests_total Total HTTP requests handled",
			"# TYPE bun_graph_db_http_requests_total counter",
			`bun_graph_db_http_requests_total ${snap.httpRequestsTotal}`,
			"# HELP bun_graph_db_http_errors_total Total HTTP requests returning status >= 400",
			"# TYPE bun_graph_db_http_errors_total counter",
			`bun_graph_db_http_errors_total ${snap.httpErrorsTotal}`,
			"# HELP bun_graph_db_http_mutations_total Total REST mutation requests processed",
			"# TYPE bun_graph_db_http_mutations_total counter",
			`bun_graph_db_http_mutations_total ${snap.httpMutationsTotal}`,
		];

		if (Object.keys(snap.httpBySurface).length > 0) {
			lines.push(
				"# HELP bun_graph_db_http_surface_requests_total HTTP requests partitioned by surface and method",
				"# TYPE bun_graph_db_http_surface_requests_total counter",
			);
			for (const [key, count] of Object.entries(snap.httpBySurface)) {
				const [surface, method] = key.split(":");
				lines.push(
					`bun_graph_db_http_surface_requests_total{surface="${surface}",method="${method}"} ${count}`,
				);
			}
		}

		if (Object.keys(snap.authDecisions).length > 0) {
			lines.push(
				"# HELP bun_graph_db_auth_decisions_total Access control decisions partitioned by outcome and code",
				"# TYPE bun_graph_db_auth_decisions_total counter",
			);
			for (const [key, count] of Object.entries(snap.authDecisions)) {
				const [outcome, code] = key.split(":");
				lines.push(
					`bun_graph_db_auth_decisions_total{outcome="${outcome}",code="${code}"} ${count}`,
				);
			}
		}

		lines.push(
			"# HELP bun_graph_db_http_request_duration_ms HTTP request duration histogram in milliseconds",
			"# TYPE bun_graph_db_http_request_duration_ms histogram",
		);
		for (const bound of DURATION_BUCKETS) {
			lines.push(
				`bun_graph_db_http_request_duration_ms_bucket{le="${bound}"} ${snap.durationMs.buckets[String(bound)] ?? 0}`,
			);
		}
		lines.push(
			`bun_graph_db_http_request_duration_ms_bucket{le="+Inf"} ${snap.durationMs.count}`,
		);
		lines.push(
			`bun_graph_db_http_request_duration_ms_sum ${snap.durationMs.sum}`,
		);
		lines.push(
			`bun_graph_db_http_request_duration_ms_count ${snap.durationMs.count}`,
		);

		if (snap.activeTokens !== undefined) {
			lines.push(
				"# HELP bun_graph_db_active_access_tokens Number of registered AccessControl tokens",
				"# TYPE bun_graph_db_active_access_tokens gauge",
				`bun_graph_db_active_access_tokens ${snap.activeTokens}`,
			);
		}

		return `${lines.join("\n")}\n`;
	}
}
