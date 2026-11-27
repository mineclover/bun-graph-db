import { describe, expect, test } from "vitest";
import {
	AccessControl,
	SecurityAuditLog,
} from "@/application/security/AccessControl.js";
import { createPortableGraphNode } from "@/infrastructure/container/PortableBootstrap.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import { MetricsRegistry } from "@/presentation/http/observability/MetricsRegistry.js";

describe("Security Operations, Metrics Registry & Web Studio Inspector", () => {
	test("supports dynamic token registration, expiration, revocation, principal redaction, and SecurityAuditLog filtering", async () => {
		const auditLog = new SecurityAuditLog({ maxEvents: 5 });
		const control = new AccessControl({
			enabled: true,
			tokens: new Map([
				["tok-admin", { id: "admin-ops", role: "admin", tableIds: ["*"] }],
				[
					"tok-expired",
					{
						id: "expired-agent",
						role: "reader",
						tableIds: ["*"],
						expiresAt: "2020-01-01T00:00:00.000Z",
					},
				],
			]),
			allowedOrigins: [],
			rateLimit: { enabled: false, max: 100, windowMs: 60_000 },
			maxRequestBytes: 1_048_576,
			maxGraphqlComplexity: 250,
			auditLog,
		});

		// Expired token is rejected as invalid_credentials
		const expiredDecision = control.authorize(
			new Request("http://localhost/api/tables", {
				headers: { Authorization: "Bearer tok-expired" },
			}),
			{ action: "read", endpoint: "/api/tables" },
		);
		expect(expiredDecision).toEqual({
			allowed: false,
			status: 401,
			code: "invalid_credentials",
		});

		// Dynamically register a new writer token
		control.registerToken("tok-writer-live", {
			id: "writer-live",
			role: "writer",
			tableIds: ["docs"],
		});

		const listedPrincipals = control.listPrincipals();
		expect(listedPrincipals.map((p) => p.id)).toContain("writer-live");
		expect(JSON.stringify(listedPrincipals)).not.toContain("tok-writer-live");

		const allowedDecision = control.authorize(
			new Request("http://localhost/api/nodes", {
				headers: { Authorization: "Bearer tok-writer-live" },
			}),
			{ action: "write", endpoint: "/api/nodes", tableId: "docs" },
		);
		expect(allowedDecision.allowed).toBe(true);

		// Revoke by principal id and verify subsequent rejection
		expect(control.revokeToken("writer-live")).toBe(true);
		expect(control.revokeToken("writer-live")).toBe(false);

		const revokedDecision = control.authorize(
			new Request("http://localhost/api/nodes", {
				headers: { Authorization: "Bearer tok-writer-live" },
			}),
			{ action: "write", endpoint: "/api/nodes", tableId: "docs" },
		);
		expect(revokedDecision).toEqual({
			allowed: false,
			status: 401,
			code: "invalid_credentials",
		});

		const deniedEvents = control.getAuditEvents({ outcome: "denied" });
		expect(deniedEvents.length).toBeGreaterThanOrEqual(2);
		expect(auditLog.size).toBeLessThanOrEqual(5);
	});

	test("renders Prometheus text and JSON snapshots in MetricsRegistry", () => {
		const registry = new MetricsRegistry();
		registry.recordHttpRequest({
			method: "GET",
			surface: "health",
			status: 200,
			durationMs: 3,
		});
		registry.recordHttpRequest({
			method: "POST",
			surface: "rest",
			status: 201,
			durationMs: 18,
			isMutation: true,
		});
		registry.recordHttpRequest({
			method: "GET",
			surface: "metrics",
			status: 403,
			durationMs: 4,
		});
		registry.recordAuthDecision("allowed");
		registry.recordAuthDecision("denied", "forbidden");

		const json = registry.toJsonSnapshot({ activeTokens: 2 });
		expect(json.httpRequestsTotal).toBe(3);
		expect(json.httpErrorsTotal).toBe(1);
		expect(json.httpMutationsTotal).toBe(1);
		expect(json.activeTokens).toBe(2);

		const prom = registry.renderPrometheus({ activeTokens: 2 });
		expect(prom).toContain("bun_graph_db_http_requests_total 3");
		expect(prom).toContain("bun_graph_db_http_mutations_total 1");
		expect(prom).toContain(
			'bun_graph_db_auth_decisions_total{outcome="denied",code="forbidden"} 1',
		);
		expect(prom).toContain("bun_graph_db_active_access_tokens 2");
	});

	test("serves Web Studio HTML on /studio and gates /metrics + /api/audit-log behind admin auth", async () => {
		const control = AccessControl.fromEnvironment({
			NODE_ENV: "production",
			BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
				readerTok: { id: "reader-1", role: "reader", tableIds: ["*"] },
				adminTok: { id: "admin-1", role: "admin", tableIds: ["*"] },
			}),
			BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN:
				"internal-bridge-token-at-least-32-chars-0001",
		});

		const db = new SqliteDatabase(":memory:");
		const node = await createPortableGraphNode(db, {
			databaseLabel: ":memory:",
			accessControl: control,
			internalBridgeToken: "internal-bridge-token-at-least-32-chars-0001",
		});

		try {
			// GET /studio is accessible without admin token as static UI shell
			const studioRes = await node.fetch(
				new Request("http://localhost/studio"),
			);
			expect(studioRes.status).toBe(200);
			expect(studioRes.headers.get("Content-Type")).toContain("text/html");
			const html = await studioRes.text();
			expect(html).toContain("Bun Graph DB Studio");

			// Reader cannot access /metrics or /api/audit-log
			const readerMetrics = await node.fetch(
				new Request("http://localhost/metrics", {
					headers: { Authorization: "Bearer readerTok" },
				}),
			);
			expect(readerMetrics.status).toBe(403);

			const readerAudit = await node.fetch(
				new Request("http://localhost/api/audit-log", {
					headers: { Authorization: "Bearer readerTok" },
				}),
			);
			expect(readerAudit.status).toBe(403);

			// Admin reads /metrics (Prometheus + JSON) and /api/audit-log
			const adminProm = await node.fetch(
				new Request("http://localhost/metrics", {
					headers: { Authorization: "Bearer adminTok" },
				}),
			);
			expect(adminProm.status).toBe(200);
			const promText = await adminProm.text();
			expect(promText).toContain("bun_graph_db_http_requests_total");

			const adminJsonMetrics = await node.fetch(
				new Request("http://localhost/metrics?format=json", {
					headers: { Authorization: "Bearer adminTok" },
				}),
			);
			expect(adminJsonMetrics.status).toBe(200);
			const jsonMetrics = (await adminJsonMetrics.json()) as {
				httpRequestsTotal: number;
			};
			expect(jsonMetrics.httpRequestsTotal).toBeGreaterThanOrEqual(4);

			const adminAudit = await node.fetch(
				new Request("http://localhost/api/audit-log?limit=20", {
					headers: { Authorization: "Bearer adminTok" },
				}),
			);
			expect(adminAudit.status).toBe(200);
			const auditBody = (await adminAudit.json()) as {
				success: boolean;
				events: Array<{ outcome: string }>;
			};
			expect(auditBody.success).toBe(true);
			expect(auditBody.events.length).toBeGreaterThanOrEqual(2);
		} finally {
			await node.dispose();
			db.close();
		}
	});
});
